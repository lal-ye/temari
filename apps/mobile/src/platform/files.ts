import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { PORTABLE_LIMITS, PDF_MAX_BYTES } from '@temari/core';
import { hasNativeReader, readBase64Native, readTextNative } from '@temari/file-read';

// '*/*' for JSON on purpose: with a stricter filter, DocumentsUI shows but
// GREYS OUT files whose provider-reported MIME differs, and browser-downloaded
// .json files are commonly reported as application/octet-stream. The content
// is validated by parsing it, so the filter buys nothing.
const DOCUMENT_MIME = { json: '*/*', pdf: 'application/pdf' } as const;

// pickFileAsync issues ACTION_OPEN_DOCUMENT: only the system DocumentsUI can
// answer it, so Samsung's My Files (which has answered ACTION_GET_CONTENT with
// raw media URIs that our process provably cannot read — verified on device)
// is unreachable by construction. initialUri is the SAF ExternalStorage root's
// Download folder; URIs it returns are '*.documents' SAF URIs honouring the
// SAF contract: contentResolver.openInputStream in our own process, which is
// exactly what the native fallback reader does.
const DOWNLOAD_INITIAL_URI = 'content://com.android.externalstorage.documents/document/primary%3ADownload';

type StagedError = Error & { code: string; detail?: string };

function fail(stage: string, code: string, message: string, detail?: string): StagedError {
  const error = new Error(message) as StagedError;
  error.code = `${stage}/${code}`;
  if (detail !== undefined) error.detail = detail;
  return error;
}

const messageOf = (error: unknown) => (error instanceof Error ? error.message : String(error));

const codeOf = (error: unknown): string => {
  const code = (error as { code?: string } | null)?.code;
  if (typeof code === 'string') return code;
  const text = messageOf(error);
  if (/ERR_TEMARI_TOO_LARGE/.test(text)) return 'ERR_TEMARI_TOO_LARGE';
  if (/SecurityException/i.test(text)) return 'ERR_TEMARI_READ_DENIED';
  return 'ERR_TEMARI_READ_FAILED';
};

type Picked = { uri: string; name: string; size?: number };

async function pickDocument(source: 'json' | 'pdf'): Promise<Picked | null> {
  // Primary: the new File API's picker (SDK 54+). Probed by feature rather
  // than Platform so the same call compiles for web (where the legacy
  // DocumentPicker remains the real handler).
  const probe = File as typeof File & {
    pickFileAsync?: (options: { initialUri?: string; mimeTypes?: string | string[]; multipleFiles?: false }) => Promise<
      { canceled: boolean; result?: { uri: string; name?: string; size?: number } | null }
    >;
  };
  if (typeof probe.pickFileAsync === 'function') {
    try {
      const picked = await probe.pickFileAsync({
        initialUri: DOWNLOAD_INITIAL_URI,
        multipleFiles: false,
        ...(source === 'pdf' ? { mimeTypes: DOCUMENT_MIME.pdf } : {}),
      });
      const result = picked.result;
      if (picked.canceled || !result?.uri) return null;
      return { uri: result.uri, name: result.name ?? `picked.${source === 'pdf' ? 'pdf' : 'json'}`, size: result.size };
    } catch {
      // Unavailable or refused — the legacy picker is the fallback.
    }
  }
  const picked = await getDocumentAsync({ type: DOCUMENT_MIME[source], copyToCacheDirectory: false, multiple: false });
  if (picked.canceled) return null;
  const asset = picked.assets[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.name, size: asset.size };
}

async function readDocument(source: 'json' | 'pdf', uri: string, limit: number): Promise<string> {
  const viaNative = async () => (source === 'pdf' ? readBase64Native(uri, limit) : readTextNative(uri, limit));
  const viaFileApi = async () => {
    const file = new File(uri);
    const content = source === 'pdf' ? await file.base64() : await file.text();
    const rawLength = source === 'pdf' ? Math.floor(content.length * 3 / 4) : content.length;
    if (rawLength > limit) throw Object.assign(new Error(`raw length ${rawLength} bytes`), { code: 'ERR_TEMARI_TOO_LARGE' });
    return content;
  };
  // Native reader first for content:// URIs: it is the only read path whose
  // semantics we own (the new File API's content:// support was only completed
  // in SDK 58 and still has rough edges in 57). Order matters: too_large kills
  // the chain (no fallback rescues oversized content), everything else tries
  // the next strategy and the LAST failure determines the staged message.
  const steps = uri.startsWith('content://') ? [viaNative, viaFileApi] : [viaFileApi];
  let lastFailure: unknown;
  for (const step of steps) {
    try {
      return await step();
    } catch (error) {
      lastFailure = error;
      if (codeOf(error) === 'ERR_TEMARI_TOO_LARGE') break;
    }
  }
  const code = codeOf(lastFailure);
  const detail = `uri=${uri} · native=${hasNativeReader() ? 'present' : 'absent'} · ${messageOf(lastFailure)}`;
  if (code === 'ERR_TEMARI_TOO_LARGE')
    throw fail('read', 'too_large', `That backup is larger than the ${limit / 1024 / 1024} MiB limit.`, detail);
  if (code === 'ERR_TEMARI_READ_DENIED')
    throw fail('read', 'denied', 'Android refused to let Temari read that file. Try picking it from Internal storage › Download instead of the Downloads shortcut.', detail);
  throw fail('read', 'failed', 'The file could not be read — it may have been moved or is no longer accessible.', detail);
}

export async function pickStudyFile(kind: 'json' | 'pdf') {
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : PORTABLE_LIMITS.maxBytes;
  const picked = await pickDocument(kind);
  if (picked === null) return null;
  if (picked.size !== undefined && picked.size > limit) {
    throw fail('read', 'too_large', `That backup is larger than the ${limit / 1024 / 1024} MiB limit.`, `reported size ${picked.size} · ${picked.uri}`);
  }
  return {
    name: picked.name,
    size: picked.size ?? 0,
    content: await readDocument(kind, picked.uri, limit),
  };
}

export async function shareText(name: string, text: string, mimeType = 'application/json') {
  if (!await isAvailableAsync()) throw new Error('Sharing is unavailable on this device. Your data is unchanged.');
  const exports = new Directory(Paths.cache, 'temari-shares');
  exports.create({ intermediates: true, idempotent: true });
  // A receiving Android app can read AFTER the chooser's promise resolves.
  // Keep unique share files for 24h; prune old exports on the next share.
  for (const entry of exports.list()) {
    const timestamp = Number(entry.name.split('-')[0]);
    if (timestamp > 0 && Date.now() - timestamp > 24 * 60 * 60 * 1000) {
      try { entry.delete(); } catch { /* best effort; never delete the active share */ }
    }
  }
  const directory = new Directory(exports, `${Date.now()}-${randomUUID()}`);
  directory.create();
  const file = new File(directory, name);
  try {
    file.write(text);
    await shareAsync(file.uri, { mimeType, dialogTitle: 'Export from Temari' });
  } catch (error) {
    try { directory.delete(); } catch { /* preserve the original sharing failure */ }
    throw error;
  }
}

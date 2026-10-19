import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { PORTABLE_LIMITS, PDF_MAX_BYTES } from '@temari/core';
import { temariFileRead } from '../../modules/temari-file-read';

export async function pickStudyFile(kind: 'json' | 'pdf') {
  // copyToCacheDirectory:false keeps the picker's original SAF document URI.
  // Asking the picker to copy instead (copyToCacheDirectory:true, tried in
  // PR #52) routes through Samsung's media layer, whose cache copy throws
  // SecurityException("com.samsung.android.providers.media has no access to
  // content://media/...") for Download-folder files regardless of MIME type.
  // Reading goes through our own native module: every expo-file-system JS
  // API refuses content:// URIs (readAsStringAsync: "Unsupported scheme";
  // copyAsync: a DocumentFile.canRead() probe Samsung's downloads provider
  // fails), while contentResolver.openInputStream inside our own process
  // honours the SAF grant the picker just returned.
  const docType = kind === 'json' ? 'application/json' : 'application/pdf';
  const result = await getDocumentAsync({ type: docType, copyToCacheDirectory: false, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : PORTABLE_LIMITS.maxBytes;
  if (asset.size !== undefined && asset.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
  try {
    const content = kind === 'pdf' ? await temariFileRead().readBase64(asset.uri) : await temariFileRead().readText(asset.uri);
    const rawLength = kind === 'pdf' ? Math.floor(content.length * 3 / 4) : content.length;
    if (rawLength > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
    return { name: asset.name, size: rawLength, content };
  } catch (error) {
    throw new Error(`read from ${asset.uri} (name=${asset.name}, size=${asset.size ?? 'hidden'}) failed — ${error}`);
  }
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

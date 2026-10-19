import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { readAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { PORTABLE_LIMITS, PDF_MAX_BYTES } from '@temari/core';

// TEMP-DIAGNOSTIC v2: probe the Samsung-Download read paths in one install;
// revert before any non-diagnostic merge. Device ground truth (2026-10-17):
// Samsung's picker serves Download-folder files as MediaProvider URIs
// (content://media/external_primary/file/…), NOT SAF downloads-provider URIs,
// and the picker's own cache copy throws SecurityException("…has no access to
// content://media/…") INSIDE getDocumentAsync when copyToCacheDirectory:true.
// Probes in this build:
//   1. docType 'application/json' instead of '*/*' (JSON only): a different
//      intent filter may route the pick away from Samsung's My Files picker
//      to DocumentsUI, whose downloads-provider SAF URLs work gate-free.
//   2. If that pick still fails: re-pick with copyToCacheDirectory:false and
//      read the content URI via legacy readAsStringAsync — non-SAF content
//      URIs are auto-granted READ in FileSystemLegacyModule.permissionsForUri
//      (no canRead() gate), so this tests whether our own process can read
//      the granted URI at all.
//   3. The final error names what both attempts returned.
export async function pickStudyFile(kind: 'json' | 'pdf') {
  const docType = kind === 'json' ? 'application/json' : 'application/pdf';
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : PORTABLE_LIMITS.maxBytes;
  let firstFailure: string;
  try {
    const result = await getDocumentAsync({ type: docType, copyToCacheDirectory: true, multiple: false });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if (asset.size !== undefined && asset.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
    const cache = new File(asset.uri);
    if (cache.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
    return { name: asset.name, size: cache.size, content: kind === 'pdf' ? await cache.base64() : await cache.text() };
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (message.includes('File exceeds')) throw error;
    firstFailure = `attempt1(type=${docType}, copyToCacheDir=true) → ${message}`;
  }
  // Attempt 2: same docType, no native cache copy, read the content URI in JS.
  try {
    const result = await getDocumentAsync({ type: docType, copyToCacheDirectory: false, multiple: false });
    if (result.canceled) return null;
    const asset = result.assets[0];
    if (!asset) return null;
    if (asset.size !== undefined && asset.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
    let content: string;
    try {
      content = await readAsStringAsync(asset.uri, { encoding: kind === 'pdf' ? EncodingType.Base64 : EncodingType.UTF8 });
    } catch (error) {
      throw new Error(`readAsStringAsync ${asset.uri} (name=${asset.name}, size=${asset.size ?? 'hidden'}) failed — ${error}`);
    }
    // The readString already allocated; reject before anything consumes the content.
    const rawLength = kind === 'pdf' ? Math.floor(content.length * 3 / 4) : content.length;
    if (rawLength > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
    return { name: asset.name, size: rawLength, content };
  } catch (error) {
    const secondFailure = `attempt2(copyToCacheDir=false → readAsStringAsync) → ${String(error instanceof Error ? error.message : error)}`;
    throw new Error(`diagnostic: ${firstFailure} | ${secondFailure}`);
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

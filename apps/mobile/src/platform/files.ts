import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { PORTABLE_LIMITS, PDF_MAX_BYTES } from '@temari/core';

export async function pickStudyFile(kind: 'json' | 'pdf') {
  // copyToCacheDirectory:true makes the native DocumentPicker copy the picked
  // document to our cache dir via ContentResolver.openInputStream — the one
  // read path with no ability gate. The legacy copyAsync we previously used
  // instead probes androidx DocumentFile.canRead() first, which returns false
  // for downloads-provider URIs (e.g. Samsung Download folder); the copy then
  // throws "Location ... isn't readable" before the file is ever touched.
  // The picker returns the cache file's file:// URI in its place.
  const result = await getDocumentAsync({ type: kind === 'pdf' ? 'application/pdf' : '*/*', copyToCacheDirectory: true, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : PORTABLE_LIMITS.maxBytes;
  if (asset.size !== undefined && asset.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
  const cache = new File(asset.uri);
  if (cache.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
  try {
    return { name: asset.name, size: cache.size, content: kind === 'pdf' ? await cache.base64() : await cache.text() };
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

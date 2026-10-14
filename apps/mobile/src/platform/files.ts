import { getDocumentAsync } from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
// Only this compatibility copy uses ContentResolver for Samsung content:// URIs.
import { copyAsync } from 'expo-file-system/legacy';
import { isAvailableAsync, shareAsync } from 'expo-sharing';
import { randomUUID } from 'expo-crypto';
import { PORTABLE_LIMITS, PDF_MAX_BYTES } from '@temari/core';

export async function pickStudyFile(kind: 'json' | 'pdf') {
  const result = await getDocumentAsync({ type: kind === 'pdf' ? 'application/pdf' : '*/*', copyToCacheDirectory: false, multiple: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : PORTABLE_LIMITS.maxBytes;
  if (asset.size !== undefined && asset.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
  const temp = new File(Paths.cache, `temari-import-${randomUUID()}.${kind}`);
  try {
    await copyAsync({ from: asset.uri, to: temp.uri });
    if (temp.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
    return { name: asset.name, size: temp.size, content: kind === 'pdf' ? await temp.base64() : await temp.text() };
  } finally {
    if (temp.exists) temp.delete();
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

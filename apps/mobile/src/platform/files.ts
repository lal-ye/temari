import { getDocumentAsync } from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
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
  const file = new File(Paths.cache, name);
  try {
    file.write(text);
    await shareAsync(file.uri, { mimeType, dialogTitle: 'Export from Temari' });
  } finally {
    if (file.exists) file.delete();
  }
}

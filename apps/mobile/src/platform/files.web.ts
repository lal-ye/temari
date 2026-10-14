import { getDocumentAsync } from 'expo-document-picker';
import { PORTABLE_LIMITS, PDF_MAX_BYTES } from '@temari/core';

export async function pickStudyFile(kind: 'json' | 'pdf') {
  const result = await getDocumentAsync({ type: kind === 'pdf' ? 'application/pdf' : '*/*', multiple: false, base64: false });
  if (result.canceled) return null;
  const asset = result.assets[0];
  const file = asset.file;
  if (!file) throw new Error('The browser did not return a readable file.');
  const limit = kind === 'pdf' ? PDF_MAX_BYTES : PORTABLE_LIMITS.maxBytes;
  if (file.size > limit) throw new Error(`File exceeds ${limit / 1024 / 1024} MiB.`);
  const content = kind === 'json' ? await file.text() : await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = () => reject(new Error('Could not read this PDF.'));
    reader.readAsDataURL(file);
  });
  return { name: asset.name, size: file.size, content };
}

export async function shareText(name: string, text: string, mimeType = 'application/json') {
  const url = URL.createObjectURL(new Blob([text], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  // Give the browser time to start the download before revoking its source.
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

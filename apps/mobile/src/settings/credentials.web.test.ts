import { afterEach, expect, it, vi } from 'vitest';
import { saveKey, readKey, deleteKey } from './credentials.web';
afterEach(async () => { await deleteKey(); vi.unstubAllGlobals(); });
it('keeps browser credentials only in memory and supports rotation/deletion', async () => {
  const forbidden = { setItem: () => { throw new Error('must not persist keys'); } };
  vi.stubGlobal('localStorage', forbidden); vi.stubGlobal('sessionStorage', forbidden);
  expect(await readKey()).toBeNull();
  await saveKey('fake-key-1'); expect(await readKey()).toBe('fake-key-1');
  await saveKey('fake-key-2'); expect(await readKey()).toBe('fake-key-2');
  await deleteKey(); expect(await readKey()).toBeNull();
});
it.each(['', '   ', 'contains whitespace', 'x'.repeat(1025)])('rejects invalid keys', async (key) => {
  await expect(saveKey(key)).rejects.toMatchObject({ code: 'invalid-input' });
});

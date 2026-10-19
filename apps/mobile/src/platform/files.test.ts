import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => {
  const files = new Map<string, { text: string; size: number }>();
  const directories = new Set<string>();
  let serial = 0;
  const uri = (parts: (string | { uri: string })[]) => parts.map(part => typeof part === 'string' ? part : part.uri).join('/');
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = uri(parts); }
    get name() { return this.uri.split('/').at(-1)!; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.size ?? 0; }
    text() { return Promise.resolve(files.get(this.uri)!.text); }
    base64() { return this.text(); }
    write(text: string) { files.set(this.uri, { text, size: text.length }); }
    delete() { files.delete(this.uri); }
  }
  class Directory {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) { this.uri = uri(parts); }
    get name() { return this.uri.split('/').at(-1)!; }
    create() { directories.add(this.uri); }
    list() { return [...directories].filter(path => path.startsWith(this.uri + '/')).map(path => new Directory(path)); }
    delete() { directories.delete(this.uri); for (const path of files.keys()) if (path.startsWith(this.uri + '/')) files.delete(path); }
  }
  return { files, directories, File, Directory, pick: vi.fn(), nativeRead: vi.fn(), share: vi.fn(), available: vi.fn(), uuid: () => String(++serial) };
});
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('expo-file-system', () => ({ File: mocks.File, Directory: mocks.Directory, Paths: { cache: 'file:///cache' } }));
vi.mock('expo-sharing', () => ({ shareAsync: mocks.share, isAvailableAsync: mocks.available }));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.uuid }));
vi.mock('@temari/file-read', () => ({ temariFileRead: () => ({ readText: mocks.nativeRead, readBase64: mocks.nativeRead }) }));
import { pickStudyFile, shareText } from './files';
beforeEach(() => {
  mocks.files.clear(); mocks.directories.clear(); vi.clearAllMocks();
  mocks.available.mockResolvedValue(true); mocks.share.mockResolvedValue(undefined);
});
it('reads the SAF document URI through the native reader and never allocates a cache copy', async () => {
  const saf = 'content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2Fsample.json';
  mocks.nativeRead.mockResolvedValue('{"data":[]}');
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: saf, name: 'sample.json', size: 11 }] });
  expect((await pickStudyFile('json'))?.content).toBe('{"data":[]}');
  expect(mocks.pick).toHaveBeenCalledWith(expect.objectContaining({ copyToCacheDirectory: false }));
  expect(mocks.nativeRead).toHaveBeenCalledWith(saf);
  expect(mocks.files.size).toBe(0);
});
it('checks known file size before the native read and unknown size after it', async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://large/document', name: 'large.pdf', size: 2_000_000 }] });
  await expect(pickStudyFile('pdf')).rejects.toThrow('MiB');
  expect(mocks.nativeRead).not.toHaveBeenCalled();
  const base64 = 'A'.repeat(3_000_000); // decodes to 2.25 MB, over PDF_MAX_BYTES (1 MiB)
  mocks.nativeRead.mockResolvedValue(base64);
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://large/document', name: 'large.pdf' }] });
  await expect(pickStudyFile('pdf')).rejects.toThrow('MiB');
  expect(mocks.nativeRead).toHaveBeenCalledTimes(1);
});
it('names the failed read source when the native reader is refused', async () => {
  const saf = 'content://com.android.providers.downloads.documents/document/refused';
  mocks.nativeRead.mockRejectedValue(new Error('SecurityException: no access'));
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: saf, name: 'broken.json', size: 4 }] });
  await expect(pickStudyFile('json')).rejects.toThrow(`read from ${saf} (name=broken.json, size=4) failed — Error: SecurityException: no access`);
});
it('cancelled picking performs no read', async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await pickStudyFile('json')).toBeNull(); expect(mocks.files.size).toBe(0);
});
it('keeps shared bytes available after Android chooser resolves, then prunes expired shares', async () => {
  await shareText('temari-portable.json', 'first');
  const firstUri = mocks.share.mock.calls[0][0];
  expect(mocks.files.get(firstUri)?.text).toBe('first');
  await shareText('temari-portable.json', 'second');
  expect(mocks.share.mock.calls[1][0]).not.toBe(firstUri);
  const old = new mocks.Directory('file:///cache/temari-shares', `${Date.now() - 48 * 3600_000}-old`); old.create();
  new mocks.File(old, 'old.json').write('old');
  await shareText('temari-portable.json', 'third');
  expect(mocks.directories.has(old.uri)).toBe(false);
  expect(mocks.files.get(firstUri)?.text).toBe('first');
});
it('cleans up failed shares without affecting existing exports', async () => {
  mocks.share.mockRejectedValueOnce(new Error('unavailable'));
  await expect(shareText('backup.json', 'data')).rejects.toThrow('unavailable');
  expect(mocks.files.size).toBe(0);
});

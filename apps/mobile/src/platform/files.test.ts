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
  return { files, directories, File, Directory, pick: vi.fn(), pickFile: vi.fn(), nativeRead: vi.fn(), share: vi.fn(), available: vi.fn(), uuid: () => String(++serial) };
});
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('expo-file-system', () => ({ File: Object.assign(mocks.File, { pickFileAsync: mocks.pickFile }), Directory: mocks.Directory, Paths: { cache: 'file:///cache' } }));
vi.mock('expo-sharing', () => ({ shareAsync: mocks.share, isAvailableAsync: mocks.available }));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.uuid }));
vi.mock('@temari/file-read', () => ({ hasNativeReader: () => true, readTextNative: mocks.nativeRead, readBase64Native: mocks.nativeRead }));
import { pickStudyFile, shareText } from './files';
beforeEach(() => {
  mocks.files.clear(); mocks.directories.clear(); vi.clearAllMocks();
  mocks.available.mockResolvedValue(true); mocks.share.mockResolvedValue(undefined);
});
const SAF = (file: string) => `content://com.android.providers.downloads.documents/document/raw%3A%2Fstorage%2Femulated%2F0%2FDownload%2F${file}`;
const SAF_PICK = { canceled: false, result: { uri: SAF('sample.json'), name: 'sample.json', size: 11 } } as const;

it('picks through the SAF picker, landing in Download, and reads via the native reader', async () => {
  mocks.pickFile.mockResolvedValue(SAF_PICK);
  mocks.nativeRead.mockResolvedValue('{"data":[]}');
  expect((await pickStudyFile('json'))?.content).toBe('{"data":[]}');
  expect(mocks.pickFile).toHaveBeenCalledWith(expect.objectContaining({
    initialUri: expect.stringContaining('primary%3ADownload'),
    multipleFiles: false,
  }));
  expect(mocks.nativeRead).toHaveBeenCalledWith(SAF('sample.json'), expect.any(Number));
  expect(mocks.pick).not.toHaveBeenCalled();
});
it('falls back to the document picker when the SAF picker is unavailable', async () => {
  mocks.pickFile.mockRejectedValue(new Error('picker unavailable'));
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: SAF('sample.json'), name: 'sample.json', size: 11 }] });
  mocks.nativeRead.mockResolvedValue('{"data":[]}');
  expect((await pickStudyFile('json'))?.content).toBe('{"data":[]}');
  expect(mocks.pick).toHaveBeenCalledWith(expect.objectContaining({ type: '*/*', copyToCacheDirectory: false }));
  expect(mocks.nativeRead).toHaveBeenCalledWith(SAF('sample.json'), expect.any(Number));
});
it('a cancelled pick on either surface performs no read', async () => {
  mocks.pickFile.mockResolvedValue({ canceled: true, result: null });
  expect(await pickStudyFile('json')).toBeNull();
  expect(mocks.nativeRead).not.toHaveBeenCalled();
  mocks.pickFile.mockRejectedValue(new Error('unavailable'));
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await pickStudyFile('json')).toBeNull();
  expect(mocks.nativeRead).not.toHaveBeenCalled();
});
it('rejects oversized reported sizes before reading and oversized reads halt the chain', async () => {
  mocks.pickFile.mockResolvedValue({ canceled: false, result: { uri: SAF('large.pdf'), name: 'large.pdf', size: 2_000_000 } });
  await expect(pickStudyFile('pdf')).rejects.toThrow('larger than');
  expect(mocks.nativeRead).not.toHaveBeenCalled();
  mocks.pickFile.mockResolvedValue({ canceled: false, result: { uri: SAF('big.json'), name: 'big.json' } });
  mocks.nativeRead.mockRejectedValue(Object.assign(new Error('too large'), { code: 'ERR_TEMARI_TOO_LARGE' }));
  await expect(pickStudyFile('json')).rejects.toThrow('larger than');
  expect(mocks.pick).not.toHaveBeenCalled();
});
it('falls back to the File API when the native reader is refused by Android', async () => {
  const denied = SAF('denied.json');
  mocks.pickFile.mockResolvedValue({ canceled: false, result: { uri: denied, name: 'denied.json', size: 11 } });
  mocks.nativeRead.mockRejectedValue(Object.assign(new Error('SecurityException: no access'), { code: 'ERR_TEMARI_READ_DENIED' }));
  mocks.files.set(denied, { text: '{"data":[]}', size: 11 });
  expect((await pickStudyFile('json'))?.content).toBe('{"data":[]}');
});
it('stages a human failure when every reader fails', async () => {
  const gone = SAF('gone.json');
  mocks.pickFile.mockResolvedValue({ canceled: false, result: { uri: gone, name: 'gone.json', size: 11 } });
  mocks.nativeRead.mockRejectedValue(Object.assign(new Error('FileNotFoundException'), { code: 'ERR_TEMARI_READ_FAILED' }));
  await expect(pickStudyFile('json')).rejects.toThrow('no longer accessible');
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

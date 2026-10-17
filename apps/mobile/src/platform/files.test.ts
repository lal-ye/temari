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
  return { files, directories, File, Directory, pick: vi.fn(), share: vi.fn(), available: vi.fn(), uuid: () => String(++serial) };
});
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('expo-file-system', () => ({ File: mocks.File, Directory: mocks.Directory, Paths: { cache: 'file:///cache' } }));
vi.mock('expo-sharing', () => ({ shareAsync: mocks.share, isAvailableAsync: mocks.available }));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.uuid }));
import { pickStudyFile, shareText } from './files';
beforeEach(() => {
  mocks.files.clear(); mocks.directories.clear(); vi.clearAllMocks();
  mocks.available.mockResolvedValue(true); mocks.share.mockResolvedValue(undefined);
});
it('reads the picker cache copy directly and never touches the original content URI', async () => {
  const original = 'content://com.android.providers.downloads.document/material';
  const cache = 'file:///cache/DocumentPicker/sample.json';
  mocks.files.set(cache, { text: '{"data":[]}', size: 11 });
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: cache, name: 'sample.json', size: 11 }] });
  expect((await pickStudyFile('json'))?.content).toBe('{"data":[]}');
  expect(mocks.pick).toHaveBeenCalledWith(expect.objectContaining({ copyToCacheDirectory: true }));
  expect([...mocks.files.keys()]).toEqual([cache]);
  expect([...mocks.files.keys()]).not.toContain(original);
});
it('checks known file size before reading and unknown size before base64 allocation', async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/DocumentPicker/large.pdf', name: 'large.pdf', size: 2_000_000 }] });
  await expect(pickStudyFile('pdf')).rejects.toThrow('MiB');
  mocks.files.set('file:///cache/DocumentPicker/large.pdf', { text: 'large', size: 2_000_000 });
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///cache/DocumentPicker/large.pdf', name: 'large.pdf' }] });
  await expect(pickStudyFile('pdf')).rejects.toThrow('MiB');
  expect([...mocks.files.keys()].filter(uri => !uri.startsWith('file:///cache/DocumentPicker/'))).toEqual([]);
});
it('names the failed read phase and source when the cache copy cannot be read', async () => {
  const cache = 'file:///cache/DocumentPicker/broken.json';
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: cache, name: 'broken.json', size: 4 }] });
  await expect(pickStudyFile('json')).rejects.toThrow(`read from ${cache} (name=broken.json, size=4) failed`);
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

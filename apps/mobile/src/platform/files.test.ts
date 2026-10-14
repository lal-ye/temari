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
  return { files, directories, File, Directory, pick: vi.fn(), copy: vi.fn(), share: vi.fn(), available: vi.fn(), uuid: () => String(++serial) };
});
vi.mock('expo-document-picker', () => ({ getDocumentAsync: mocks.pick }));
vi.mock('expo-file-system', () => ({ File: mocks.File, Directory: mocks.Directory, Paths: { cache: 'file:///cache' } }));
vi.mock('expo-file-system/legacy', () => ({ copyAsync: mocks.copy }));
vi.mock('expo-sharing', () => ({ shareAsync: mocks.share, isAvailableAsync: mocks.available }));
vi.mock('expo-crypto', () => ({ randomUUID: mocks.uuid }));
import { pickStudyFile, shareText } from './files';
beforeEach(() => {
  mocks.files.clear(); mocks.directories.clear(); vi.clearAllMocks();
  mocks.available.mockResolvedValue(true); mocks.share.mockResolvedValue(undefined);
  mocks.copy.mockImplementation(async ({ from, to }) => { mocks.files.set(to, mocks.files.get(from)!); });
});
it('reads Samsung content URIs via a cache copy and deletes only its own temporary file', async () => {
  const source = 'content://provider/material';
  mocks.files.set(source, { text: '{"data":[]}', size: 11 });
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: source, name: 'sample.json', size: 11 }] });
  expect((await pickStudyFile('json'))?.content).toBe('{"data":[]}');
  expect([...mocks.files.keys()]).toEqual([source]);
});
it('checks known file size before copying and unknown size before base64 allocation', async () => {
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://large', name: 'large.pdf', size: 2_000_000 }] });
  await expect(pickStudyFile('pdf')).rejects.toThrow('MiB');
  expect(mocks.copy).not.toHaveBeenCalled();
  mocks.files.set('content://large', { text: 'large', size: 2_000_000 });
  mocks.pick.mockResolvedValue({ canceled: false, assets: [{ uri: 'content://large', name: 'large.pdf' }] });
  await expect(pickStudyFile('pdf')).rejects.toThrow('MiB');
  expect([...mocks.files.keys()]).toEqual(['content://large']);
});
it('cancelled picking performs no read or copy', async () => {
  mocks.pick.mockResolvedValue({ canceled: true });
  expect(await pickStudyFile('json')).toBeNull(); expect(mocks.copy).not.toHaveBeenCalled();
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

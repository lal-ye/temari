import { describe, expect, it } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { createStudyRepository, createPortableExport } from '@temari/core';
import { createSqliteBackend } from './sqliteBackend.web';
const value = createPortableExport({ data: { subjects: [{ id: 's', name: 'Biology', createdAt: '2026-10-14T00:00:00.000Z' }], notes: [], quizzes: [], attempts: [], tasks: [] }, preferences: { theme: 'light' } });
describe('browser persistence', () => {
  it('persists a complete replace-import across repository restarts', async () => {
    const factory = new IDBFactory();
    const first = await createStudyRepository(createSqliteBackend('test', factory));
    expect(first.listSubjects()).toEqual([]);
    await first.importPortable(value);
    const restarted = await createStudyRepository(createSqliteBackend('test', factory));
    expect(restarted.snapshot()).toEqual(first.snapshot());
    expect(JSON.parse(restarted.exportPortable()).preferences).toEqual({ theme: 'light' });
  });
  it('rejects stale-tab writes atomically and keeps the last committed library', async () => {
    const factory = new IDBFactory();
    const first = await createStudyRepository(createSqliteBackend('test', factory));
    const stale = await createStudyRepository(createSqliteBackend('test', factory));
    await first.importPortable(value);
    await expect(stale.importPortable({ ...value, data: { ...value.data, subjects: [] } })).rejects.toThrow('another tab');
    expect(stale.listSubjects()).toEqual([]);
    const restarted = await createStudyRepository(createSqliteBackend('test', factory));
    expect(restarted.listSubjects()[0].name).toBe('Biology');
  });
  it('recovers from a failed open without wedging the singleton adapter', async () => {
    let fail = true;
    const factory = new IDBFactory();
    const backend = createSqliteBackend('test', { open: (...args: Parameters<IDBFactory['open']>) => {
      if (fail) { fail = false; throw new Error('disk error'); }
      return factory.open(...args);
    } } as IDBFactory);
    await expect(backend.load()).rejects.toThrow('disk error');
    expect(await backend.load()).toBeNull();
  });
});

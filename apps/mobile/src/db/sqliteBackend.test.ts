/**
 * Native SQLite backend tests (M3 plan §7 / D5, M5 checklist items 2–3).
 *
 * The web twin has `sqliteBackend.web.test.ts` against fake-indexeddb. This is
 * the same shape for the production Android path: a fake `expo-sqlite` that
 * keeps rows in memory and can fail an open or a write on demand. That makes
 * the three properties the device checklist leans on testable in CI:
 *   - a complete snapshot round-trips across a fresh backend (restart);
 *   - one `persist` is one transaction, so a failed write leaves the previous
 *     library intact (kill/cancel mid-write, import atomicity);
 *   - a present-but-wrong schema version fails loudly instead of reading as an
 *     empty library.
 * What this cannot prove is Android's own fsync/transaction behaviour on a real
 * device — that stays on the physical checklist.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudySnapshot } from '@temari/core';

const control = vi.hoisted(() => ({
  /** One row map per database name, so a "restart" sees the same bytes. */
  dbs: new Map<string, Map<string, string>>(),
  /** Fail the next `openDatabaseAsync` call. */
  failNextOpen: false,
  /** Fail the Nth `runAsync` call after the counter is reset (0 = never). */
  failWriteOnCall: 0,
  writeCalls: 0,
  /** Writes that happened outside a transaction — must stay 0. */
  writesOutsideTransaction: 0,
  transactionDepth: 0,
}));

vi.mock('expo-sqlite', () => {
  class FakeDatabase {
    constructor(private readonly rows: Map<string, string>) {}

    async execAsync(): Promise<void> {
      // The fake store is always "created"; nothing to do.
    }

    async getFirstAsync(_sql: string, key: string): Promise<{ value: string } | null> {
      const value = this.rows.get(key);
      return value === undefined ? null : { value };
    }

    async runAsync(_sql: string, key: string, value: string): Promise<void> {
      if (control.transactionDepth === 0) {
        control.writesOutsideTransaction += 1;
      }
      control.writeCalls += 1;
      if (control.failWriteOnCall > 0 && control.writeCalls === control.failWriteOnCall) {
        throw new Error('disk full');
      }
      this.rows.set(key, value);
    }

    async withTransactionAsync(fn: () => Promise<void>): Promise<void> {
      const snapshot = new Map(this.rows);
      control.transactionDepth += 1;
      try {
        await fn();
      } catch (error) {
        // Restore the pre-transaction rows: SQLite rolls back, and the whole
        // point of the backend's single transaction is that this is what a
        // reader would see afterwards.
        this.rows.clear();
        for (const [key, value] of snapshot) this.rows.set(key, value);
        throw error;
      } finally {
        control.transactionDepth -= 1;
      }
    }
  }

  return {
    openDatabaseAsync: async (name: string) => {
      if (control.failNextOpen) {
        control.failNextOpen = false;
        throw new Error('disk error');
      }
      let rows = control.dbs.get(name);
      if (!rows) {
        rows = new Map<string, string>();
        control.dbs.set(name, rows);
      }
      return new FakeDatabase(rows);
    },
  };
});

const { createSqliteBackend } = await import('./sqliteBackend');

const snapshot: StudySnapshot = {
  preferences: { theme: 'light' },
  subjects: [{ id: 'subject-1', name: 'Biology', createdAt: '2026-10-14T00:00:00.000Z' }],
  notes: [],
  quizzes: [],
  attempts: [],
  tasks: [],
};

beforeEach(() => {
  control.dbs.clear();
  control.failNextOpen = false;
  control.failWriteOnCall = 0;
  control.writeCalls = 0;
  control.writesOutsideTransaction = 0;
  control.transactionDepth = 0;
});

describe('native SQLite persistence', () => {
  it('treats a database without a schema version as a first boot', async () => {
    expect(await createSqliteBackend('fresh').load()).toBeNull();
  });

  it('round-trips a complete snapshot across a restart', async () => {
    await createSqliteBackend('library').persist(snapshot);
    expect(await createSqliteBackend('library').load()).toEqual(snapshot);
  });

  it('writes the whole snapshot inside one transaction', async () => {
    await createSqliteBackend('library').persist(snapshot);
    // schemaVersion + preferences + five collections.
    expect(control.writeCalls).toBe(7);
    expect(control.writesOutsideTransaction).toBe(0);
    expect(control.transactionDepth).toBe(0);
  });

  it('rolls a failed write back to the previous library', async () => {
    await createSqliteBackend('library').persist(snapshot);
    const changed: StudySnapshot = { ...snapshot, subjects: [{ ...snapshot.subjects[0], name: 'Chemistry' }] };
    control.failWriteOnCall = control.writeCalls + 4;
    await expect(createSqliteBackend('library').persist(changed)).rejects.toThrow('disk full');
    const restarted = await createSqliteBackend('library').load();
    expect(restarted).toEqual(snapshot);
  });

  it('refuses an unknown schema version instead of reading an empty library', async () => {
    control.dbs.set('future', new Map([['schemaVersion', '2']]));
    await expect(createSqliteBackend('future').load()).rejects.toThrow(
      'unsupported schema version "2" (expected "1")',
    );
  });

  it('names a collection that is missing or not valid JSON', async () => {
    control.dbs.set('missing', new Map([
      ['schemaVersion', '1'],
      ['preferences', '{"theme":"system"}'],
    ]));
    await expect(createSqliteBackend('missing').load()).rejects.toThrow('stored collection "subjects" is missing');

    control.dbs.set('corrupt', new Map([
      ['schemaVersion', '1'],
      ['preferences', '{"theme":"system"}'],
      ['subjects', '{not json'],
    ]));
    await expect(createSqliteBackend('corrupt').load()).rejects.toThrow('stored collection "subjects" is not valid JSON');
  });

  it('retries a failed open instead of wedging the cached promise', async () => {
    const backend = createSqliteBackend('flaky');
    control.failNextOpen = true;
    await expect(backend.load()).rejects.toThrow('disk error');
    expect(await backend.load()).toBeNull();
  });
});

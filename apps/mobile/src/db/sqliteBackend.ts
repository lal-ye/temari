/**
 * SQLite StudyBackend — the production persistence adapter for the Expo app.
 *
 * M3 plan §7 / D5 (apps/mobile owns the SQLite backend; `packages/core`
 * owns the `StudyBackend` seam and the repository coordinator). Follows the
 * §M3 scope authority: versioned JSON collections in SQLite are acceptable —
 * no big normalized schema. Each of the five library collections is stored
 * as one JSON document in a `kv` table next to a `schemaVersion` row, and
 * every `persist` writes all rows inside a single SQLite transaction, so a
 * failed or cancelled write can never leave a half-replaced library behind
 * (the "import cancellation never wipes old library" gate line).
 *
 * The coordinator treats snapshots as immutable and the whole snapshot is
 * bounded by PORTABLE_LIMITS (4 MiB), so one-document-per-collection stays
 * small. First boot (no `schemaVersion` row) resolves `load()` to `null`
 * and the coordinator starts empty. A present-but-unknown schema version
 * throws loudly instead of being silently dropped, so a future migration
 * is a deliberate decision, not an accident.
 */
import * as SQLite from 'expo-sqlite';
import type {
  StoredAttempt,
  StoredNote,
  StoredQuiz,
  StudyBackend,
  StudySnapshot,
  StudyTask,
  Subject,
} from '@temari/core';

/** Current on-disk schema. Bump only alongside a deliberate migration. */
const SCHEMA_VERSION = 1;

const VERSION_KEY = 'schemaVersion';

/** The five library collections, stored one JSON document per key. */
const COLLECTION_KEYS = ['subjects', 'notes', 'quizzes', 'attempts', 'tasks'] as const;

type CollectionKey = (typeof COLLECTION_KEYS)[number];

const DEFAULT_DB_NAME = 'temari-library.db';

/**
 * Create a `StudyBackend` over an expo-sqlite database file. The database
 * is opened lazily on first use (never at import time) and schema setup
 * runs before any read or write. A failed open resets the cached promise
 * so the next call retries instead of wedging on a rejection.
 */
export function createSqliteBackend(dbName: string = DEFAULT_DB_NAME): StudyBackend {
  let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

  async function openAndMigrate(): Promise<SQLite.SQLiteDatabase> {
    const db = await SQLite.openDatabaseAsync(dbName);
    await db.execAsync('CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    return db;
  }

  function getDb(): Promise<SQLite.SQLiteDatabase> {
    if (!dbPromise) {
      dbPromise = openAndMigrate().catch((error: unknown) => {
        dbPromise = null;
        throw error;
      });
    }
    return dbPromise;
  }

  async function readCollection<T>(db: SQLite.SQLiteDatabase, key: CollectionKey): Promise<T[]> {
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM kv WHERE key = ?', key);
    if (!row) {
      throw new Error(`sqliteBackend: stored collection "${key}" is missing`);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      throw new Error(`sqliteBackend: stored collection "${key}" is not valid JSON`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`sqliteBackend: stored collection "${key}" is not an array`);
    }
    return parsed as T[];
  }

  async function load(): Promise<StudySnapshot | null> {
    const db = await getDb();
    const versionRow = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM kv WHERE key = ?',
      VERSION_KEY,
    );
    if (!versionRow) {
      return null;
    }
    if (versionRow.value !== String(SCHEMA_VERSION)) {
      throw new Error(
        `sqliteBackend: unsupported schema version "${versionRow.value}" (expected "${SCHEMA_VERSION}")`,
      );
    }
    return {
      subjects: await readCollection<Subject>(db, 'subjects'),
      notes: await readCollection<StoredNote>(db, 'notes'),
      quizzes: await readCollection<StoredQuiz>(db, 'quizzes'),
      attempts: await readCollection<StoredAttempt>(db, 'attempts'),
      tasks: await readCollection<StudyTask>(db, 'tasks'),
    };
  }

  async function persist(snapshot: StudySnapshot): Promise<void> {
    const db = await getDb();
    const entries: Array<[CollectionKey | typeof VERSION_KEY, string]> = [
      [VERSION_KEY, String(SCHEMA_VERSION)],
      ['subjects', JSON.stringify(snapshot.subjects)],
      ['notes', JSON.stringify(snapshot.notes)],
      ['quizzes', JSON.stringify(snapshot.quizzes)],
      ['attempts', JSON.stringify(snapshot.attempts)],
      ['tasks', JSON.stringify(snapshot.tasks)],
    ];
    await db.withTransactionAsync(async () => {
      for (const [key, value] of entries) {
        await db.runAsync('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', key, value);
      }
    });
  }

  return { load, persist };
}

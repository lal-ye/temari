/**
 * Web stub for the SQLite StudyBackend (M3 plan §7).
 *
 * expo-sqlite's web worker needs a wasm asset setup that Metro cannot
 * bundle out of the box, and M3's library persistence targets the
 * Android app (the import screen shows a notice on web instead). Metro
 * resolves this platform file on web, so `expo-sqlite` never enters the
 * web bundle graph; the Android build keeps the real backend. Any
 * accidental web use fails loudly instead of pretending to persist.
 */
import type { StudyBackend } from '@temari/core';

async function unavailable(): Promise<never> {
  throw new Error('sqliteBackend is not available on web — library storage is Android-only in M3');
}

export function createSqliteBackend(dbName?: string): StudyBackend {
  void dbName;
  return { load: unavailable, persist: unavailable };
}

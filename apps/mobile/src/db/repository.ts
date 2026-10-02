/**
 * App-wide StudyRepository singleton (M3 plan §7).
 *
 * One repository per app lifetime, built over the SQLite backend on first
 * use. Screens call `getStudyRepository()` and share the same in-RAM
 * snapshot — no per-screen state copies (ADR-0001). The memoized promise
 * also dedupes concurrent first calls during startup into a single open.
 */
import { createStudyRepository, type StudyRepository } from '@temari/core';
import { createSqliteBackend } from './sqliteBackend';

let repositoryPromise: Promise<StudyRepository> | null = null;

export function getStudyRepository(): Promise<StudyRepository> {
  if (!repositoryPromise) {
    repositoryPromise = createStudyRepository(createSqliteBackend());
  }
  return repositoryPromise;
}

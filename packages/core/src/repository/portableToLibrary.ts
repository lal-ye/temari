import type { StoredAttempt, StoredNote, StoredQuiz, StudyTask, Subject } from '../types';
import type { PortableExport } from '../portable';
import type { StudySnapshot } from './studyRepository';

/**
 * Pure Portable → library conversion (M3 plan §6): deep copy, imported IDs
 * verbatim. The Portable* field names are frozen contract (plan §6: the v1
 * format is not rewritten), and they mirror the Stored* shapes field for
 * field — so conversion is a JSON deep copy re-typed at this boundary.
 * Input must already be a **validated** PortableExport; no re-validation
 * happens here. The deep copy guarantees the repository never aliases the
 * importer's object graph.
 */
export function portableToLibrary(value: PortableExport): StudySnapshot {
  const data = value.data;
  return {
    subjects: deepCopy(data.subjects),
    notes: deepCopy(data.notes),
    quizzes: deepCopy(data.quizzes),
    attempts: deepCopy(data.attempts),
    tasks: deepCopy(data.tasks),
  };
}

/** JSON round-trip: snapshots are JSON-safe by construction (they arrive from JSON). */
function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

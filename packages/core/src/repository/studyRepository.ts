import type {
  StoredAttempt,
  StoredNote,
  StoredQuiz,
  StudyTask,
  Subject,
} from '../types';
import type { PortableCounts, PortableExport } from '../portable';
import { portableCounts } from '../portable';
import { portableToLibrary } from './portableToLibrary';

/**
 * The whole library in RAM. Carries **every** portable data collection —
 * subjects, notes, quizzes, attempts, tasks — even the ones no M3 screen
 * renders, because the re-export round-trip (M3 plan §6, D7) must not lose
 * imported data. Articles travel inside `attempts[].extraReadings` —
 * Portable v1 field names are frozen contract.
 */
export interface StudySnapshot {
  subjects: Subject[];
  notes: StoredNote[];
  quizzes: StoredQuiz[];
  attempts: StoredAttempt[];
  tasks: StudyTask[];
}

/** One Library row: the Subject plus the counts the list screen shows. */
export interface SubjectSummary extends Subject {
  noteCount: number;
  quizCount: number;
}

/**
 * The persistence seam (ADR-0001's StorageAdapter role, async per the M3
 * plan: an async repository, not an async wrapper of the old sync store).
 * Exactly two adapters exist: the in-memory test backend and the SQLite
 * backend in apps/mobile. `persist` must be atomic in production and may
 * throw — a disk-write failure surfaces as a rejected promise.
 */
export interface StudyBackend {
  load(): Promise<StudySnapshot | null>;
  persist(snapshot: StudySnapshot): Promise<void>;
}

export interface StudyRepository {
  listSubjects(): SubjectSummary[];
  getSubject(subjectId: string): Subject | null;
  listNotes(subjectId: string): StoredNote[];
  listQuizzes(subjectId: string): StoredQuiz[];
  getNote(subjectId: string, noteId: string): StoredNote | null;
  getQuiz(subjectId: string, quizId: string): StoredQuiz | null;
  /** Subject's Attempts, newest first (new records prepend; imported order is preserved). */
  listAttempts(subjectId: string): StoredAttempt[];
  /** The loaded snapshot. Reads hand out the live object; writes replace it wholesale. */
  snapshot(): StudySnapshot;
  /** Replace-all import. Either the whole library swaps or nothing changes (M3 plan §6). */
  importPortable(value: PortableExport): Promise<PortableCounts>;
  /**
   * One operation (D8): prepend the Attempt and bump the Quiz's
   * `lastScore`/`timesPracticed`. Persists as a single snapshot write, so a
   * crash can never leave half the finish behind.
   */
  recordDrillFinish(attempt: StoredAttempt, quizId: string): Promise<void>;
}

const EMPTY_SNAPSHOT: StudySnapshot = {
  subjects: [],
  notes: [],
  quizzes: [],
  attempts: [],
  tasks: [],
};

export async function createStudyRepository(backend: StudyBackend): Promise<StudyRepository> {
  const loaded = await backend.load();
  let current: StudySnapshot = loaded ?? EMPTY_SNAPSHOT;

  // Writes serialize through a tail promise: one persist in flight at a time,
  // later writes wait for earlier ones, failures don't wedge the queue.
  let writeTail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const run = writeTail.then(operation, operation);
    writeTail = run.catch(() => undefined);
    return run;
  }

  return {
    listSubjects() {
      return current.subjects.map((subject) => ({
        ...subject,
        noteCount: current.notes.filter((note) => note.subjectId === subject.id).length,
        quizCount: current.quizzes.filter((quiz) => quiz.subjectId === subject.id).length,
      }));
    },
    getSubject(subjectId) {
      return current.subjects.find((subject) => subject.id === subjectId) ?? null;
    },
    listNotes(subjectId) {
      return current.notes.filter((note) => note.subjectId === subjectId);
    },
    listQuizzes(subjectId) {
      return current.quizzes.filter((quiz) => quiz.subjectId === subjectId);
    },
    getNote(subjectId, noteId) {
      return (
        current.notes.find(
          (note) => note.subjectId === subjectId && note.id === noteId,
        ) ?? null
      );
    },
    getQuiz(subjectId, quizId) {
      return (
        current.quizzes.find(
          (quiz) => quiz.subjectId === subjectId && quiz.id === quizId,
        ) ?? null
      );
    },
    listAttempts(subjectId) {
      return current.attempts.filter((attempt) => attempt.subjectId === subjectId);
    },
    snapshot() {
      return current;
    },
    importPortable(value) {
      return enqueue(async () => {
        const next = portableToLibrary(value);
        await backend.persist(next);
        current = next;
        return portableCounts(value);
      });
    },
    recordDrillFinish(attempt, quizId) {
      return enqueue(async () => {
        const quiz = current.quizzes.find((candidate) => candidate.id === quizId);
        if (!quiz) {
          throw new Error(`recordDrillFinish: quiz ${quizId} not found`);
        }
        const next: StudySnapshot = {
          ...current,
          attempts: [attempt, ...current.attempts],
          quizzes: current.quizzes.map((candidate) =>
            candidate.id === quizId
              ? {
                  ...candidate,
                  lastScore: attempt.overallScore,
                  timesPracticed: (candidate.timesPracticed ?? 0) + 1,
                }
              : candidate,
          ),
        };
        await backend.persist(next);
        current = next;
      });
    },
  };
}

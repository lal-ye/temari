import { useSyncExternalStore } from 'react';
import {
  Subject,
  StoredNote,
  StoredQuiz,
  StoredAttempt,
  StudyTask,
  UserSettings,
} from '../types';
import { getStudyStore, StudyStore } from '../services/studyStore';

/**
 * React glue for the Study-Store module (see services/studyStore.ts).
 *
 * The store is a plain mutable module; these hooks subscribe a component to a
 * change counter so it re-renders when any store collection changes, then read
 * the store's stable collection references. Collection arrays are only
 * replaced when their data actually changes, which keeps downstream useMemo
 * dependencies stable — the property the recent memoization merges were after.
 */

export const studyStore: StudyStore = getStudyStore();

const store = studyStore;

// --- change-counter subscription bridge ---------------------------------
let version = 0;
const externalListeners = new Set<() => void>();

store.subscribe(() => {
  version++;
  externalListeners.forEach((fn) => fn());
});

function subscribe(listener: () => void): () => void {
  externalListeners.add(listener);
  return () => {
    externalListeners.delete(listener);
  };
}

const getVersion = () => version;

/** Re-render whenever the store changes. */
export function useStoreVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, getVersion);
}

/** The current active subject object (falls back to the first subject). */
export function useActiveSubject(): Subject | null {
  useStoreVersion();
  const activeId = store.activeSubjectId;
  return store.subjects.find((s) => s.id === activeId) || store.subjects[0] || null;
}

export function useActiveSubjectId(): string | null {
  useStoreVersion();
  return store.activeSubjectId;
}

export function useSubjects(): Subject[] {
  useStoreVersion();
  return store.subjects;
}

/** Notes belonging to the active subject. */
export function useNotes(): StoredNote[] {
  useStoreVersion();
  const activeId = store.activeSubjectId;
  return store.notes.filter((n) => n.subjectId === activeId);
}

/** Quizzes belonging to the active subject. */
export function useQuizzes(): StoredQuiz[] {
  useStoreVersion();
  const activeId = store.activeSubjectId;
  return store.quizzes.filter((q) => q.subjectId === activeId);
}

/** Attempts belonging to the active subject. */
export function useAttempts(): StoredAttempt[] {
  useStoreVersion();
  const activeId = store.activeSubjectId;
  return store.attempts.filter((a) => a.subjectId === activeId);
}

/** All attempts across subjects (Analytics + Planner need the full history). */
export function useAllAttempts(): StoredAttempt[] {
  useStoreVersion();
  return store.attempts;
}

/** All study tasks across subjects. */
export function useTasks(): StudyTask[] {
  useStoreVersion();
  return store.tasks;
}

export function useSettings(): UserSettings {
  useStoreVersion();
  return store.settings;
}

/** Stable reference to the store itself — callers can use actions off it. */
export function useStudyStore(): StudyStore {
  useStoreVersion();
  return store;
}

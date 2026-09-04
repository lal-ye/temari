import {
  Subject,
  StoredNote,
  StoredQuiz,
  StoredAttempt,
  StudyTask,
  UserSettings,
} from '../types';
import {
  STORAGE_KEYS,
  DEFAULT_SETTINGS,
  SEED_SUBJECTS,
  SEED_NOTES,
  SEED_QUIZZES,
  SEED_ATTEMPTS,
  SEED_TASKS,
} from './seedData';

/**
 * Internal persistence seam of the Study-Store module.
 *
 * The store exposes only its state + operations; persistence behind this
 * interface is invisible to callers. Two adapters exist — localStorage (the
 * app) and in-memory (tests) — so this is a real seam, but it is private to
 * the module and not part of the store's public interface.
 */
export interface StorageAdapter {
  readSubjects(): Subject[];
  readNotes(): StoredNote[];
  readQuizzes(): StoredQuiz[];
  readAttempts(): StoredAttempt[];
  readTasks(): StudyTask[];
  readSettings(): UserSettings;
  writeSubjects(subjects: Subject[]): void;
  writeNotes(notes: StoredNote[]): void;
  writeQuizzes(quizzes: StoredQuiz[]): void;
  writeAttempts(attempts: StoredAttempt[]): void;
  writeTasks(tasks: StudyTask[]): void;
  writeSettings(settings: UserSettings): void;
  clear(): void;
  /** Subscribe to writes made in *other* tabs / adapter instances. */
  subscribe(listener: () => void): () => void;
  seedSubjects(): Subject[];
  seedNotes(): StoredNote[];
  seedQuizzes(): StoredQuiz[];
  seedAttempts(): StoredAttempt[];
  seedTasks(): StudyTask[];
  seedSettings(): UserSettings;
}

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function readJson<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/** Production adapter: localStorage with seed defaults + cross-tab events. */
export function createLocalStorageAdapter(): StorageAdapter {
  return {
    readSubjects() {
      const data = readJson<Subject[]>(STORAGE_KEYS.SUBJECTS);
      if (data) return data;
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(SEED_SUBJECTS));
      return SEED_SUBJECTS;
    },
    readNotes() {
      const data = readJson<StoredNote[]>(STORAGE_KEYS.NOTES);
      if (data) return data;
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(SEED_NOTES));
      return SEED_NOTES;
    },
    readQuizzes() {
      const data = readJson<StoredQuiz[]>(STORAGE_KEYS.QUIZZES);
      if (data) return data;
      localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(SEED_QUIZZES));
      return SEED_QUIZZES;
    },
    readAttempts() {
      const data = readJson<StoredAttempt[]>(STORAGE_KEYS.ATTEMPTS);
      if (data) return data;
      localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(SEED_ATTEMPTS));
      return SEED_ATTEMPTS;
    },
    readTasks() {
      const data = readJson<StudyTask[]>(STORAGE_KEYS.TASKS);
      if (data) return data;
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(SEED_TASKS));
      return SEED_TASKS;
    },
    readSettings() {
      const data = readJson<Partial<UserSettings>>(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...data } : { ...DEFAULT_SETTINGS };
    },
    writeSubjects(subjects) {
      localStorage.setItem(STORAGE_KEYS.SUBJECTS, JSON.stringify(subjects));
    },
    writeNotes(notes) {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(notes));
    },
    writeQuizzes(quizzes) {
      localStorage.setItem(STORAGE_KEYS.QUIZZES, JSON.stringify(quizzes));
    },
    writeAttempts(attempts) {
      localStorage.setItem(STORAGE_KEYS.ATTEMPTS, JSON.stringify(attempts));
    },
    writeTasks(tasks) {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    },
    writeSettings(settings) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    },
    clear() {
      Object.values(STORAGE_KEYS).forEach((key) => localStorage.removeItem(key));
    },
    subscribe(listener) {
      window.addEventListener('storage', listener);
      return () => window.removeEventListener('storage', listener);
    },
    seedSubjects: () => clone(SEED_SUBJECTS),
    seedNotes: () => clone(SEED_NOTES),
    seedQuizzes: () => clone(SEED_QUIZZES),
    seedAttempts: () => clone(SEED_ATTEMPTS),
    seedTasks: () => clone(SEED_TASKS),
    seedSettings: () => ({ ...DEFAULT_SETTINGS }),
  };
}

/** In-memory adapter for tests (and any future SSR). */
export function createMemoryStorageAdapter(): StorageAdapter {
  const buckets: Record<string, string> = {};
  const listeners = new Set<() => void>();

  const emit = () => listeners.forEach((fn) => fn());

  return {
    readSubjects: () => readJsonBucket<Subject[]>(buckets, STORAGE_KEYS.SUBJECTS) ?? clone(SEED_SUBJECTS),
    readNotes: () => readJsonBucket<StoredNote[]>(buckets, STORAGE_KEYS.NOTES) ?? clone(SEED_NOTES),
    readQuizzes: () => readJsonBucket<StoredQuiz[]>(buckets, STORAGE_KEYS.QUIZZES) ?? clone(SEED_QUIZZES),
    readAttempts: () => readJsonBucket<StoredAttempt[]>(buckets, STORAGE_KEYS.ATTEMPTS) ?? clone(SEED_ATTEMPTS),
    readTasks: () => readJsonBucket<StudyTask[]>(buckets, STORAGE_KEYS.TASKS) ?? clone(SEED_TASKS),
    readSettings: () => {
      const data = readJsonBucket<Partial<UserSettings>>(buckets, STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...data } : { ...DEFAULT_SETTINGS };
    },
    writeSubjects: (subjects) => writeJsonBucket(buckets, STORAGE_KEYS.SUBJECTS, subjects),
    writeNotes: (notes) => writeJsonBucket(buckets, STORAGE_KEYS.NOTES, notes),
    writeQuizzes: (quizzes) => writeJsonBucket(buckets, STORAGE_KEYS.QUIZZES, quizzes),
    writeAttempts: (attempts) => writeJsonBucket(buckets, STORAGE_KEYS.ATTEMPTS, attempts),
    writeTasks: (tasks) => writeJsonBucket(buckets, STORAGE_KEYS.TASKS, tasks),
    writeSettings: (settings) => writeJsonBucket(buckets, STORAGE_KEYS.SETTINGS, settings),
    clear: () => {
      Object.keys(buckets).forEach((k) => delete buckets[k]);
      emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    seedSubjects: () => clone(SEED_SUBJECTS),
    seedNotes: () => clone(SEED_NOTES),
    seedQuizzes: () => clone(SEED_QUIZZES),
    seedAttempts: () => clone(SEED_ATTEMPTS),
    seedTasks: () => clone(SEED_TASKS),
    seedSettings: () => ({ ...DEFAULT_SETTINGS }),
  };
}

function readJsonBucket<T>(buckets: Record<string, string>, key: string): T | null {
  const raw = buckets[key];
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonBucket(buckets: Record<string, string>, key: string, value: unknown): void {
  buckets[key] = JSON.stringify(value);
}

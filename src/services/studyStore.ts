import {
  Subject,
  StoredNote,
  StoredQuiz,
  StoredAttempt,
  StudyTask,
  UserSettings,
} from '../types';
import { createLocalStorageAdapter, StorageAdapter } from './storageAdapters';

/**
 * Study-Store module
 * ------------------
 * One deep module owning all study data: persistence, reactive in-memory
 * state, subject scoping, cascading deletes, and cross-tab sync.
 *
 * Public interface (keep small):
 *   - data      : subjects, notes, quizzes, attempts, tasks, settings,
 *                 activeSubjectId
 *   - subject   : selectSubject, addSubject, updateSubject, deleteSubject
 *                 (deleteSubject owns the 5-way cascade)
 *   - notes     : addNote, updateNote, deleteNote
 *   - quizzes   : addQuiz, updateQuiz, deleteQuiz
 *   - attempts  : recordAttempt (single op for Quiz AND Exam), deleteAttempt
 *   - tasks     : addTask, updateTask, deleteTask
 *   - settings  : saveSettings, exportAllData, importAllData, resetToDefaults
 *
 * Persistence sits behind an internal seam (StorageAdapter): localStorage for
 * the app, in-memory for tests. The seam is real (two adapters) but private —
 * it is not part of this module's public interface.
 *
 * Collection references are stable: they are only replaced when their data
 * changes, so callers can safely useMemo on them.
 */

export interface StudyStore {
  readonly subjects: Subject[];
  readonly notes: StoredNote[];
  readonly quizzes: StoredQuiz[];
  readonly attempts: StoredAttempt[];
  readonly tasks: StudyTask[];
  readonly settings: UserSettings;
  readonly activeSubjectId: string | null;

  selectSubject: (id: string) => void;
  addSubject: (
    nameOrObj: string | { name: string; amharicName?: string; description?: string; code?: string; color?: string }
  ) => Subject;
  updateSubject: (id: string, updates: Partial<Subject>) => Subject | null;
  deleteSubject: (id: string) => void;

  addNote: (note: Omit<StoredNote, 'id' | 'subjectId' | 'createdAt' | 'updatedAt'>) => StoredNote;
  updateNote: (id: string, updates: Partial<StoredNote>) => StoredNote | null;
  deleteNote: (id: string) => void;

  addQuiz: (quiz: Omit<StoredQuiz, 'id' | 'subjectId' | 'createdAt' | 'updatedAt'>) => StoredQuiz;
  updateQuiz: (id: string, updates: Partial<StoredQuiz>) => StoredQuiz | null;
  deleteQuiz: (id: string) => void;

  /** Single record operation for both quiz drills and exam submissions. */
  recordAttempt: (attempt: Omit<StoredAttempt, 'id' | 'date'>) => StoredAttempt;
  deleteAttempt: (id: string) => void;

  addTask: (task: Omit<StudyTask, 'id' | 'createdAt'>) => StudyTask;
  updateTask: (id: string, updates: Partial<StudyTask>) => StudyTask | null;
  deleteTask: (id: string) => void;

  saveSettings: (settings: Partial<UserSettings>) => UserSettings;
  exportAllData: () => string;
  importAllData: (jsonString: string) => boolean;
  resetToDefaults: () => void;

  /**
   * @internal Subscribe to any store change. Used by the React glue and by
   * store-level tests; not part of the public domain interface.
   */
  subscribe(listener: () => void): () => void;
}

export function createStudyStore(adapter: StorageAdapter): StudyStore {
  let subjects: Subject[] = [];
  let notes: StoredNote[] = [];
  let quizzes: StoredQuiz[] = [];
  let attempts: StoredAttempt[] = [];
  let tasks: StudyTask[] = [];
  let settings: UserSettings = adapter.readSettings();
  let activeSubjectId: string | null = null;

  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  const readAll = () => {
    subjects = adapter.readSubjects();
    notes = adapter.readNotes();
    quizzes = adapter.readQuizzes();
    attempts = adapter.readAttempts();
    tasks = adapter.readTasks();
    settings = adapter.readSettings();
    if (!activeSubjectId || !subjects.some((s) => s.id === activeSubjectId)) {
      activeSubjectId = subjects[0]?.id ?? null;
    }
  };

  readAll();

  // Cross-tab sync: writes made in another tab refresh this tab's state.
  const unsubscribeCrossTab =
    typeof window !== 'undefined'
      ? adapter.subscribe(() => {
          readAll();
          notify();
        })
      : () => {};

  const persistSubjects = (next: Subject[]) => {
    subjects = next;
    adapter.writeSubjects(next);
    notify();
  };
  const persistNotes = (next: StoredNote[]) => {
    notes = next;
    adapter.writeNotes(next);
    notify();
  };
  const persistQuizzes = (next: StoredQuiz[]) => {
    quizzes = next;
    adapter.writeQuizzes(next);
    notify();
  };
  const persistAttempts = (next: StoredAttempt[]) => {
    attempts = next;
    adapter.writeAttempts(next);
    notify();
  };
  const persistTasks = (next: StudyTask[]) => {
    tasks = next;
    adapter.writeTasks(next);
    notify();
  };
  const persistSettings = (next: UserSettings) => {
    settings = next;
    adapter.writeSettings(next);
    notify();
  };

  const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

  return {
    // Data (live references — replaced only when the data changes)
    get subjects() {
      return subjects;
    },
    get notes() {
      return notes;
    },
    get quizzes() {
      return quizzes;
    },
    get attempts() {
      return attempts;
    },
    get tasks() {
      return tasks;
    },
    get settings() {
      return settings;
    },
    get activeSubjectId() {
      return activeSubjectId;
    },

    // --- Subjects ---
    selectSubject: (id) => {
      if (subjects.some((s) => s.id === id) && id !== activeSubjectId) {
        activeSubjectId = id;
        notify();
      }
    },

    addSubject: (nameOrObj) => {
      let name = '';
      let amharicName: string | undefined;
      let description: string | undefined;
      let code: string | undefined;
      let color = '#0d9488';
      if (typeof nameOrObj === 'object') {
        name = nameOrObj.name;
        amharicName = nameOrObj.amharicName;
        description = nameOrObj.description;
        code = nameOrObj.code;
        color = nameOrObj.color || '#0d9488';
      } else {
        name = nameOrObj;
      }
      const subj: Subject = {
        id: `subj-${Date.now()}`,
        name: name.trim(),
        amharicName: amharicName?.trim(),
        description: description?.trim(),
        code: code?.trim(),
        color,
        createdAt: new Date().toISOString(),
      };
      persistSubjects([subj, ...subjects]);
      activeSubjectId = subj.id;
      notify();
      return subj;
    },

    updateSubject: (id, updates) => {
      const idx = subjects.findIndex((s) => s.id === id);
      if (idx === -1) return null;
      const updated = { ...subjects[idx], ...updates, updatedAt: new Date().toISOString() };
      const next = [...subjects];
      next[idx] = updated;
      persistSubjects(next);
      return updated;
    },

    deleteSubject: (id) => {
      persistSubjects(subjects.filter((s) => s.id !== id));
      // Cascading deletes live here so no caller can delete a subject and
      // leave orphaned notes/quizzes/attempts/tasks behind.
      persistNotes(notes.filter((n) => n.subjectId !== id));
      persistQuizzes(quizzes.filter((q) => q.subjectId !== id));
      persistAttempts(attempts.filter((a) => a.subjectId !== id));
      persistTasks(tasks.filter((t) => t.subjectId !== id));
      if (activeSubjectId === id) {
        activeSubjectId = subjects[0]?.id ?? null;
      }
    },

    // --- Notes ---
    addNote: (note) => {
      const now = new Date().toISOString();
      const created: StoredNote = {
        ...note,
        id: `note-${Date.now()}`,
        subjectId: activeSubjectId ?? '',
        createdAt: now,
        updatedAt: now,
      };
      persistNotes([created, ...notes]);
      return created;
    },
    updateNote: (id, updates) => {
      const idx = notes.findIndex((n) => n.id === id);
      if (idx === -1) return null;
      const updated = { ...notes[idx], ...updates, updatedAt: new Date().toISOString() };
      const next = [...notes];
      next[idx] = updated;
      persistNotes(next);
      return updated;
    },
    deleteNote: (id) => {
      persistNotes(notes.filter((n) => n.id !== id));
    },

    // --- Quizzes ---
    addQuiz: (quiz) => {
      const now = new Date().toISOString();
      const created: StoredQuiz = {
        ...quiz,
        id: `quiz-${Date.now()}`,
        subjectId: activeSubjectId ?? '',
        createdAt: now,
        updatedAt: now,
        timesPracticed: 0,
      };
      persistQuizzes([created, ...quizzes]);
      return created;
    },
    updateQuiz: (id, updates) => {
      const idx = quizzes.findIndex((q) => q.id === id);
      if (idx === -1) return null;
      const updated = { ...quizzes[idx], ...updates, updatedAt: new Date().toISOString() };
      const next = [...quizzes];
      next[idx] = updated;
      persistQuizzes(next);
      return updated;
    },
    deleteQuiz: (id) => {
      persistQuizzes(quizzes.filter((q) => q.id !== id));
    },

    // --- Attempts ---
    recordAttempt: (attempt) => {
      const created: StoredAttempt = {
        ...attempt,
        id: `att-${Date.now()}`,
        date: new Date().toISOString(),
      };
      persistAttempts([created, ...attempts]);
      return created;
    },
    deleteAttempt: (id) => {
      persistAttempts(attempts.filter((a) => a.id !== id));
    },

    // --- Tasks ---
    addTask: (task) => {
      const created: StudyTask = {
        ...task,
        id: `task-${Date.now()}`,
        createdAt: new Date().toISOString(),
      };
      persistTasks([created, ...tasks]);
      return created;
    },
    updateTask: (id, updates) => {
      const idx = tasks.findIndex((t) => t.id === id);
      if (idx === -1) return null;
      const updated = { ...tasks[idx], ...updates };
      const next = [...tasks];
      next[idx] = updated;
      persistTasks(next);
      return updated;
    },
    deleteTask: (id) => {
      persistTasks(tasks.filter((t) => t.id !== id));
    },

    // --- Settings ---
    saveSettings: (updates) => {
      const updated = { ...settings, ...updates };
      persistSettings(updated);
      return { ...updated };
    },

    // --- Export / Import Backup ---
    exportAllData: () => {
      const backup = {
        version: 1,
        timestamp: new Date().toISOString(),
        subjects: clone(subjects),
        notes: clone(notes),
        quizzes: clone(quizzes),
        attempts: clone(attempts),
        tasks: clone(tasks),
        settings: { ...settings },
      };
      return JSON.stringify(backup, null, 2);
    },
    importAllData: (jsonString) => {
      try {
        const data = JSON.parse(jsonString);
        if (data.subjects) persistSubjects(data.subjects);
        if (data.notes) persistNotes(data.notes);
        if (data.quizzes) persistQuizzes(data.quizzes);
        if (data.attempts) persistAttempts(data.attempts);
        if (data.tasks) persistTasks(data.tasks);
        if (data.settings) persistSettings({ ...settings, ...data.settings });
        return true;
      } catch (e) {
        console.error('Failed to import backup data:', e);
        return false;
      }
    },

    resetToDefaults: () => {
      adapter.clear();
      const seedSubjects = adapter.seedSubjects();
      const seedNotes = adapter.seedNotes();
      const seedQuizzes = adapter.seedQuizzes();
      const seedAttempts = adapter.seedAttempts();
      const seedTasks = adapter.seedTasks();
      const seedSettings = adapter.seedSettings();
      adapter.writeSubjects(seedSubjects);
      adapter.writeNotes(seedNotes);
      adapter.writeQuizzes(seedQuizzes);
      adapter.writeAttempts(seedAttempts);
      adapter.writeTasks(seedTasks);
      adapter.writeSettings(seedSettings);
      subjects = seedSubjects;
      notes = seedNotes;
      quizzes = seedQuizzes;
      attempts = seedAttempts;
      tasks = seedTasks;
      settings = seedSettings;
      activeSubjectId = seedSubjects[0]?.id ?? null;
      notify();
    },

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}

/**
 * App-wide singleton backed by localStorage. Keep this the only instance the
 * UI touches — slice hooks (useStudyStore) subscribe to it. Created lazily so
 * importing the module (e.g. in a node test env) does not touch localStorage.
 */
let singleton: StudyStore | null = null;

export function getStudyStore(): StudyStore {
  if (!singleton) {
    singleton = createStudyStore(createLocalStorageAdapter());
  }
  return singleton;
}

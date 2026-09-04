import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStudyStore, StudyStore } from './studyStore';
import { createMemoryStorageAdapter } from './storageAdapters';
import { SEED_SUBJECTS, SEED_NOTES, SEED_QUIZZES, SEED_ATTEMPTS, SEED_TASKS } from './seedData';

/**
 * Store-level tests: the interface is the test surface. These describe
 * observable behaviour of the Study-Store module (subject scoping, cascade
 * deletes, notifications, backups) — not its internal persistence shape, so
 * they survive internal refactors.
 */

const BIO_ID = 'subj-cell-bio';
const CS_ID = 'subj-comp-sci';

function makeStore(): StudyStore {
  return createStudyStore(createMemoryStorageAdapter());
}

describe('studyStore', () => {
  let store: StudyStore;

  beforeEach(() => {
    store = makeStore();
  });

  it('loads seeded data and activates the first subject', () => {
    expect(store.subjects.map((s) => s.id)).toEqual(SEED_SUBJECTS.map((s) => s.id));
    expect(store.activeSubjectId).toBe(BIO_ID);
    expect(store.notes.length).toBe(SEED_NOTES.length);
    expect(store.quizzes.length).toBe(SEED_QUIZZES.length);
    expect(store.attempts.length).toBe(SEED_ATTEMPTS.length);
    expect(store.tasks.length).toBe(SEED_TASKS.length);
  });

  it('exposes stable collection references between unrelated renders', () => {
    const first = store.notes;
    expect(store.notes).toBe(first);
    store.saveSettings({ soundEnabled: false });
    // notes untouched by a settings write -> same reference
    expect(store.notes).toBe(first);
  });

  it('switches the active subject and ignores unknown ids', () => {
    store.selectSubject(CS_ID);
    expect(store.activeSubjectId).toBe(CS_ID);
    store.selectSubject('nope');
    expect(store.activeSubjectId).toBe(CS_ID);
  });

  it('scopes added notes and quizzes to the active subject', () => {
    store.selectSubject(CS_ID);
    const note = store.addNote({
      title: 'TCP handshake',
      content: '# TCP',
    });
    expect(note.subjectId).toBe(CS_ID);
    const quiz = store.addQuiz({
      name: 'Networks drill',
      flashcards: [],
      quizLengthUsed: 0,
      difficulty: 'Easy',
    });
    expect(quiz.subjectId).toBe(CS_ID);
    expect(store.notes.filter((n) => n.subjectId === CS_ID).some((n) => n.id === note.id)).toBe(true);
    expect(store.quizzes.filter((q) => q.subjectId === CS_ID).some((q) => q.id === quiz.id)).toBe(true);
  });

  it('cascades deletes across all child collections when a subject is removed', () => {
    store.recordAttempt({
      subjectId: BIO_ID,
      subjectName: 'Cellular Biology & Genetics',
      name: 'Quick drill',
      type: 'Quiz',
      overallScore: 100,
      totalQuestions: 1,
      correctQuestions: 1,
    });
    store.deleteSubject(BIO_ID);

    expect(store.subjects.some((s) => s.id === BIO_ID)).toBe(false);
    expect(store.notes.some((n) => n.subjectId === BIO_ID)).toBe(false);
    expect(store.quizzes.some((q) => q.subjectId === BIO_ID)).toBe(false);
    expect(store.attempts.some((a) => a.subjectId === BIO_ID)).toBe(false);
    expect(store.tasks.some((t) => t.subjectId === BIO_ID)).toBe(false);
    // The active subject falls back to a remaining one.
    expect(store.activeSubjectId).toBe(CS_ID);
  });

  it('recordAttempt is the single op for Quiz and Exam completions', () => {
    const quizAttempt = store.recordAttempt({
      subjectId: BIO_ID,
      subjectName: 'Cellular Biology & Genetics',
      name: 'Flashcard drill',
      type: 'Quiz',
      overallScore: 80,
      totalQuestions: 5,
      correctQuestions: 4,
    });
    const examAttempt = store.recordAttempt({
      subjectId: BIO_ID,
      subjectName: 'Cellular Biology & Genetics',
      name: 'Mock exam',
      type: 'Exam',
      overallScore: 90,
      totalQuestions: 10,
      correctQuestions: 9,
    });

    expect(quizAttempt.id).toMatch(/^att-/);
    expect(quizAttempt.date).toBeTruthy();
    expect(examAttempt.id).toMatch(/^att-/);
    // newest first
    expect(store.attempts[0].id).toBe(examAttempt.id);
    expect(store.attempts[1].id).toBe(quizAttempt.id);
  });

  it('notifies subscribers on writes and unsubscribes cleanly', () => {
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);

    store.addTask({
      subjectId: BIO_ID,
      title: 'New task',
      dueDate: '2026-12-01',
      completed: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    store.addTask({
      subjectId: BIO_ID,
      title: 'Another task',
      dueDate: '2026-12-02',
      completed: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('updateNote marks updatedAt and returns null for missing ids', () => {
    const note = store.notes[0];
    const before = note.updatedAt;
    const updated = store.updateNote(note.id, { title: 'Renamed' });
    expect(updated?.title).toBe('Renamed');
    expect(updated?.updatedAt >= before).toBe(true);
    expect(store.updateNote('missing-note', { title: 'x' })).toBeNull();
  });

  it('round-trips through export/import without corrupting state', () => {
    store.addTask({
      subjectId: BIO_ID,
      title: 'Temp task',
      dueDate: '2026-12-01',
      completed: false,
    });
    const backup = store.exportAllData();
    const beforeSubjects = store.subjects.length;
    const beforeTasks = store.tasks.length;

    // Wipe, then restore.
    store.resetToDefaults();
    expect(store.tasks.length).not.toBe(beforeTasks);

    expect(store.importAllData(backup)).toBe(true);
    expect(store.subjects.length).toBe(beforeSubjects);
    expect(store.tasks.length).toBe(beforeTasks);
    expect(store.tasks.some((t) => t.title === 'Temp task')).toBe(true);
  });

  it('rejects malformed imports', () => {
    expect(store.importAllData('not json')).toBe(false);
  });

  it('resetToDefaults restores seeds and clears local overrides', () => {
    store.addTask({
      subjectId: BIO_ID,
      title: 'Custom task',
      dueDate: '2026-12-01',
      completed: false,
    });
    store.resetToDefaults();
    expect(store.tasks.length).toBe(SEED_TASKS.length);
    expect(store.tasks.some((t) => t.title === 'Custom task')).toBe(false);
    expect(store.activeSubjectId).toBe(SEED_SUBJECTS[0].id);
  });
});

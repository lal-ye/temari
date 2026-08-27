import { useState, useEffect, useCallback } from 'react';
import { Subject, StoredNote, StoredQuiz, StoredAttempt, StudyTask, UserSettings } from '../types';
import { StorageService } from '../services/storage';

export interface StudyDataState {
  subjects: Subject[];
  notes: StoredNote[];
  quizzes: StoredQuiz[];
  attempts: StoredAttempt[];
  tasks: StudyTask[];
  settings: UserSettings;
  isLoading: boolean;
  refreshData: () => void;
  // Subject operations
  addSubject: (nameOrObj: string | { name: string; description?: string; code?: string; color?: string }) => Subject;
  updateSubject: (id: string, updates: Partial<Subject>) => Subject | null;
  deleteSubject: (id: string) => void;
  // Note operations
  addNote: (note: Omit<StoredNote, 'id' | 'createdAt' | 'updatedAt'>) => StoredNote;
  updateNote: (id: string, updates: Partial<StoredNote>) => StoredNote | null;
  deleteNote: (id: string) => void;
  // Quiz operations
  addQuiz: (quiz: Omit<StoredQuiz, 'id' | 'createdAt' | 'updatedAt'>) => StoredQuiz;
  updateQuiz: (id: string, updates: Partial<StoredQuiz>) => StoredQuiz | null;
  deleteQuiz: (id: string) => void;
  // Attempt operations
  recordAttempt: (attempt: Omit<StoredAttempt, 'id' | 'date'>) => StoredAttempt;
  deleteAttempt: (id: string) => void;
  // Task operations
  addTask: (task: Omit<StudyTask, 'id' | 'createdAt'>) => StudyTask;
  updateTask: (id: string, updates: Partial<StudyTask>) => StudyTask | null;
  deleteTask: (id: string) => void;
  // Settings & Backup
  saveSettings: (settings: Partial<UserSettings>) => UserSettings;
  exportAllData: () => string;
  importAllData: (jsonString: string) => boolean;
  resetToDefaults: () => void;
}

/**
 * Deep domain hook encapsulating storage state and reactive synchronization.
 * Callers receive automatic real-time updates whenever data changes.
 */
export function useStudyData(): StudyDataState {
  const [subjects, setSubjects] = useState<Subject[]>(() => StorageService.getSubjects());
  const [notes, setNotes] = useState<StoredNote[]>(() => StorageService.getNotes());
  const [quizzes, setQuizzes] = useState<StoredQuiz[]>(() => StorageService.getQuizzes());
  const [attempts, setAttempts] = useState<StoredAttempt[]>(() => StorageService.getAttempts());
  const [tasks, setTasks] = useState<StudyTask[]>(() => StorageService.getTasks());
  const [settings, setSettings] = useState<UserSettings>(() => StorageService.getSettings());
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const refreshData = useCallback(() => {
    setSubjects(StorageService.getSubjects());
    setNotes(StorageService.getNotes());
    setQuizzes(StorageService.getQuizzes());
    setAttempts(StorageService.getAttempts());
    setTasks(StorageService.getTasks());
    setSettings(StorageService.getSettings());
  }, []);

  useEffect(() => {
    // Automatically subscribe to storage mutations
    const unsubscribe = StorageService.subscribe(() => {
      refreshData();
    });
    return unsubscribe;
  }, [refreshData]);

  return {
    subjects,
    notes,
    quizzes,
    attempts,
    tasks,
    settings,
    isLoading,
    refreshData,
    addSubject: (subj) => StorageService.addSubject(subj),
    updateSubject: (id, updates) => StorageService.updateSubject(id, updates),
    deleteSubject: (id) => StorageService.deleteSubject(id),
    addNote: (note) => StorageService.addNote(note),
    updateNote: (id, updates) => StorageService.updateNote(id, updates),
    deleteNote: (id) => StorageService.deleteNote(id),
    addQuiz: (quiz) => StorageService.addQuiz(quiz),
    updateQuiz: (id, updates) => StorageService.updateQuiz(id, updates),
    deleteQuiz: (id) => StorageService.deleteQuiz(id),
    recordAttempt: (attempt) => StorageService.recordAttempt(attempt),
    deleteAttempt: (id) => StorageService.deleteAttempt(id),
    addTask: (task) => StorageService.addTask(task),
    updateTask: (id, updates) => StorageService.updateTask(id, updates),
    deleteTask: (id) => StorageService.deleteTask(id),
    saveSettings: (s) => StorageService.saveSettings(s),
    exportAllData: () => StorageService.exportAllData(),
    importAllData: (json) => StorageService.importAllData(json),
    resetToDefaults: () => StorageService.resetToDefaults(),
  };
}

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

  const addSubject = useCallback((subj: Parameters<typeof StorageService.addSubject>[0]) => StorageService.addSubject(subj), []);
  const updateSubject = useCallback((id: string, updates: Partial<Subject>) => StorageService.updateSubject(id, updates), []);
  const deleteSubject = useCallback((id: string) => StorageService.deleteSubject(id), []);

  const addNote = useCallback((note: Omit<StoredNote, 'id' | 'createdAt' | 'updatedAt'>) => StorageService.addNote(note), []);
  const updateNote = useCallback((id: string, updates: Partial<StoredNote>) => StorageService.updateNote(id, updates), []);
  const deleteNote = useCallback((id: string) => StorageService.deleteNote(id), []);

  const addQuiz = useCallback((quiz: Omit<StoredQuiz, 'id' | 'createdAt' | 'updatedAt'>) => StorageService.addQuiz(quiz), []);
  const updateQuiz = useCallback((id: string, updates: Partial<StoredQuiz>) => StorageService.updateQuiz(id, updates), []);
  const deleteQuiz = useCallback((id: string) => StorageService.deleteQuiz(id), []);

  const recordAttempt = useCallback((attempt: Omit<StoredAttempt, 'id' | 'date'>) => StorageService.recordAttempt(attempt), []);
  const deleteAttempt = useCallback((id: string) => StorageService.deleteAttempt(id), []);

  const addTask = useCallback((task: Omit<StudyTask, 'id' | 'createdAt'>) => StorageService.addTask(task), []);
  const updateTask = useCallback((id: string, updates: Partial<StudyTask>) => StorageService.updateTask(id, updates), []);
  const deleteTask = useCallback((id: string) => StorageService.deleteTask(id), []);

  const saveSettings = useCallback((s: Partial<UserSettings>) => StorageService.saveSettings(s), []);
  const exportAllData = useCallback(() => StorageService.exportAllData(), []);
  const importAllData = useCallback((json: string) => StorageService.importAllData(json), []);
  const resetToDefaults = useCallback(() => StorageService.resetToDefaults(), []);

  return {
    subjects,
    notes,
    quizzes,
    attempts,
    tasks,
    settings,
    isLoading,
    refreshData,
    addSubject,
    updateSubject,
    deleteSubject,
    addNote,
    updateNote,
    deleteNote,
    addQuiz,
    updateQuiz,
    deleteQuiz,
    recordAttempt,
    deleteAttempt,
    addTask,
    updateTask,
    deleteTask,
    saveSettings,
    exportAllData,
    importAllData,
    resetToDefaults,
  };
}

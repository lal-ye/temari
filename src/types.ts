import type { AIProviderId } from '../shared/aiCatalog';

export interface Subject {
  id: string;
  name: string;
  amharicName?: string;
  code?: string;
  description?: string;
  color?: string;
  icon?: string;
  createdAt: string; // ISO string
  updatedAt?: string;
}

export interface StoredNote {
  id: string;
  subjectId: string;
  title: string;
  content: string; // Markdown content with headings, tables, editorial vector diagrams, etc.
  sourceName?: string; // Original source filename or "Pasted Material"
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Flashcard {
  id: string;
  question: string;
  answer: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  tags?: string[];
}

export interface StoredQuiz {
  id: string;
  subjectId: string;
  name: string;
  flashcards: Flashcard[];
  courseMaterialExtract?: string;
  quizLengthUsed: number;
  difficulty: 'Easy' | 'Medium' | 'Hard' | 'Mixed';
  createdAt: string;
  updatedAt: string;
  lastScore?: number;
  timesPracticed?: number;
}

export type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer';

export interface ExamQuestion {
  id?: string;
  question: string;
  type: QuestionType;
  options?: string[]; // 4 options for multiple choice
  correctAnswer: string;
  explanation?: string;
  topic: string;
}

export interface ExamResult {
  question: string;
  type: QuestionType;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  topic: string;
}

export interface Article {
  title: string;
  url: string;
  snippet?: string;
}

export interface StoredAttempt {
  id: string;
  subjectId: string;
  subjectName: string;
  name: string;
  type: 'Exam' | 'Quiz';
  /** Graded by the offline heuristic adapter, not a Provider (CONTEXT.md: Offline generation). */
  gradedOffline?: boolean;
  date: string; // ISO string or YYYY-MM-DD
  timeSpentSeconds?: number;
  examQuestions?: ExamQuestion[];
  examResults?: ExamResult[];
  overallScore: number; // percentage 0-100
  totalQuestions: number;
  correctQuestions: number;
  topicsToReview?: string[];
  extraReadings?: Article[];
}

export interface TopicPerformance {
  topic: string;
  accuracy: number; // Percentage
  correct: number;
  total: number;
}

export interface QuizScoreDistributionItem {
  name: string; // e.g., "0-59%", "60-69%", "70-79%", "80-89%", "90-100%"
  count: number;
}

export interface DatedScore {
  date: string;
  score: number;
  name: string;
  type: 'Quiz' | 'Exam';
}

export interface AnalyticsSummary {
  overallAverageScore: number;
  quizzesTaken: number;
  examsTaken: number;
  lastActivityDate: string | null;
  overallScoreProgress: DatedScore[];
  topicPerformance: TopicPerformance[];
  areasForImprovement: TopicPerformance[];
  quizScoreDistribution: QuizScoreDistributionItem[];
}

export interface StudyTask {
  id: string;
  subjectId?: string;
  subjectName?: string;
  title: string;
  dueDate: string;
  priority?: 'low' | 'medium' | 'high';
  estimatedMinutes?: number;
  completed: boolean;
  type?: 'exam' | 'quiz' | 'reading' | 'assignment' | string;
  createdAt?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface UserSettings {
  apiKey?: string;
  selectedProvider?: AIProvider;
  selectedModel?: string;
  providerKeys?: Record<string, string>;
  providerModels?: Record<string, string>;
  customBaseUrl?: string;
  customModelName?: string;
  theme: 'dark' | 'light' | 'neobrutalist';
  pomodoroWorkMinutes: number;
  pomodoroBreakMinutes: number;
  pomodoroLongBreakMinutes: number;
  soundEnabled: boolean;
}

/** Provider ids and their transport facts live in the shared catalog (docs/adr/0003). */
export type AIProvider = AIProviderId;





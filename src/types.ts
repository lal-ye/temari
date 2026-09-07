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

/**
 * The six revised Bloom levels, lowest → highest cognitive demand.
 *
 * Order is meaningful: it drives exam ordering (progressive difficulty) and
 * adaptive escalation. Keep it sorted — several modules iterate it by index.
 */
export const BLOOM_LEVELS = [
  'remember',
  'understand',
  'apply',
  'analyze',
  'evaluate',
  'create',
] as const;

export type BloomLevel = (typeof BLOOM_LEVELS)[number];

/**
 * Named Bloom distributions offered to the learner. Weights live in the
 * Exam-Blueprint module (`src/services/examBlueprint.ts`); only the identity
 * is domain vocabulary, so it lives here where the store can persist it.
 */
export const COGNITIVE_MIXES = ['recall', 'balanced', 'simulation', 'deep'] as const;

export type CognitiveMixId = (typeof COGNITIVE_MIXES)[number];

/**
 * One row of an exam's cognitive plan: how many questions at one Bloom level.
 * The client computes the plan (src/services/examBlueprint.ts) and sends it to
 * the server, which renders it into the generation prompt — so the quota and
 * the words that ask for it cannot drift apart.
 */
export interface BloomSlot {
  level: BloomLevel;
  /** Level-appropriate directive verbs, e.g. "compare, contrast, examine". */
  verb: string;
  count: number;
}

/**
 * A Knowledge Unit: one assessable idea extracted from Material before
 * questions are written, so coverage is planned rather than emergent.
 * See docs/adr/0008.
 */
export interface KnowledgeUnit {
  id: string;
  concept: string;
  definition: string;
  /** The passage in the Material this unit was drawn from, verbatim if possible. */
  sourceSnippet?: string;
}

export interface ExamQuestion {
  id?: string;
  question: string;
  type: QuestionType;
  options?: string[]; // 4 options for multiple choice
  correctAnswer: string;
  explanation?: string;
  topic: string;
  /**
   * Target cognitive level. Absent on attempts recorded before cognitive-level
   * awareness landed; readers must treat `undefined` as unlevelled, never guess.
   */
  bloomLevel?: BloomLevel;
  /** The KnowledgeUnit this question was written against, when one was planned. */
  knowledgeUnitId?: string;
  /**
   * Short-answer grading rubric: the 2-4 points that earn full credit. Graders
   * score against this instead of free semantic comparison.
   */
  rubric?: string[];
  /** Note this question was sourced from, so results can deep-link back. */
  sourceNoteId?: string;
}

export interface ExamResult {
  question: string;
  type: QuestionType;
  correctAnswer: string;
  userAnswer: string;
  isCorrect: boolean;
  explanation?: string;
  topic: string;
  /** Carried from the question so mastery can be measured per (topic × level). */
  bloomLevel?: BloomLevel;
  knowledgeUnitId?: string;
  /** Which rubric points the answer earned, for short answers. */
  rubricEarned?: string[];
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
  /** Which Bloom distribution this exam was generated with, if the learner chose one. */
  cognitiveMix?: CognitiveMixId;
  /**
   * True when the exam was generated from extracted Knowledge Units rather than
   * the whole concatenated Material (docs/adr/0008). Lets the UI be honest about
   * why one exam covered a subject more evenly than another.
   */
  knowledgeUnitTargeted?: boolean;
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
  /**
   * @deprecated Zen Mode collapsed the desktop sidebar. The sidebar was
   * removed in favour of header navigation plus the command palette, so there
   * is nothing left to collapse. The field is retained so that settings
   * persisted by earlier versions still parse; nothing reads it.
   */
  zenMode: boolean;
}

/** Provider ids and their transport facts live in the shared catalog (docs/adr/0003). */
export type AIProvider = AIProviderId;





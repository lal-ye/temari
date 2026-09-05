import { Flashcard, ExamQuestion, ExamResult, Article, UserSettings } from '../../types';
import { AIProviderId } from '../../../shared/aiCatalog';

/**
 * Public contracts of the AI-Generation module (src/services/ai).
 *
 * The port (AiGenerator) is the only surface feature components consume.
 * Adapters implement GenerationAdapter (bare values); the module's fallback
 * policy wraps adapter results in GenerationResult so offline drafts are
 * always attributable (CONTEXT.md: Offline generation).
 */

// --- Generation params ------------------------------------------------------

export interface GenerateNotesParams {
  material: string;
  sourceName?: string;
  signal?: AbortSignal;
}

export interface GenerateQuizParams {
  material: string;
  quizLength: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  signal?: AbortSignal;
}

export interface GenerateExamParams {
  material: string;
  numberOfQuestions?: number;
  signal?: AbortSignal;
}

export interface GradeExamParams {
  exam: ExamQuestion[];
  userAnswers: string[];
  signal?: AbortSignal;
}

export interface ExplainTermParams {
  term: string;
  context?: string;
  signal?: AbortSignal;
}

// --- Generation results ------------------------------------------------------

export interface GradeExamResult {
  results: ExamResult[];
  overallScore: number;
  topicsToReview: string[];
  extraReadings: Article[];
}

export interface ExplainTermResult {
  explanation: string;
  relatedLinks?: Article[];
}

// --- The port ----------------------------------------------------------------

/** Which adapter served a generation: the configured Provider, or offline. */
export type GenerationSource = 'model' | 'offline';

export interface GenerationResult<T> {
  source: GenerationSource;
  value: T;
}

export interface AiGenerator {
  generateNotes(params: GenerateNotesParams): Promise<GenerationResult<string>>;
  generateQuiz(params: GenerateQuizParams): Promise<GenerationResult<Flashcard[]>>;
  generateExam(params: GenerateExamParams): Promise<GenerationResult<ExamQuestion[]>>;
  gradeExam(params: GradeExamParams): Promise<GenerationResult<GradeExamResult>>;
  explainTerm(params: ExplainTermParams): Promise<GenerationResult<ExplainTermResult>>;
}

// --- Adapter contract (internal seam) ---------------------------------------

/** What every adapter implements: the five ops, bare values, throwing on failure. */
export interface GenerationAdapter {
  generateNotes(params: GenerateNotesParams): Promise<string>;
  generateQuiz(params: GenerateQuizParams): Promise<Flashcard[]>;
  generateExam(params: GenerateExamParams): Promise<ExamQuestion[]>;
  gradeExam(params: GradeExamParams): Promise<GradeExamResult>;
  explainTerm(params: ExplainTermParams): Promise<ExplainTermResult>;
}

// --- Wiring -------------------------------------------------------------------

/** Where the module reads provider/model/key/baseUrl from, at call time. */
export type SettingsSource = () => Partial<UserSettings> | null | undefined;

export interface AiCredentials {
  provider: AIProviderId;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

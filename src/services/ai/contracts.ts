import {
  BloomSlot,
  CognitiveMixId,
  Flashcard,
  ExamQuestion,
  ExamResult,
  Article,
  KnowledgeUnit,
  UserSettings,
} from '../../types';
import { AIProviderId } from '../../../shared/aiCatalog';
import type { FailureKind } from './diagnoseError';

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
  /**
   * Per-level quota the Provider is asked to hit. Computed by
   * src/services/examBlueprint.ts and rendered into the server prompt, so the
   * exam's cognitive mix is a request the model can be held to — not an
   * emergent property of whatever the Material happened to contain.
   */
  bloomPlan?: BloomSlot[];
  /**
   * Knowledge units extracted in the preceding stage. When present, generation
   * is targeted per unit, which is what stops a concatenated notes library from
   * biasing every question toward whichever topic appears first.
   */
  knowledgeUnits?: KnowledgeUnit[];
  /** Question stems the learner has already seen; the Provider is told to avoid them. */
  avoidStems?: string[];
  signal?: AbortSignal;
}

export interface ExtractKnowledgeUnitsParams {
  material: string;
  /** Ceiling on returned units; the server also caps by material size. */
  maxUnits?: number;
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

/**
 * Why an offline draft was served instead of Provider output. Provenance
 * (`source`) says *what* produced the content; this says *why* the Provider
 * did not, so the UI can name the right recovery: a rejected key needs the
 * settings dialog, an unreachable network needs a retry — never the other
 * way round (docs/ui-plan-truthful-interaction.md §4b).
 */
export interface FallbackReason {
  kind: FailureKind;
  /** One line, sentence case: what went wrong. */
  title: string;
  /** What to do about it. */
  fix: string;
  /** Display name of the Provider that failed, e.g. "OpenAI". */
  provider: string;
  /** Raw error message, for the console and support. */
  detail: string;
}

export interface GenerationResult<T> {
  source: GenerationSource;
  value: T;
  /** Present only when `source === 'offline'`. */
  fallback?: FallbackReason;
}

export interface AiGenerator {
  generateNotes(params: GenerateNotesParams): Promise<GenerationResult<string>>;
  generateQuiz(params: GenerateQuizParams): Promise<GenerationResult<Flashcard[]>>;
  /**
   * Stage 1 of exam generation: the assessable ideas in the Material, before
   * any question is written. Returns `source: 'offline'` when the heuristic
   * extractor served it, so callers can label the exam accordingly.
   */
  extractKnowledgeUnits(
    params: ExtractKnowledgeUnitsParams
  ): Promise<GenerationResult<KnowledgeUnit[]>>;
  generateExam(params: GenerateExamParams): Promise<GenerationResult<ExamQuestion[]>>;
  gradeExam(params: GradeExamParams): Promise<GenerationResult<GradeExamResult>>;
  explainTerm(params: ExplainTermParams): Promise<GenerationResult<ExplainTermResult>>;
}

// --- Adapter contract (internal seam) ---------------------------------------

/** What every adapter implements: the six ops, bare values, throwing on failure. */
export interface GenerationAdapter {
  generateNotes(params: GenerateNotesParams): Promise<string>;
  generateQuiz(params: GenerateQuizParams): Promise<Flashcard[]>;
  extractKnowledgeUnits(params: ExtractKnowledgeUnitsParams): Promise<KnowledgeUnit[]>;
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

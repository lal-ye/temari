import { Flashcard, ExamQuestion } from '../../types';
import { resolveCredentials } from './credentials';
import {
  GenerateExamParams,
  GenerateNotesParams,
  GenerateQuizParams,
  GenerationAdapter,
  GradeExamParams,
  ExplainTermParams,
  GradeExamResult,
  ExplainTermResult,
} from './contracts';

/** Server payload shapes (loose, since the server owns these responses). */
interface GradeExamResponse extends Partial<GradeExamResult> {}
interface ExplainTermResponse extends Partial<ExplainTermResult> {}

/**
 * Production adapter: talks to this app's Express server (/api/ai/*).
 *
 * Transport only — it throws on any failure (HTTP error, network error,
 * malformed payload). Whether a failure means "go offline" is policy, and
 * policy lives in index.ts, not here.
 */
export function createHttpAdapter(getSettings: () => Parameters<typeof resolveCredentials>[0]): GenerationAdapter {
  async function postAi<T>(
    path: string,
    body: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<T> {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const raw = await response.text();
      let message = `HTTP ${response.status}: ${path} failed`;
      try {
        const parsed = JSON.parse(raw);
        if (typeof parsed?.error === 'string') message = parsed.error;
        else if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
      } catch {
        // non-JSON error body — keep the generic message
      }
      throw new Error(message);
    }

    return (await response.json()) as T;
  }

  return {
    async generateNotes(params: GenerateNotesParams): Promise<string> {
      const data = await postAi<{ notes?: string }>(
        '/api/ai/generate-notes',
        {
          ...resolveCredentials(getSettings()),
          material: params.material,
          sourceName: params.sourceName,
        },
        params.signal
      );
      return data.notes || '';
    },

    async generateQuiz(params: GenerateQuizParams): Promise<Flashcard[]> {
      const data = await postAi<{ flashcards?: Flashcard[] }>(
        '/api/ai/generate-quiz',
        {
          ...resolveCredentials(getSettings()),
          material: params.material,
          quizLength: params.quizLength,
          difficulty: params.difficulty,
        },
        params.signal
      );
      return data.flashcards || [];
    },

    async generateExam(params: GenerateExamParams): Promise<ExamQuestion[]> {
      const data = await postAi<{ exam?: ExamQuestion[] }>(
        '/api/ai/generate-exam',
        {
          ...resolveCredentials(getSettings()),
          material: params.material,
          numberOfQuestions: params.numberOfQuestions,
        },
        params.signal
      );
      return data.exam || [];
    },

    async gradeExam(params: GradeExamParams): Promise<GradeExamResult> {
      const data = await postAi<GradeExamResponse>(
        '/api/ai/grade-exam',
        {
          ...resolveCredentials(getSettings()),
          exam: params.exam,
          userAnswers: params.userAnswers,
        },
        params.signal
      );
      return {
        results: data.results || [],
        overallScore: data.overallScore ?? 0,
        topicsToReview: data.topicsToReview || [],
        extraReadings: data.extraReadings || [],
      };
    },

    async explainTerm(params: ExplainTermParams): Promise<ExplainTermResult> {
      const data = await postAi<ExplainTermResponse>(
        '/api/ai/explain-term',
        {
          ...resolveCredentials(getSettings()),
          term: params.term,
          context: params.context,
        },
        params.signal
      );
      return { explanation: data.explanation || '', relatedLinks: data.relatedLinks };
    },
  };
}

// Keep the adapter contract referenced so a signature drift here fails the
// typecheck instead of silently diverging from the port.
export type HttpAdapterChecks = GenerationAdapter;


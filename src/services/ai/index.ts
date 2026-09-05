import { getStudyStore } from '../studyStore';
import {
  AiGenerator,
  GenerateExamParams,
  GenerateNotesParams,
  GenerateQuizParams,
  GenerationAdapter,
  GenerationResult,
  GradeExamParams,
  ExplainTermParams,
  SettingsSource,
} from './contracts';
import { createHttpAdapter } from './http';
import { createOfflineAdapter } from './offline';

export * from './contracts';

/**
 * AI-Generation module
 * --------------------
 * One deep module owning everything about producing study content:
 * credential resolution (reads settings internally), server transport, the
 * fallback policy, and response contracts.
 *
 * Public interface (the port, keep small):
 *   generateNotes, generateQuiz, generateExam, gradeExam, explainTerm
 *
 * Every op returns GenerationResult<T>, whose `source` says which adapter
 * served it — 'model' (the configured Provider) or 'offline' (the local
 * heuristic adapter). CONTEXT.md rule: offline content must always be
 * identifiable; callers surface `source === 'offline'` in the UI.
 *
 * Fallback policy (one place): any server failure — network error, HTTP
 * error, malformed payload — falls back to the offline adapter. User aborts
 * propagate (the learner cancelled; do not substitute content).
 *
 * Adapters sit at an internal seam (GenerationAdapter): HTTP for the
 * self-hosted deployment, offline heuristics for static/Netlify deploys and
 * outages. Both are real, running adapters — the seam predates the port.
 *
 * The interface is the test surface: src/services/ai/aiGenerator.test.ts.
 */
export function createAiGenerator(deps: { getSettings: SettingsSource }): AiGenerator {
  const http = createHttpAdapter(deps.getSettings);
  const offline = createOfflineAdapter();

  const isAbort = (err: unknown): boolean =>
    !!err && typeof err === 'object' && (err as { name?: string }).name === 'AbortError';

  async function withFallback<T>(
    label: string,
    op: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<GenerationResult<T>> {
    try {
      return { source: 'model', value: await op() };
    } catch (err) {
      if (isAbort(err)) throw err;
      console.warn(`[ai] ${label} unavailable via Provider, serving offline draft:`, err);
      return { source: 'offline', value: await fallback() };
    }
  }

  return {
    generateNotes: (params: GenerateNotesParams) =>
      withFallback('Note generation', () => http.generateNotes(params), () => offline.generateNotes(params)),
    generateQuiz: (params: GenerateQuizParams) =>
      withFallback('Quiz generation', () => http.generateQuiz(params), () => offline.generateQuiz(params)),
    generateExam: (params: GenerateExamParams) =>
      withFallback('Exam generation', () => http.generateExam(params), () => offline.generateExam(params)),
    gradeExam: (params: GradeExamParams) =>
      withFallback('Exam grading', () => http.gradeExam(params), () => offline.gradeExam(params)),
    explainTerm: (params: ExplainTermParams) =>
      withFallback('Term explanation', () => http.explainTerm(params), () => offline.explainTerm(params)),
  };
}

/** Shape assertion: adapters must satisfy the port's ops. */
export type AdapterCheck = (adapter: GenerationAdapter) => void;

/**
 * App singleton wired to the study store's settings. Components import this;
 * tests build their own generator with a fake settings source.
 */
export const ai: AiGenerator = createAiGenerator({
  getSettings: () => getStudyStore().settings,
});

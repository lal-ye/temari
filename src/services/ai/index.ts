import { getStudyStore } from '../studyStore';
import {
  AiGenerator,
  ExtractKnowledgeUnitsParams,
  GenerateExamParams,
  GenerateNotesParams,
  GenerateQuizParams,
  FallbackReason,
  GenerationAdapter,
  GenerationResult,
  GradeExamParams,
  ExplainTermParams,
  SettingsSource,
} from './contracts';
import { createHttpAdapter } from './http';
import { createOfflineAdapter } from './offline';
import { resolveCredentials } from './credentials';
import { diagnoseConnectionError } from './diagnoseError';
import { getProviderInfo } from '../../../shared/aiCatalog';

export * from './contracts';
export type { FailureKind } from './diagnoseError';

/**
 * AI-Generation module
 * --------------------
 * One deep module owning everything about producing study content:
 * credential resolution (reads settings internally), server transport, the
 * fallback policy, and response contracts.
 *
 * Public interface (the port, keep small):
 *   generateNotes, generateQuiz, extractKnowledgeUnits, generateExam,
 *   gradeExam, explainTerm
 *
 * Every op returns GenerationResult<T>, whose `source` says which adapter
 * served it — 'model' (the configured Provider) or 'offline' (the local
 * heuristic adapter). CONTEXT.md rule: offline content must always be
 * identifiable; callers surface `source === 'offline'` in the UI.
 *
 * Fallback policy (one place): any server failure — network error, HTTP
 * error, malformed payload — falls back to the offline adapter. User aborts
 * propagate (the learner cancelled; do not substitute content). The result
 * carries a `fallback` reason so the UI can say why the Provider was not
 * used and offer the matching recovery; auto-fallback is a product policy,
 * and labelling it honestly is the least it owes the learner.
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

  function explainFailure(err: unknown): FallbackReason {
    const detail = err instanceof Error ? err.message : String(err);
    const creds = resolveCredentials(deps.getSettings());
    const isLocal = creds.provider === 'custom';
    const providerName = getProviderInfo(creds.provider).name;
    const diagnosis = diagnoseConnectionError({
      message: detail,
      provider: providerName,
      hasKey: Boolean(creds.apiKey),
      isLocal,
      baseUrl: creds.baseUrl,
    });
    return { kind: diagnosis.kind, title: diagnosis.title, fix: diagnosis.fix, provider: providerName, detail };
  }

  async function withFallback<T>(
    label: string,
    op: () => Promise<T>,
    fallback: () => Promise<T>
  ): Promise<GenerationResult<T>> {
    try {
      return { source: 'model', value: await op() };
    } catch (err) {
      if (isAbort(err)) throw err;
      const reason = explainFailure(err);
      console.warn(`[ai] ${label} unavailable via Provider (${reason.kind}), serving offline draft:`, err);
      return { source: 'offline', value: await fallback(), fallback: reason };
    }
  }

  return {
    generateNotes: (params: GenerateNotesParams) =>
      withFallback('Note generation', () => http.generateNotes(params), () => offline.generateNotes(params)),
    generateQuiz: (params: GenerateQuizParams) =>
      withFallback('Quiz generation', () => http.generateQuiz(params), () => offline.generateQuiz(params)),
    extractKnowledgeUnits: (params: ExtractKnowledgeUnitsParams) =>
      withFallback(
        'Knowledge-unit extraction',
        () => http.extractKnowledgeUnits(params),
        () => offline.extractKnowledgeUnits(params)
      ),
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

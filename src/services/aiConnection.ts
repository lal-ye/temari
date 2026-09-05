import { getStudyStore } from './studyStore';
import { resolveCredentials } from './ai/credentials';
import { SettingsSource } from './ai/contracts';

/**
 * Server-only AI operations: connection testing, live model discovery, and
 * PDF text extraction. These deliberately do NOT sit behind the generation
 * port — they have no offline adapter (one adapter = hypothetical seam), so
 * they are a plain module that talks to the app's Express server and fails
 * with explicit errors when it is unreachable (e.g. static Netlify deploys).
 */

export interface TestConnectionOptions {
  provider?: string;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface TestConnectionResult {
  success: boolean;
  latencyMs: number;
  reply?: string;
  error?: string;
  providerUsed?: string;
  modelUsed?: string;
}

export interface LiveModelItem {
  id: string;
  name: string;
  description?: string;
  contextWindow?: number;
  isVisionCapable?: boolean;
}

export interface FetchLiveModelsOptions {
  provider?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface FetchLiveModelsResult {
  success: boolean;
  provider: string;
  models: LiveModelItem[];
  error?: string;
}

export interface AiConnectionDeps {
  getSettings: SettingsSource;
}

export function createAiConnection(deps: AiConnectionDeps) {
  const resolve = (over?: Partial<TestConnectionOptions & FetchLiveModelsOptions>) => {
    const creds = resolveCredentials(deps.getSettings());
    return {
      provider: over?.provider || creds.provider,
      model: over?.model || creds.model,
      apiKey: over?.apiKey ?? creds.apiKey,
      baseUrl: over?.baseUrl ?? creds.baseUrl,
    };
  };

  return {
    /** Ping the configured provider through the server. Never throws. */
    async testConnection(options?: TestConnectionOptions): Promise<TestConnectionResult> {
      const body = resolve(options);
      try {
        const response = await fetch('/api/ai/test-connection', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
          return {
            success: false,
            latencyMs: data.latencyMs || 0,
            error: data.error || `HTTP ${response.status}: Failed to connect`,
          };
        }
        return data;
      } catch (err: any) {
        return {
          success: false,
          latencyMs: 0,
          error: err?.message || 'Network error connecting to AI endpoint',
        };
      }
    },

    /** Discover the provider's live model list through the server. Never throws. */
    async fetchLiveModels(options?: FetchLiveModelsOptions): Promise<FetchLiveModelsResult> {
      const body = resolve(options);
      try {
        const response = await fetch('/api/ai/fetch-live-models', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const data = await response.json();
        if (!response.ok) {
          return {
            success: false,
            provider: body.provider,
            models: [],
            error: data.error || `HTTP ${response.status}: Failed to fetch models`,
          };
        }
        return data;
      } catch (err: any) {
        return {
          success: false,
          provider: body.provider,
          models: [],
          error: err?.message || 'Network error fetching live models',
        };
      }
    },

    /**
     * Extract text from a PDF via the server (multimodal Gemini or local
     * pdf-parse). Throws — the caller owns the error UX.
     */
    async extractPdfText(pdfDataUri: string, signal?: AbortSignal): Promise<string> {
      const creds = resolveCredentials(deps.getSettings());
      const response = await fetch('/api/ai/extract-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdfDataUri,
          provider: creds.provider,
          model: creds.model,
          apiKey: creds.apiKey,
          baseUrl: creds.baseUrl,
        }),
        signal,
      });

      if (!response.ok) {
        const raw = await response.text();
        let message = `HTTP ${response.status}: Failed to extract PDF`;
        try {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.error === 'string') message = parsed.error;
          else if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
        } catch {
          // non-JSON error body
        }
        throw new Error(message);
      }

      const data = await response.json();
      return data.extractedText || '';
    },
  };
}

/** App singleton wired to the study store's settings. */
export const aiConnection = createAiConnection({
  getSettings: () => getStudyStore().settings,
});

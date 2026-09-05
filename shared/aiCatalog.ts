/**
 * Single source of truth for AI provider identity and transport facts.
 *
 * Imported by BOTH the client (settings UI, transport) and the server
 * (execution dispatch, provider endpoints) — see docs/adr/0003. Presentation
 * metadata (badge colours, marketing copy, curated model lists) is a client
 * concern and lives in src/components/tools/modelPresentation.ts.
 *
 * ADR rule: when you add a provider or change a default model, change it here
 * once. Nowhere else may hardcode a provider id, default model, base URL, or
 * server key variable name.
 */

export type AIProviderId =
  | 'gemini'
  | 'openai'
  | 'anthropic'
  | 'groq'
  | 'deepseek'
  | 'openrouter'
  | 'custom';

export interface AIProviderInfo {
  id: AIProviderId;
  /** Display name, shared by client UI and server endpoints. */
  name: string;
  /** Model used when the learner has not chosen one for this provider. */
  defaultModel: string;
  /** Whether the learner must supply their own key (no bundled server key). */
  requiresKey: boolean;
  /** Server environment variable that may hold a fallback key. */
  envKeyName?: 'GEMINI_API_KEY' | 'OPENAI_API_KEY' | 'ANTHROPIC_API_KEY' | 'GROQ_API_KEY' | 'DEEPSEEK_API_KEY' | 'OPENROUTER_API_KEY';
  /** Base URL for OpenAI-compatible / custom endpoints. */
  defaultBaseUrl?: string;
}

export const AI_PROVIDERS: readonly AIProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    defaultModel: 'gemini-2.5-flash',
    requiresKey: false,
    envKeyName: 'GEMINI_API_KEY',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    // gpt-4o and the whole GPT-4 generation retire 2026-10-23.
    defaultModel: 'gpt-5.6-terra',
    requiresKey: true,
    envKeyName: 'OPENAI_API_KEY',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    // claude-3-5-haiku retired 2026-02-19.
    defaultModel: 'claude-haiku-4-5',
    requiresKey: true,
    envKeyName: 'ANTHROPIC_API_KEY',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
  },
  {
    id: 'groq',
    name: 'Groq (Llama)',
    defaultModel: 'llama-3.3-70b-versatile',
    requiresKey: true,
    envKeyName: 'GROQ_API_KEY',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    // deepseek-chat / deepseek-reasoner were retired 2026-07-24.
    defaultModel: 'deepseek-v4-flash',
    requiresKey: true,
    envKeyName: 'DEEPSEEK_API_KEY',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModel: 'deepseek/deepseek-v4-flash',
    requiresKey: true,
    envKeyName: 'OPENROUTER_API_KEY',
    defaultBaseUrl: 'https://openrouter.ai/api/v1',
  },
  {
    id: 'custom',
    name: 'Custom / Local (Ollama)',
    defaultModel: 'llama3.2',
    requiresKey: false,
    defaultBaseUrl: 'http://localhost:11434/v1',
  },
];

export const DEFAULT_AI_PROVIDER: AIProviderId = 'gemini';

/**
 * Model ids that providers have retired, mapped to their replacement.
 *
 * A learner who picked a model a year ago has that id in localStorage. When
 * the provider retires it the request fails with a 404 that reads like a bug
 * in Temari, so selections are migrated on read rather than left to rot. Keyed
 * `provider:model` because ids are only unique within a provider.
 *
 * Entries can be removed once no plausible install still holds the old id.
 */
export const RETIRED_MODELS: Record<string, string> = {
  // OpenAI: GPT-4 generation retires 2026-10-23.
  'openai:gpt-4o': 'gpt-5.6-sol',
  'openai:gpt-4o-mini': 'gpt-5.6-terra',
  'openai:gpt-4-turbo': 'gpt-5.6-sol',
  'openai:gpt-3.5-turbo': 'gpt-5.6-luna',
  'openai:o1': 'gpt-5.6-sol',
  'openai:o3-mini': 'gpt-5.6-terra',
  'openai:o4-mini': 'gpt-5.6-terra',

  // Anthropic: 3.x line retired through 2026.
  'anthropic:claude-3-5-haiku-20241022': 'claude-haiku-4-5',
  'anthropic:claude-3-5-sonnet-20241022': 'claude-sonnet-5',
  'anthropic:claude-3-7-sonnet-20250219': 'claude-sonnet-5',
  'anthropic:claude-3-opus-20240229': 'claude-opus-5',

  // DeepSeek: legacy aliases hard-retired 2026-07-24.
  'deepseek:deepseek-chat': 'deepseek-v4-flash',
  'deepseek:deepseek-reasoner': 'deepseek-v4-pro',
  'deepseek:deepseek-coder': 'deepseek-v4-flash',

  // Google: 2.0 line shut down 2026-06-01.
  'gemini:gemini-2.0-flash': 'gemini-2.5-flash',
  'gemini:gemini-2.0-flash-lite': 'gemini-2.5-flash-lite',
  'gemini:gemini-1.5-pro': 'gemini-2.5-pro',
  'gemini:gemini-1.5-flash': 'gemini-2.5-flash',
};

/**
 * Replacement for a retired model id, or null if the id is still current.
 * Callers surface the swap rather than performing it silently: a learner who
 * chose a specific model deserves to know it changed underneath them.
 */
export function findRetiredModelReplacement(
  providerId: string | undefined,
  modelId: string | undefined
): string | null {
  if (!providerId || !modelId) return null;
  return RETIRED_MODELS[`${providerId}:${modelId}`] ?? null;
}

/** Structural slice of the learner's settings relevant to model selection. */
export interface ModelSelection {
  selectedProvider?: string;
  selectedModel?: string;
  providerModels?: Record<string, string>;
}

/** Look up a provider's transport facts; unknown ids fall back to the default provider. */
export function getProviderInfo(providerId?: string): AIProviderInfo {
  return AI_PROVIDERS.find((p) => p.id === providerId) ?? AI_PROVIDERS[0];
}

/**
 * Resolve the learner's active model for a provider.
 * Priority:
 * 1. Provider-specific selected model (settings.providerModels[provider])
 * 2. Active selected model if it matches the provider (or is the only choice)
 * 3. The provider's designated default model
 */
export function resolveActiveModel(
  settings?: ModelSelection | null,
  providerId?: AIProviderId
): string {
  const provider =
    providerId || (settings?.selectedProvider as AIProviderId) || DEFAULT_AI_PROVIDER;
  if (settings?.providerModels && settings.providerModels[provider]) {
    return settings.providerModels[provider];
  }
  if (
    settings?.selectedModel &&
    (settings.selectedProvider === provider || !settings.selectedProvider)
  ) {
    return settings.selectedModel;
  }
  return getProviderInfo(provider).defaultModel;
}

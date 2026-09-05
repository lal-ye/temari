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
    defaultModel: 'gpt-4o-mini',
    requiresKey: true,
    envKeyName: 'OPENAI_API_KEY',
    defaultBaseUrl: 'https://api.openai.com/v1',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    defaultModel: 'claude-3-5-haiku-20241022',
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
    defaultModel: 'deepseek-chat',
    requiresKey: true,
    envKeyName: 'DEEPSEEK_API_KEY',
    defaultBaseUrl: 'https://api.deepseek.com',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct',
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

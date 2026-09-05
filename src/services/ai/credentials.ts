import { UserSettings } from '../../types';
import { AIProviderId, DEFAULT_AI_PROVIDER, resolveActiveModel } from '../../../shared/aiCatalog';
import { AiCredentials } from './contracts';

/**
 * Resolve the credential block the server transport needs, at call time, from
 * the learner's settings. Internal to the AI-Generation module's
 * implementation — callers never pass credentials themselves (depth: this
 * knowledge stays behind the port).
 */
export function resolveCredentials(settings?: Partial<UserSettings> | null): AiCredentials {
  const provider = (settings?.selectedProvider as AIProviderId) || DEFAULT_AI_PROVIDER;
  return {
    provider,
    model: resolveActiveModel(settings, provider),
    apiKey: settings?.providerKeys?.[provider] || settings?.apiKey || undefined,
    baseUrl: settings?.customBaseUrl || undefined,
  };
}

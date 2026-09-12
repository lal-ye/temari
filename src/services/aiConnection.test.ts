import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAiConnection } from './aiConnection';
import { resolveCredentials } from './ai/credentials';
import type { UserSettings } from '../types';

const saved = {
  selectedProvider: 'custom', customBaseUrl: 'http://localhost:11434/v1',
  selectedModel: 'local-model', apiKey: 'legacy-gemini-key',
  providerKeys: { gemini: 'saved-gemini-key', custom: 'local-key' },
} as Partial<UserSettings>;
afterEach(() => vi.unstubAllGlobals());
function setup(settings = saved) {
  const fetchMock = vi.fn(async (_url: string, _options: RequestInit) => new Response(JSON.stringify({
    success: true, models: [], extractedText: 'PDF text',
  }), { status: 200 }));
  vi.stubGlobal('fetch', fetchMock);
  return { api: createAiConnection({ getSettings: () => settings }), fetchMock };
}
describe('provider-scoped credentials', () => {
  it('omits a saved custom URL from cloud generation credentials', () => {
    expect(resolveCredentials({ ...saved, selectedProvider: 'gemini' }).baseUrl).toBeUndefined();
  });
  it('does not send a legacy Gemini key to another provider', () => {
    expect(resolveCredentials({ ...saved, selectedProvider: 'openai' }).apiKey).toBeUndefined();
  });
  it.each(['testConnection', 'fetchLiveModels'] as const)('%s scopes unsaved provider selection and removes custom URLs', async method => {
    const { api, fetchMock } = setup();
    await api[method]({ provider: 'gemini', apiKey: 'opaque-test-credential', baseUrl: undefined });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body.provider).toBe('gemini');
    expect(body.apiKey).toBe('opaque-test-credential');
    expect(body).not.toHaveProperty('baseUrl');
    expect(body.model).not.toBe('local-model');
  });
  it('uses the selected provider key rather than the saved custom provider key', async () => {
    const { api, fetchMock } = setup();
    await api.testConnection({ provider: 'gemini' });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).apiKey).toBe('saved-gemini-key');
  });
  it('preserves custom URLs for self-hosted custom-provider requests', async () => {
    const { api, fetchMock } = setup();
    await api.testConnection();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string).baseUrl).toBe(saved.customBaseUrl);
  });
  it('does not attach custom URLs to cloud PDF extraction', async () => {
    const { api, fetchMock } = setup({ ...saved, selectedProvider: 'gemini' });
    await api.extractPdfText('data:application/pdf;base64,dGVzdA==');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).not.toHaveProperty('baseUrl');
  });
});

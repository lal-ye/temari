import { describe, it, expect, vi, afterEach } from 'vitest';
import serverless from 'serverless-http';
import { createApiApp } from './app';
import { executeAiRequest } from './aiProvider';

vi.mock('./aiProvider', () => ({
  executeAiRequest: vi.fn(async () => ({ text: 'OK', provider: 'openai', model: 'test' })),
  parseStructuredJson: JSON.parse,
  fetchLiveProviderModels: vi.fn(async () => ({ success: true, models: [] })),
}));
const handler = serverless(createApiApp({ hosted: true }));
async function request(path: string, body?: unknown, raw?: string) {
  return handler({
    httpMethod: body !== undefined || raw !== undefined ? 'POST' : 'GET',
    path, headers: { 'content-type': 'application/json' },
    body: raw ?? (body !== undefined ? JSON.stringify(body) : null),
    isBase64Encoded: false, requestContext: {},
  } as any, {} as any) as Promise<any>;
}
afterEach(() => { vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('hosted API boundary', () => {
  it('returns health JSON without advertising server keys', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'server-key-must-not-be-used');
    const result = await request('/api/health');
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).hasServerKey).toBe(false);
    expect(result.headers['cache-control']).toBe('no-store');
  });
  it('requires BYOK even when a server key exists', async () => {
    vi.stubEnv('GEMINI_API_KEY', 'server-key-must-not-be-used');
    expect((await request('/api/ai/test-connection', {})).statusCode).toBe(401);
    expect(executeAiRequest).not.toHaveBeenCalled();
  });
  it.each([
    { provider: 'custom', apiKey: 'test' },
    { provider: 'unknown', apiKey: 'test' },
    { provider: 'openai', apiKey: 'test', baseUrl: 'http://169.254.169.254' },
    { provider: 'openai', apiKey: 'test', model: {} },
    [],
  ])('rejects unsafe or invalid configuration %j', async body => {
    expect((await request('/api/ai/test-connection', body)).statusCode).toBe(400);
    expect(executeAiRequest).not.toHaveBeenCalled();
  });
  it('passes the learner key to the provider', async () => {
    const result = await request('/api/ai/test-connection', { provider: 'openai', apiKey: 'learner-key' });
    expect(result.statusCode).toBe(200);
    expect(executeAiRequest).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'learner-key' }));
  });
  it('returns JSON for unknown API routes', async () => {
    const result = await request('/api/missing');
    expect(result.statusCode).toBe(404);
    expect(JSON.parse(result.body).error).toBe('API route not found');
  });
  it('returns JSON for malformed payloads', async () => {
    expect((await request('/api/ai/test-connection', undefined, '{')).statusCode).toBe(400);
  });
  it('rejects oversized requests before provider calls', async () => {
    expect((await request('/api/ai/extract-pdf', { pdfDataUri: 'a'.repeat(4 * 1024 * 1024) })).statusCode).toBe(413);
    expect(executeAiRequest).not.toHaveBeenCalled();
  });
});

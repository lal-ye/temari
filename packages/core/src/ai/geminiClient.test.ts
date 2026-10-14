import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGeminiClient, PDF_MAX_BYTES, validatePdf } from './geminiClient';
const credentials = async () => ({ apiKey: 'fake-secret-DO-NOT-LEAK', model: 'test-model' });
const ready = () => Response.json({ supportedGenerationMethods: ['generateContent'] });
const text = (value = 'A safe explanation.') => Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: value }] } }] });
afterEach(() => vi.useRealTimers());
describe('direct Gemini BYOK', () => {
  it('preflights then sends exactly one paid POST, keys only in headers', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(ready()).mockResolvedValueOnce(text());
    const client = createGeminiClient({ credentials, fetch });
    expect(await client.explainTerm('ATP', 'Energy.')).toBe('A safe explanation.');
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls.map(([, options]) => options?.method)).toEqual(['GET', 'POST']);
    for (const [url, options] of fetch.mock.calls) {
      expect(url).not.toContain('fake-secret');
      expect(options?.body ?? '').not.toContain('fake-secret');
      expect(options?.headers).toMatchObject({ 'x-goog-api-key': 'fake-secret-DO-NOT-LEAK' });
      expect(options?.redirect).toBe('error');
    }
  });
  it.each([[401, 'bad-key'], [403, 'bad-key'], [404, 'unknown-model'], [429, 'rate-limited'], [500, 'provider']] as const)('classifies %i without exposing a reflected key or retrying the POST', async (status, code) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(ready()).mockResolvedValueOnce(new Response('fake-secret-DO-NOT-LEAK', { status }));
    const client = createGeminiClient({ credentials, fetch });
    await expect(client.explainTerm('ATP', '')).rejects.toMatchObject({ code });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('bounds readiness retries and never POSTs if readiness fails', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Response('', { status: 503 }));
    await expect(createGeminiClient({ credentials, fetch, retryDelayMs: 0 }).explainTerm('ATP', '')).rejects.toMatchObject({ code: 'provider' });
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });
  it('never retries an uncertain paid network failure', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(ready()).mockRejectedValueOnce(new Error('fake-secret-DO-NOT-LEAK'));
    const error = await createGeminiClient({ credentials, fetch }).explainTerm('ATP', '').catch(error => error);
    expect(error.code).toBe('network'); expect(String(error)).not.toContain('fake-secret');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { candidates: [] }, { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'truncated' }] } }] }, { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] }])('rejects unusable successful responses', async (body) => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(ready()).mockResolvedValueOnce(Response.json(body));
    await expect(createGeminiClient({ credentials, fetch }).explainTerm('ATP', '')).rejects.toMatchObject({ code: 'invalid-response' });
  });
  it('does not make network calls without credentials or after cancellation', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const client = createGeminiClient({ credentials: async () => ({ apiKey: null, model: 'test' }), fetch });
    await expect(client.checkConnection()).rejects.toMatchObject({ code: 'missing-key' });
    await expect(client.checkConnection({ signal: AbortSignal.abort() })).rejects.toMatchObject({ code: 'cancelled' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('reads rotated credentials at request time and makes a GET-only connection test', async () => {
    let key = 'first';
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => ready());
    const client = createGeminiClient({ credentials: async () => ({ apiKey: key, model: 'test' }), fetch });
    await client.checkConnection(); key = 'second'; await client.checkConnection();
    expect(fetch.mock.calls[1][1]?.headers).toMatchObject({ 'x-goog-api-key': 'second' });
    expect(fetch.mock.calls.every(([, options]) => options?.method === 'GET')).toBe(true);
  });
  it('cancels active work, absorbs concurrency and is reusable after cancellation', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementationOnce(async (_, options) => new Promise((_, reject) => {
      options?.signal?.addEventListener('abort', () => reject(new Error('abort')));
    })).mockResolvedValue(ready());
    const client = createGeminiClient({ credentials, fetch });
    const controller = new AbortController();
    const pending = client.checkConnection({ signal: controller.signal });
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    await expect(client.checkConnection()).rejects.toMatchObject({ code: 'busy' });
    controller.abort(); await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    await client.checkConnection(); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('shows slow state then times out a hung request', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async (_, options) => new Promise((_, reject) => options?.signal?.addEventListener('abort', () => reject(new Error('abort')))));
    const onPhase = vi.fn();
    const pending = createGeminiClient({ credentials, fetch, timeoutMs: 100, slowMs: 10 }).checkConnection({ onPhase });
    const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(11); expect(onPhase).toHaveBeenCalledWith('slow');
    await vi.advanceTimersByTimeAsync(100); await rejected;
  });
  it('bounds local waiting even when credential storage cannot be interrupted', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>();
    let resolveKey!: (value: Awaited<ReturnType<typeof credentials>>) => void;
    const client = createGeminiClient({ credentials: () => new Promise(resolve => { resolveKey = resolve; }), fetch, timeoutMs: 100 });
    const pending = client.checkConnection();
    const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(101); await rejected;
    resolveKey(await credentials()); await Promise.resolve();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('times out a fetch adapter that ignores abort without silently retrying', async () => {
    vi.useFakeTimers();
    const fetch = vi.fn<typeof globalThis.fetch>().mockImplementation(async () => new Promise(() => {}));
    const client = createGeminiClient({ credentials, fetch, timeoutMs: 100 });
    const pending = client.checkConnection();
    const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(101); await rejected;
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('validates PDF magic and bounds before sending any data', () => {
    expect(() => validatePdf('JVBERi0xLjQK', 9)).not.toThrow();
    for (const [data, size] of [['JVBERi0xLjQK', PDF_MAX_BYTES + 1], ['not-a-pdf', 9], ['JVBERi0xLjQK', 10]] as const) {
      expect(() => validatePdf(data, size)).toThrow();
    }
  });
  it('sends a bounded PDF with MIME type and returns transcription', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(ready()).mockResolvedValueOnce(text('Study Material'));
    expect(await createGeminiClient({ credentials, fetch }).extractPdf('JVBERi0xLjQK', 9)).toBe('Study Material');
    expect(String(fetch.mock.calls[1][1]?.body)).toContain('application/pdf');
  });
});

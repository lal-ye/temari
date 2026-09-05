import { describe, expect, it } from 'vitest';
import { diagnoseConnectionError } from './diagnoseError';
import { findRetiredModelReplacement, RETIRED_MODELS } from '../../../shared/aiCatalog';

const base = { provider: 'openai', hasKey: true, isLocal: false };

describe('diagnoseConnectionError', () => {
  it('separates a missing key from a rejected one', () => {
    expect(
      diagnoseConnectionError({ ...base, hasKey: false, message: 'API key is missing' }).kind
    ).toBe('missing-key');
    expect(
      diagnoseConnectionError({ ...base, message: '401 Incorrect API key provided' }).kind
    ).toBe('bad-key');
  });

  it('distinguishes a valid key without model access from an invalid key', () => {
    expect(diagnoseConnectionError({ ...base, message: '403 Forbidden' }).kind).toBe('bad-key');
    expect(
      diagnoseConnectionError({ ...base, message: '403 Forbidden' }).title
    ).toMatch(/not allowed to use that model/);
  });

  it('separates rate limiting from exhausted quota, which need different fixes', () => {
    expect(diagnoseConnectionError({ ...base, message: '429 Too Many Requests' }).kind).toBe(
      'rate-limited'
    );
    expect(
      diagnoseConnectionError({ ...base, message: 'You exceeded your current quota' }).kind
    ).toBe('quota');
  });

  it('recognises a retired or misspelt model', () => {
    const d = diagnoseConnectionError({
      ...base,
      message: 'The model `gpt-4o` does not exist',
    });
    expect(d.kind).toBe('unknown-model');
    expect(d.fix).toMatch(/Scan live models/);
  });

  it('gives local users a local fix for the same message a cloud user gets', () => {
    // "fetch failed" is Node's message for a dead DNS lookup AND for a local
    // server that is not running. The right advice differs completely.
    const cloud = diagnoseConnectionError({ ...base, message: 'fetch failed' });
    const local = diagnoseConnectionError({
      ...base,
      provider: 'custom',
      isLocal: true,
      baseUrl: 'http://localhost:11434/v1',
      message: 'fetch failed',
    });

    expect(cloud.kind).toBe('network');
    expect(local.kind).toBe('local-unreachable');
    expect(local.fix).toContain('http://localhost:11434/v1');
  });

  it('tells a local user to pull the model rather than scan for it', () => {
    const d = diagnoseConnectionError({
      ...base,
      provider: 'custom',
      isLocal: true,
      message: 'model "llama3.2" not found',
    });
    expect(d.fix).toMatch(/ollama pull/);
  });

  it('identifies Temari\u2019s own server being absent, not the provider', () => {
    expect(diagnoseConnectionError({ ...base, message: 'Failed to fetch' }).kind).toBe('no-server');
  });

  it('falls back to the raw message rather than inventing a cause', () => {
    const d = diagnoseConnectionError({ ...base, message: 'Something unprecedented' });
    expect(d.kind).toBe('unknown');
    expect(d.fix).toBe('Something unprecedented');
  });

  it('never returns an empty fix, even with no message at all', () => {
    const d = diagnoseConnectionError({ ...base, message: '' });
    expect(d.title.length).toBeGreaterThan(0);
    expect(d.fix.length).toBeGreaterThan(0);
  });
});

describe('retired model migration', () => {
  it('maps ids the providers actually retired', () => {
    // DeepSeek hard-retired these on 2026-07-24; requests now fail outright.
    expect(findRetiredModelReplacement('deepseek', 'deepseek-chat')).toBe('deepseek-v4-flash');
    expect(findRetiredModelReplacement('deepseek', 'deepseek-reasoner')).toBe('deepseek-v4-pro');
    // Anthropic retired the 3.x line through 2026.
    expect(findRetiredModelReplacement('anthropic', 'claude-3-5-haiku-20241022')).toBe(
      'claude-haiku-4-5'
    );
    // Google shut down the 2.0 line on 2026-06-01.
    expect(findRetiredModelReplacement('gemini', 'gemini-2.0-flash')).toBe('gemini-2.5-flash');
  });

  it('leaves current models alone', () => {
    expect(findRetiredModelReplacement('gemini', 'gemini-2.5-flash')).toBeNull();
    expect(findRetiredModelReplacement('anthropic', 'claude-haiku-4-5')).toBeNull();
  });

  it('is keyed per provider, since ids collide across them', () => {
    // A local Ollama model may share a name with a retired cloud one.
    expect(findRetiredModelReplacement('custom', 'deepseek-chat')).toBeNull();
  });

  it('tolerates missing arguments', () => {
    expect(findRetiredModelReplacement(undefined, 'x')).toBeNull();
    expect(findRetiredModelReplacement('openai', undefined)).toBeNull();
  });

  it('never maps a model to itself, which would loop the migration prompt', () => {
    Object.entries(RETIRED_MODELS).forEach(([key, replacement]) => {
      expect(key.split(':')[1]).not.toBe(replacement);
    });
  });

  it('never maps to a model that is itself retired', () => {
    Object.entries(RETIRED_MODELS).forEach(([key, replacement]) => {
      const provider = key.split(':')[0];
      expect(RETIRED_MODELS[`${provider}:${replacement}`]).toBeUndefined();
    });
  });
});

/**
 * Regression: live-model discovery on a custom endpoint.
 *
 * The Ollama probe used to treat ANY HTTP 200 from /api/tags as proof the
 * server was Ollama. LM Studio, vLLM and most reverse proxies answer 200 with
 * their own body on unknown paths, so discovery returned an empty list and
 * never fell through to /v1/models - the picker reported "no models" for a
 * server that was listing them fine one path over.
 *
 * The shape check now required is replicated here, since the server module
 * imports Express and cannot be loaded in this suite.
 */
describe('Ollama probe shape check', () => {
  const looksLikeOllama = (body: unknown): boolean => {
    const tags = (body as { models?: unknown })?.models;
    return Array.isArray(tags) && tags.length > 0 && typeof (tags[0] as any)?.name === 'string';
  };

  it('accepts a genuine Ollama payload', () => {
    expect(looksLikeOllama({ models: [{ name: 'llama3.2', size: 2_000_000_000 }] })).toBe(true);
  });

  it('rejects a 200 that is not Ollama, so discovery falls through', () => {
    expect(looksLikeOllama({ data: [{ id: 'llama3.2' }] })).toBe(false);
    expect(looksLikeOllama({ models: [] })).toBe(false);
    expect(looksLikeOllama({})).toBe(false);
    expect(looksLikeOllama('<!doctype html>')).toBe(false);
    expect(looksLikeOllama({ models: [{ id: 'no-name-field' }] })).toBe(false);
  });
});

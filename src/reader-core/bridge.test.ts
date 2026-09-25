import { describe, expect, it } from 'vitest';
import {
  MAX_CONTEXT_LENGTH,
  MAX_TERM_LENGTH,
  MIN_TERM_LENGTH,
  buildExplainRequest,
  isApprovedLink,
  newRequestId,
  validateExplainRequest,
} from './bridge';

const NOTE = 'm2-reader-kitchen-sink-v1';

describe('buildExplainRequest', () => {
  it('builds a fresh request with exactly the permitted fields', () => {
    const request = buildExplainRequest({ noteId: NOTE, term: 'Energy', context: 'Energy is conserved.' });
    expect(request).not.toBeNull();
    expect(Object.keys(request!).sort()).toEqual(['context', 'noteId', 'requestId', 'term']);
    expect(request!.noteId).toBe(NOTE);
    expect(request!.requestId).toMatch(/^r-/);
  });

  it('generates distinct request ids', () => {
    const ids = new Set([newRequestId(), newRequestId(), newRequestId()]);
    expect(ids.size).toBe(3);
  });

  it('accepts terms at the inclusive bounds', () => {
    const min = buildExplainRequest({ noteId: NOTE, term: 'a'.repeat(MIN_TERM_LENGTH), context: '' });
    const max = buildExplainRequest({ noteId: NOTE, term: 'a'.repeat(MAX_TERM_LENGTH), context: '' });
    expect(min).not.toBeNull();
    expect(max).not.toBeNull();
  });

  it('rejects terms outside the bounds and empty or oversized note ids', () => {
    expect(buildExplainRequest({ noteId: NOTE, term: 'a'.repeat(MIN_TERM_LENGTH - 1), context: '' })).toBeNull();
    expect(buildExplainRequest({ noteId: NOTE, term: 'a'.repeat(MAX_TERM_LENGTH + 1), context: '' })).toBeNull();
    expect(buildExplainRequest({ noteId: '', term: 'ok', context: '' })).toBeNull();
    expect(buildExplainRequest({ noteId: 'n'.repeat(129), term: 'ok', context: '' })).toBeNull();
  });

  it('clamps a 302-char context window to 300 before dispatch', () => {
    // contextWindow(CONTEXT_RADIUS 120 + 60-char selection + 120 + 2 ellipses) = 302.
    const context = '…' + 'a'.repeat(300) + '…';
    expect(context.length).toBe(302);
    const request = buildExplainRequest({ noteId: NOTE, term: 'selection', context });
    expect(request!.context.length).toBe(MAX_CONTEXT_LENGTH);
    expect(validateExplainRequest(NOTE, request).ok).toBe(true);
  });

  it('clamps without leaving a dangling surrogate pair', () => {
    // 299 astral chars = 598 code units; code units 299..300 split the 150th pair.
    const context = '\u{1F600}'.repeat(150);
    const request = buildExplainRequest({ noteId: NOTE, term: 'term', context });
    expect(request!.context.length).toBeLessThanOrEqual(MAX_CONTEXT_LENGTH);
    expect(request!.context).not.toMatch(/[\uD800-\uDBFF]$/u);
  });
});

describe('validateExplainRequest', () => {
  const valid = { noteId: NOTE, term: 'Energy', context: 'ctx', requestId: 'r-1' };

  it('accepts a well-formed payload and returns a fresh permitted-fields object', () => {
    const result = validateExplainRequest(NOTE, { ...valid, extra: 'smuggled' });
    // Unknown keys are a shape failure: nothing but the four fields may cross.
    expect(result).toEqual({ ok: false, reason: 'shape' });

    const clean = validateExplainRequest(NOTE, valid);
    expect(clean.ok).toBe(true);
    if (clean.ok) {
      expect(clean.request).not.toBe(valid);
      expect(Object.keys(clean.request).sort()).toEqual(['context', 'noteId', 'requestId', 'term']);
    }
  });

  it('rejects non-objects and non-string fields as shape failures', () => {
    for (const raw of [null, 42, 'x', undefined, {}, { ...valid, term: 7 }, { ...valid, requestId: {} }]) {
      expect(validateExplainRequest(NOTE, raw)).toEqual({ ok: false, reason: 'shape' });
    }
  });

  it('rejects a mismatched or oversized note id', () => {
    expect(validateExplainRequest(NOTE, { ...valid, noteId: 'other' })).toEqual({ ok: false, reason: 'note-id' });
    expect(validateExplainRequest(NOTE, { ...valid, noteId: '' })).toEqual({ ok: false, reason: 'note-id' });
    expect(validateExplainRequest(NOTE, { ...valid, noteId: 'n'.repeat(129) })).toEqual({ ok: false, reason: 'note-id' });
  });

  it('enforces the same inclusive term bounds as the builder', () => {
    expect(validateExplainRequest(NOTE, { ...valid, term: 'a' })).toEqual({ ok: false, reason: 'term' });
    expect(validateExplainRequest(NOTE, { ...valid, term: 'a'.repeat(MAX_TERM_LENGTH + 1) })).toEqual({ ok: false, reason: 'term' });
    expect(validateExplainRequest(NOTE, { ...valid, term: 'a'.repeat(MAX_TERM_LENGTH) }).ok).toBe(true);
    expect(validateExplainRequest(NOTE, { ...valid, term: 'ab' }).ok).toBe(true);
  });

  it('rejects contexts over the cap (unclamped) and out-of-range request ids', () => {
    expect(validateExplainRequest(NOTE, { ...valid, context: 'a'.repeat(MAX_CONTEXT_LENGTH + 1) })).toEqual({ ok: false, reason: 'context' });
    expect(validateExplainRequest(NOTE, { ...valid, context: 'a'.repeat(MAX_CONTEXT_LENGTH) }).ok).toBe(true);
    expect(validateExplainRequest(NOTE, { ...valid, requestId: '' })).toEqual({ ok: false, reason: 'request-id' });
    expect(validateExplainRequest(NOTE, { ...valid, requestId: 'r'.repeat(65) })).toEqual({ ok: false, reason: 'request-id' });
  });
});

describe('isApprovedLink', () => {
  it('approves absolute https URLs only', () => {
    for (const url of [
      'https://example.invalid/',
      'https://example.invalid/path?q=1#frag',
      'HTTPS://Example.COM/X',
      'https://example.invalid:8443/x',
    ]) {
      expect(isApprovedLink(url), url).toBe(true);
    }
  });

  it('rejects relative, fragment, protocol-relative, http and other schemes', () => {
    for (const url of [
      'http://example.com/',
      'javascript:alert(1)',
      'data:text/html,x',
      'mailto:a@b.c',
      'ftp://example.com/x',
      'file:///sdcard/x',
      '//example.com/x',
      '/app',
      '#sec-1',
      '',
      '   ',
      'https:',
      'https:/example.com',
      'https:\\\\evil.com',
      'https:///',
    ]) {
      expect(isApprovedLink(url), url).toBe(false);
    }
  });

  it('rejects embedded credentials in the authority', () => {
    expect(isApprovedLink('https://user:pass@example.com/')).toBe(false);
    expect(isApprovedLink('https://user@example.com/')).toBe(false);
    expect(isApprovedLink('https://example.com/@user/page')).toBe(true); // @ in the path is fine
  });

  it('rejects oversized URLs and non-strings', () => {
    expect(isApprovedLink(`https://example.com/${'a'.repeat(2100)}`)).toBe(false);
    expect(isApprovedLink(42)).toBe(false);
    expect(isApprovedLink(null)).toBe(false);
  });
});

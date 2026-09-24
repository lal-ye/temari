/**
 * DOM ↔ native action contract for checkpoint B.
 *
 * Pure and portable: no DOM, storage or network APIs. The DOM side builds
 * requests with `buildExplainRequest`; the native side re-validates every
 * inbound payload with `validateExplainRequest` and re-checks URLs with
 * `isApprovedLink` (defence in depth — the DOM is untrusted at that boundary).
 *
 * Bounds are inclusive and identical for construction and validation: the
 * validated result is always a fresh object with only the permitted fields,
 * never a pass-through of caller data.
 */

/** Serialized note fields plus top-level async actions — flat plain data only.
 * No DOM nodes, nested callbacks, storage objects or settings/keys. */
export interface ExplainRequest {
  /** The note being read (fixtures/mobile/reader-kitchen-sink.json "id"). */
  noteId: string;
  /** Recognised word or selection phrase, MIN_TERM_LENGTH..MAX_TERM_LENGTH. */
  term: string;
  /** Context window around the term, clamped to MAX_CONTEXT_LENGTH. */
  context: string;
  /** Caller-generated id; the native side accepts at most one active request. */
  requestId: string;
}

export interface OpenLinkRequest {
  url: string;
  requestId: string;
}

/** Top-level async actions — the only DOM→native calls (Expo DOM function props). */
export type ExplainAction = (request: ExplainRequest) => Promise<void>;
export type OpenLinkAction = (request: OpenLinkRequest) => Promise<void>;

export const MIN_TERM_LENGTH = 2;
/** Inclusive cap for a recognised term or selection phrase. The single-word
 * recognizer's stricter 48-char bound lives in `selection/segmentTerm`. */
export const MAX_TERM_LENGTH = 60;
/** Inclusive. `contextWindow` (segmentTerm) can produce 120 + 60 + 120 + 2
 * ellipses = 302 chars for a 60-char selection, so the builder clamps here. */
export const MAX_CONTEXT_LENGTH = 300;
export const MAX_REQUEST_ID = 64;
export const MAX_NOTE_ID_LENGTH = 128;
export const MAX_LINK_LENGTH = 2048;

export type ExplainRejection = 'shape' | 'note-id' | 'term' | 'context' | 'request-id';

let requestCounter = 0;

/** `crypto.randomUUID` where available, timestamp-counter-random fallback
 * (older WebViews and non-secure contexts). */
export function newRequestId(): string {
  const cryptoObj = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return `r-${cryptoObj.randomUUID()}`;
  }
  requestCounter = (requestCounter + 1) % 0xffffff;
  return `r-${Date.now().toString(36)}-${requestCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/** Truncate without leaving a dangling surrogate or combining sequence. */
function clampText(value: string, max: number): string {
  if (value.length <= max) return value;
  const slice = value.slice(0, max).replace(/[\uD800-\uDBFF]$/u, '');
  return slice.replace(/[\p{M}\uDC00-\uDFFF]+$/u, '');
}

function validTerm(term: string): boolean {
  return term.length >= MIN_TERM_LENGTH && term.length <= MAX_TERM_LENGTH;
}

/**
 * Build an ExplainRequest from recognised selection data. Returns null when
 * the term or note id is out of bounds; clamps an oversized context (the
 * 302-char `contextWindow` case) rather than rejecting.
 */
export function buildExplainRequest(input: {
  noteId: string;
  term: string;
  context: string;
}): ExplainRequest | null {
  const noteId = (input.noteId ?? '').trim();
  const term = (input.term ?? '').trim();
  const context = clampText((input.context ?? '').trim(), MAX_CONTEXT_LENGTH);
  if (noteId.length === 0 || noteId.length > MAX_NOTE_ID_LENGTH) return null;
  if (!validTerm(term)) return null;
  return { noteId, term, context, requestId: newRequestId() };
}

/**
 * Native-side validation. Accepts exactly the four string fields of
 * `ExplainRequest` (unknown keys are a shape failure — nothing else may cross
 * the bridge) and rebuilds a fresh object from them.
 */
export function validateExplainRequest(
  expectedNoteId: string,
  raw: unknown,
): { ok: true; request: ExplainRequest } | { ok: false; reason: ExplainRejection } {
  const fail = (reason: ExplainRejection) => ({ ok: false, reason }) as const;
  if (typeof raw !== 'object' || raw === null) return fail('shape');
  const fields = raw as Record<string, unknown>;
  for (const key of ['noteId', 'term', 'context', 'requestId']) {
    if (typeof fields[key] !== 'string') return fail('shape');
  }
  for (const key of Object.keys(fields)) {
    if (key !== 'noteId' && key !== 'term' && key !== 'context' && key !== 'requestId') {
      return fail('shape');
    }
  }
  const noteId = fields.noteId as string;
  const term = fields.term as string;
  const context = fields.context as string;
  const requestId = fields.requestId as string;
  if (noteId.length === 0 || noteId.length > MAX_NOTE_ID_LENGTH || noteId !== expectedNoteId) {
    return fail('note-id');
  }
  if (!validTerm(term)) return fail('term');
  if (context.length > MAX_CONTEXT_LENGTH) return fail('context');
  if (requestId.length === 0 || requestId.length > MAX_REQUEST_ID) return fail('request-id');
  return { ok: true, request: { noteId, term, context, requestId } };
}

/**
 * One URL policy for rendering-time approval and native validation: an
 * absolute https: URL, non-empty host, no embedded credentials, length cap.
 * Rejects relative, fragment-only, protocol-relative (`//host`) and every
 * non-https scheme. The sanitizer's `protocols` check is not this strict —
 * scheme-less values pass protocol filtering — so this predicate is the
 * actual "approved HTTPS" rule.
 */
export function isApprovedLink(raw: unknown): boolean {
  if (typeof raw !== 'string') return false;
  const url = raw.trim();
  if (url.length === 0 || url.length > MAX_LINK_LENGTH) return false;
  // Absolute https with a non-empty authority; fail closed on `https:\\…`
  // (browsers fold backslashes — we require the literal form).
  if (!/^https:\/\/[^\/?#]+/i.test(url)) return false;
  // Embedded username/password in the authority.
  if (/^https:\/\/[^\/?#]*@/i.test(url)) return false;
  const UrlCtor = (globalThis as { URL?: typeof URL }).URL;
  if (typeof UrlCtor === 'function') {
    try {
      const parsed = new UrlCtor(url);
      if (parsed.protocol !== 'https:') return false;
      if (!parsed.hostname) return false;
      if (parsed.username !== '' || parsed.password !== '') return false;
    } catch {
      return false;
    }
  }
  return true;
}

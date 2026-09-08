/**
 * Term recognition for "Explain with ተማሪ AI".
 *
 * Given a text node's contents and a caret offset (from
 * `caretPositionFromPoint`), find the word under the caret and a window of
 * surrounding text to send as context.
 *
 * Why this is its own module (docs/ui-plan-truthful-interaction.md §3): the
 * previous inline regex `/[\w\-\u1200-\u137F]/` was wrong in two directions.
 * `\w` is ASCII-only, so `café` split at the accent; and the Ethiopic block
 * includes its own punctuation — `፡` U+1361 (word space) and `።` U+1362
 * (full stop) — so adjacent Amharic words were glued into one "term".
 * `Intl.Segmenter` with `granularity: 'word'` gets both right and is
 * available in every browser Temari targets; the regex fallback below is
 * Unicode-aware (`\p{L}\p{M}\p{N}`) for the rare runtime without it.
 */

export interface TermAtOffset {
  /** The recognised word. */
  term: string;
  /** Character range of the term inside `text` (end exclusive). */
  start: number;
  end: number;
  /** Text around the term for the explainer, centred on it. */
  context: string;
}

/** Characters of context on each side of the term. */
export const CONTEXT_RADIUS = 120;

/** Longest term the explainer will accept; anything longer is not a "term". */
export const MAX_TERM_LENGTH = 48;

type SegmenterLike = {
  segment(input: string): Iterable<{ segment: string; index: number; isWordLike?: boolean }>;
};

let cachedSegmenter: SegmenterLike | null | undefined;

function getSegmenter(): SegmenterLike | null {
  if (cachedSegmenter !== undefined) return cachedSegmenter;
  const IntlAny = Intl as unknown as { Segmenter?: new (locales?: string | string[], options?: { granularity: string }) => SegmenterLike };
  try {
    // Locale is a hint only; word segmentation for Latin and Ethiopic scripts
    // is dictionary-free, so 'und' behaves the same as 'am' or 'en' here.
    cachedSegmenter = IntlAny.Segmenter ? new IntlAny.Segmenter('und', { granularity: 'word' }) : null;
  } catch {
    cachedSegmenter = null;
  }
  return cachedSegmenter;
}

/** Test seam: force the regex fallback path. */
export function __setSegmenterForTests(segmenter: SegmenterLike | null | undefined) {
  cachedSegmenter = segmenter;
}

const WORD_CHAR = /[\p{L}\p{M}\p{N}]/u;

/**
 * Finds the word-like segment containing `offset`. If the offset sits on a
 * boundary or on whitespace/punctuation, the nearest word to the left is
 * preferred (a caret at the end of a word still means that word), then the
 * nearest one to the right.
 */
export function termAtOffset(text: string, offset: number): TermAtOffset | null {
  if (!text) return null;
  const at = Math.max(0, Math.min(offset, text.length));

  const range = segmentWith(getSegmenter(), text, at) ?? null;
  if (!range) return null;

  const term = text.slice(range.start, range.end);
  if (term.length < 2 || term.length > MAX_TERM_LENGTH) return null;

  return { term, start: range.start, end: range.end, context: contextWindow(text, range.start, range.end) };
}

type Span = { start: number; end: number };

function segmentWith(segmenter: SegmenterLike | null, text: string, at: number): Span | null {
  if (segmenter) {
    let left: Span | null = null;
    for (const seg of segmenter.segment(text)) {
      if (!seg.isWordLike) continue;
      const span = { start: seg.index, end: seg.index + seg.segment.length };
      if (at > span.start && at < span.end) return span; // strictly inside
      if (span.end <= at) {
        left = span; // most recent word ending at or before the caret
        continue;
      }
      // First word starting at or after the caret: prefer the left neighbour.
      return left ?? span;
    }
    return left;
  }

  // Fallback: the same rule over letters, marks and digits.
  const isWord = (i: number) => i >= 0 && i < text.length && WORD_CHAR.test(text.charAt(i));
  let anchor = -1;
  if (isWord(at) && isWord(at - 1)) anchor = at; // inside a word
  else {
    for (let i = at - 1; i >= 0; i -= 1) if (isWord(i)) { anchor = i; break; } // nearest to the left
    if (anchor === -1) for (let i = at; i < text.length; i += 1) if (isWord(i)) { anchor = i; break; }
  }
  if (anchor === -1) return null;
  let start = anchor;
  let end = anchor + 1;
  while (isWord(start - 1)) start -= 1;
  while (isWord(end)) end += 1;
  return { start, end };
}

/**
 * A window of text centred on the term, trimmed to whole characters at the
 * edges. The previous implementation sent the parent's first 200 characters,
 * which for any term below the first sentence had nothing to do with it.
 */
export function contextWindow(text: string, start: number, end: number, radius = CONTEXT_RADIUS): string {
  const from = Math.max(0, start - radius);
  const to = Math.min(text.length, end + radius);
  let slice = text.slice(from, to);
  // Don't cut a surrogate pair or a combining sequence at either edge.
  if (from > 0) slice = slice.replace(/^[\p{M}\uDC00-\uDFFF]+/u, '');
  if (to < text.length) slice = slice.replace(/[\uD800-\uDBFF]$/u, '');
  return (from > 0 ? '…' : '') + slice.trim() + (to < text.length ? '…' : '');
}

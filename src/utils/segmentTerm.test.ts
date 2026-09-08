import { afterEach, describe, expect, it } from 'vitest';
import { __setSegmenterForTests, CONTEXT_RADIUS, contextWindow, termAtOffset } from './segmentTerm';

/**
 * Term recognition (docs/ui-plan-truthful-interaction.md §3, §7).
 * Both the Intl.Segmenter path and the regex fallback must agree on the
 * cases the old regex got wrong: `café` and Amharic punctuation.
 */
const modes: Array<['segmenter' | 'fallback', () => void]> = [
  ['segmenter', () => __setSegmenterForTests(undefined)],
  ['fallback', () => __setSegmenterForTests(null)],
];

afterEach(() => __setSegmenterForTests(undefined));

describe.each(modes)('termAtOffset (%s)', (_name, arm) => {
  it('finds an English word from a caret inside it', () => {
    arm();
    const r = termAtOffset('The mitochondria is the powerhouse.', 8);
    expect(r?.term).toBe('mitochondria');
    expect(r?.start).toBe(4);
    expect(r?.end).toBe(16);
  });

  it('keeps café whole', () => {
    arm();
    expect(termAtOffset('un café noir', 5)?.term).toBe('café');
    expect(termAtOffset('un café noir', 6)?.term).toBe('café');
  });

  it('splits Amharic words on the Ethiopic word space ፡', () => {
    arm();
    const text = 'ተማሪ፡መጽሐፍ';
    expect(termAtOffset(text, 1)?.term).toBe('ተማሪ');
    expect(termAtOffset(text, 5)?.term).toBe('መጽሐፍ');
  });

  it('does not glue the Ethiopic full stop ። onto a word', () => {
    arm();
    const text = 'ተማሪ መጽሐፍ ነው። ሌላ';
    const r = termAtOffset(text, 10);
    expect(r?.term).toBe('ነው');
  });

  it('treats a caret at the end of a word as that word', () => {
    arm();
    expect(termAtOffset('alpha beta', 5)?.term).toBe('alpha');
  });

  it('on whitespace, takes the word to the left, else the right', () => {
    arm();
    expect(termAtOffset('alpha  beta', 6)?.term).toBe('alpha');
    expect(termAtOffset('  beta', 1)?.term).toBe('beta');
  });

  it('accepts digits as terms', () => {
    arm();
    expect(termAtOffset('in 1896 at Adwa', 4)?.term).toBe('1896');
  });

  it('rejects single characters and over-long runs', () => {
    arm();
    expect(termAtOffset('a b c', 0)).toBeNull();
    expect(termAtOffset('x'.repeat(60), 30)).toBeNull();
  });

  it('returns null for empty text or text without words', () => {
    arm();
    expect(termAtOffset('', 0)).toBeNull();
    expect(termAtOffset('… — !!', 2)).toBeNull();
  });

  it('clamps out-of-range offsets', () => {
    arm();
    expect(termAtOffset('alpha', 99)?.term).toBe('alpha');
    expect(termAtOffset('alpha', -5)?.term).toBe('alpha');
  });
});

describe('contextWindow', () => {
  it('is centred on the term, not the start of the paragraph', () => {
    const filler = 'lorem ipsum '.repeat(40); // 480 chars
    const text = `${filler}osmosis${filler}`;
    const start = filler.length;
    const ctx = contextWindow(text, start, start + 'osmosis'.length);
    expect(ctx).toContain('osmosis');
    expect(ctx.startsWith('…')).toBe(true);
    expect(ctx.endsWith('…')).toBe(true);
    // ±radius plus ellipses and trimming: never much longer than the window.
    expect(ctx.length).toBeLessThanOrEqual(2 * CONTEXT_RADIUS + 'osmosis'.length + 2);
    expect(ctx.length).toBeGreaterThan(CONTEXT_RADIUS);
  });

  it('has no ellipsis on an edge that reaches the text boundary', () => {
    const ctx = contextWindow('Short text about osmosis.', 17, 24);
    expect(ctx).toBe('Short text about osmosis.');
  });

  it('does not begin with a stranded combining mark', () => {
    // 'e' + U+0301 repeated so the cut lands inside a combining sequence.
    const text = `${'x'.repeat(CONTEXT_RADIUS + 1)}e\u0301 term`;
    const start = text.indexOf('term');
    const ctx = contextWindow(text, start, start + 4);
    expect(ctx.charCodeAt(1)).not.toBe(0x0301);
  });
});

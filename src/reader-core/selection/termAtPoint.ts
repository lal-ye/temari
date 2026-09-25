import { contextWindow, termAtOffset } from './segmentTerm';

/** What a long-press recognised: the term, its context, and where it is on screen. */
export interface RecognisedTerm {
  term: string;
  context: string;
  /** Client rects of the term's text range, for the highlight. */
  rects: DOMRect[];
}

/**
 * Resolves the word under a screen point to a text range, using
 * `caretPositionFromPoint` (WebKit's `caretRangeFromPoint` as a fallback)
 * and the Unicode-aware segmenter in `segmentTerm`. Returns the
 * term's client rects so the UI can show *which* text was recognised — the
 * word is under the learner's finger for the whole press, so without this
 * they are guessing (docs/ui-plan-truthful-interaction.md §3).
 */
export function recogniseTermAtPoint(x: number, y: number, within: HTMLElement | null): RecognisedTerm | null {
  if (typeof document === 'undefined') return null;

  let node: Node | null = null;
  let offset = 0;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  if (within && !within.contains(node)) return null;
  // Not inside code or maths: those are not "terms" in the learner's sense.
  const parentEl = node.parentElement;
  if (parentEl?.closest('pre, code, .katex, svg')) return null;

  const text = node.textContent ?? '';
  const found = termAtOffset(text, offset);
  if (!found) return null;

  // The highlight is a bonus; the term is the point. Never let a missing
  // rect API stop recognition.
  let rects: DOMRect[] = [];
  try {
    const range = document.createRange();
    range.setStart(node, found.start);
    range.setEnd(node, found.end);
    rects = typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
  } catch {
    rects = [];
  }

  // Context: the enclosing block's text, windowed around the term.
  const block = parentEl?.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption') ?? parentEl;
  const blockText = block?.textContent ?? text;
  const idxInBlock = blockText.indexOf(found.term);
  const context =
    idxInBlock >= 0 ? contextWindow(blockText, idxInBlock, idxInBlock + found.term.length) : found.context;

  return { term: found.term, context, rects };
}

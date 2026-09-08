import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  getReadingPlace,
  markReturnPoint,
  pickAnchor,
  resolvePlace,
  setReadingPlace,
  takeReturnPoint,
  type HeadingPosition,
  type ReadingPlace,
} from '../../services/readingPlace';
import { prefersReducedMotion } from '../../utils/viewTransition';

/** One heading in the rendered Note, for the outline and for anchoring. */
export interface NoteHeading {
  id: string;
  text: string;
  level: 1 | 2 | 3;
}

interface Options {
  subjectId: string;
  noteId: string;
  /** `StoredNote.updatedAt`; a different value means the headings may have moved. */
  contentRevision: string;
  /** The rendered Markdown container. */
  contentRef: React.RefObject<HTMLElement | null>;
}

/**
 * Restores and records the learner's reading place for one mounted Note
 * (docs/ui-plan-truthful-interaction.md §5).
 *
 * The scroll container is whichever ancestor actually scrolls — found from
 * the content, not hard-coded, because the class on `App`'s `<main>` is a
 * styling detail.
 *
 * Restoration runs after mount, again once fonts are ready, and again after
 * two frames (diagram SVGs and KaTeX settle their height late). Each pass
 * re-resolves against the current heading positions, so an anchor that has
 * moved down 30px as a font swapped in is still honoured. Restoration stops
 * the moment the learner scrolls themselves.
 *
 * Recording is throttled to animation frames. Resizes only re-record; they
 * never trigger a restore.
 */
export function useReadingPlace({ subjectId, noteId, contentRevision, contentRef }: Options) {
  const [headings, setHeadings] = useState<NoteHeading[]>([]);
  const scrollerRef = useRef<HTMLElement | null>(null);
  /** True while our own programmatic scrolls are landing, so they are not mistaken for the learner scrolling. */
  const restoringRef = useRef(false);
  const userScrolledRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const measure = useCallback((): HeadingPosition[] => {
    const content = contentRef.current;
    const scroller = scrollerRef.current;
    if (!content || !scroller) return [];
    const scrollerTop = scroller.getBoundingClientRect().top;
    const nodes = content.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]');
    // Positions are relative to the scroller's content origin: distance from
    // the scroller's visible top, plus how far it is already scrolled.
    return Array.from(nodes).map((el) => ({
      id: el.id,
      top: el.getBoundingClientRect().top - scrollerTop + scroller.scrollTop,
    }));
  }, [contentRef]);

  /** The visible content top, in the scroller's coordinates, accounting for the Note's own chrome above the body. */
  const contentTopInScroller = useCallback((): number => {
    const content = contentRef.current;
    const scroller = scrollerRef.current;
    if (!content || !scroller) return 0;
    return content.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
  }, [contentRef]);

  /** Heading positions relative to the Note body's top (not the page's), so the hub header above the Note never leaks into offsets. */
  const positions = useCallback((): HeadingPosition[] => {
    const base = contentTopInScroller();
    return measure().map((h) => ({ ...h, top: h.top - base }));
  }, [measure, contentTopInScroller]);

  const record = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const relativeTop = scroller.scrollTop - contentTopInScroller();
    const anchor = pickAnchor(positions(), relativeTop);
    setReadingPlace(subjectId, { noteId, contentRevision, ...anchor });
  }, [subjectId, noteId, contentRevision, positions, contentTopInScroller]);

  const scrollTo = useCallback(
    (top: number, behaviour: ScrollBehavior) => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      const clamped = Math.min(Math.max(0, top), max);
      restoringRef.current = true;
      if (typeof scroller.scrollTo === 'function') {
        scroller.scrollTo({ top: clamped, behavior: behaviour });
      } else {
        // Engines without Element.scrollTo(options): no smooth scroll, same place.
        scroller.scrollTop = clamped;
      }
      // Smooth scrolls emit scroll events for a while; release after they settle.
      window.setTimeout(() => {
        restoringRef.current = false;
      }, behaviour === 'smooth' ? 400 : 50);
    },
    []
  );

  /** Scroll so that `place` is at the top of the viewport (if it resolves). Returns whether it did. */
  const applyPlace = useCallback(
    (place: ReadingPlace | null, behaviour: ScrollBehavior): boolean => {
      const scroller = scrollerRef.current;
      if (!scroller) return false;
      const resolution = resolvePlace(place, noteId, contentRevision, positions());
      if (resolution.kind === 'restore') {
        scrollTo(contentTopInScroller() + resolution.scrollTop, behaviour);
        return true;
      }
      return false;
    },
    [noteId, contentRevision, positions, contentTopInScroller, scrollTo]
  );

  // Find the scroller and collect headings whenever the Note (or its revision) changes.
  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    scrollerRef.current = findScrollParent(content);
    const nodes = content.querySelectorAll<HTMLElement>('h1[id], h2[id], h3[id]');
    setHeadings(
      Array.from(nodes).map((el) => ({
        id: el.id,
        text: (el.textContent ?? '').trim(),
        level: Number(el.tagName.charAt(1)) as 1 | 2 | 3,
      }))
    );
  }, [contentRef, noteId, contentRevision]);

  // Restore on mount, after fonts, and after late layout; stop if the learner scrolls.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    userScrolledRef.current = false;

    const place = getReadingPlace(subjectId);
    // Markdown renders synchronously, so the headings are already in the DOM.
    const resolution = resolvePlace(place, noteId, contentRevision, positions());
    // A stale place (edited Note, or a different Note) means: start at the
    // top. The `record` below replaces it with an honest one.
    if (resolution.kind === 'top' || resolution.kind === 'none') {
      if (place && place.noteId === noteId) {
        // Same Note, unusable position (edited underneath us): the Note
        // body top is the honest start.
        scrollTo(contentTopInScroller(), 'auto');
      } else if (place && place.noteId !== noteId) {
        // Switched Notes: begin at the top of the new one.
        scrollTo(0, 'auto');
      }
      record();
      return;
    }

    let cancelled = false;
    const attempt = () => {
      if (cancelled || userScrolledRef.current) return;
      applyPlace(place, 'auto');
    };
    attempt();
    const raf1 = requestAnimationFrame(() => requestAnimationFrame(attempt));
    const fonts = typeof document !== 'undefined' ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
    fonts?.ready.then(() => requestAnimationFrame(attempt)).catch(() => {});
    // Diagrams and images can still land later; one last pass.
    const late = window.setTimeout(attempt, 600);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      window.clearTimeout(late);
    };
  }, [subjectId, noteId, contentRevision, positions, applyPlace, record, scrollTo, contentTopInScroller]);

  // Record on scroll (throttled to a frame); resizes re-record only.
  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const onScroll = () => {
      // Our own programmatic scrolls (restore, jump, return) are neither a
      // user scroll nor worth recording mid-flight; their callers record
      // once they land.
      if (restoringRef.current) return;
      userScrolledRef.current = true;
      if (frameRef.current !== null) return;
      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        record();
      });
    };
    const onResize = () => record();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onResize);
    return () => {
      scroller.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    };
  }, [record]);

  /**
   * Jump to a heading, remembering where the learner was so they can come
   * back. Used by the outline; search-in-note can use it too.
   */
  const jumpTo = useCallback(
    (headingId: string) => {
      const target = measure().find((h) => h.id === headingId);
      if (!target) return;
      // Save the departure point first, so "Return to reading" has
      // somewhere honest to go. Only for this Note: a stale place from
      // another Note is not where the learner "was".
      const current = getReadingPlace(subjectId);
      if (current && current.noteId === noteId && current.contentRevision === contentRevision) {
        markReturnPoint(subjectId, current);
      }
      // Leave a little room above the heading so it reads as a section start.
      scrollTo(target.top - 12, prefersReducedMotion() ? 'auto' : 'smooth');
      // Record the destination once the scroll lands; the scroll listener
      // ignores our own programmatic scroll while `restoringRef` is set.
      window.setTimeout(record, 450);
    },
    [subjectId, noteId, contentRevision, measure, scrollTo, record]
  );

  /** Go back to the place saved before the last jump. */
  const returnToReading = useCallback(() => {
    const point = takeReturnPoint(subjectId);
    if (!point) return;
    if (!applyPlace(point, prefersReducedMotion() ? 'auto' : 'smooth')) {
      // The Note changed underneath us; nothing honest to return to.
      return;
    }
    window.setTimeout(record, 450);
  }, [subjectId, applyPlace, record]);

  return { headings, jumpTo, returnToReading };
}

/** Nearest ancestor that actually scrolls vertically; falls back to the document's scrolling element. */
export function findScrollParent(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el.parentElement;
  while (node) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node;
    node = node.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

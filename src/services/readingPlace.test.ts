import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearReadingPlace,
  getReadingPlace,
  getReturnPoint,
  markReturnPoint,
  pickAnchor,
  resetReadingPlaces,
  resolvePlace,
  setReadingPlace,
  takeReturnPoint,
  type HeadingPosition,
  type ReadingPlace,
} from './readingPlace';

/**
 * Reading continuity (docs/ui-plan-truthful-interaction.md §5, §7):
 * anchor picking, restoration rules (revision mismatch → top, missing anchor
 * → top), and the session store's return-point lifecycle.
 */

const headings: HeadingPosition[] = [
  { id: 'sec-1', top: 100 },
  { id: 'sec-2', top: 400 },
  { id: 'sec-3', top: 400 }, // duplicate position (two headings back to back)
  { id: 'sec-4', top: 900 },
];

describe('pickAnchor', () => {
  it('before the first heading, anchors to the content top', () => {
    expect(pickAnchor(headings, 40)).toEqual({ anchorId: null, offset: 40 });
  });

  it('picks the last heading at or above the scroll position', () => {
    expect(pickAnchor(headings, 250)).toEqual({ anchorId: 'sec-1', offset: 150 });
    expect(pickAnchor(headings, 950)).toEqual({ anchorId: 'sec-4', offset: 50 });
  });

  it('a heading sitting just below the top edge still counts (slack)', () => {
    expect(pickAnchor(headings, 395)).toEqual({ anchorId: 'sec-3', offset: 0 });
  });

  it('with duplicate positions, the later heading wins (its index is what we store)', () => {
    expect(pickAnchor(headings, 500).anchorId).toBe('sec-3');
  });

  it('never returns a negative offset', () => {
    expect(pickAnchor(headings, -20)).toEqual({ anchorId: null, offset: 0 });
  });

  it('handles a Note with no headings', () => {
    expect(pickAnchor([], 300)).toEqual({ anchorId: null, offset: 300 });
  });
});

describe('resolvePlace', () => {
  const place: ReadingPlace = { noteId: 'n1', contentRevision: 'r1', anchorId: 'sec-2', offset: 60 };

  it('restores relative to the anchor in the current layout', () => {
    // Layout shifted: the fonts loaded and sec-2 is now at 420.
    const shifted = headings.map((h) => (h.id === 'sec-2' ? { ...h, top: 420 } : h));
    expect(resolvePlace(place, 'n1', 'r1', shifted)).toEqual({ kind: 'restore', scrollTop: 480 });
  });

  it('is nothing for a different Note or no place', () => {
    expect(resolvePlace(place, 'n2', 'r1', headings)).toEqual({ kind: 'none' });
    expect(resolvePlace(null, 'n1', 'r1', headings)).toEqual({ kind: 'none' });
  });

  it('starts at the top when the Note was edited since', () => {
    expect(resolvePlace(place, 'n1', 'r2', headings)).toEqual({ kind: 'top', reason: 'revision' });
  });

  it('starts at the top when the anchor no longer exists', () => {
    const fewer = headings.slice(0, 1);
    expect(resolvePlace(place, 'n1', 'r1', fewer)).toEqual({ kind: 'top', reason: 'missing-anchor' });
  });

  it('restores a pre-heading position by raw offset', () => {
    const early: ReadingPlace = { ...place, anchorId: null, offset: 33 };
    expect(resolvePlace(early, 'n1', 'r1', headings)).toEqual({ kind: 'restore', scrollTop: 33 });
  });
});

describe('reading place store', () => {
  beforeEach(() => resetReadingPlaces());
  afterEach(() => resetReadingPlaces());

  const p1: ReadingPlace = { noteId: 'n1', contentRevision: 'r1', anchorId: 'sec-1', offset: 10 };
  const p2: ReadingPlace = { noteId: 'n2', contentRevision: 'r1', anchorId: null, offset: 0 };

  it('is empty by default and remembers per Subject', () => {
    expect(getReadingPlace('s1')).toBeNull();
    setReadingPlace('s1', p1);
    setReadingPlace('s2', p2);
    expect(getReadingPlace('s1')).toEqual(p1);
    expect(getReadingPlace('s2')).toEqual(p2);
  });

  it('clears', () => {
    setReadingPlace('s1', p1);
    clearReadingPlace('s1');
    expect(getReadingPlace('s1')).toBeNull();
  });

  it('keeps a return point until it is taken', () => {
    setReadingPlace('s1', p1);
    markReturnPoint('s1', p1);
    expect(getReturnPoint('s1')).toEqual(p1);
    setReadingPlace('s1', { ...p1, anchorId: 'sec-3', offset: 5 }); // scrolled after the jump
    expect(getReturnPoint('s1')).toEqual(p1); // still there
    expect(takeReturnPoint('s1')).toEqual(p1);
    expect(getReturnPoint('s1')).toBeNull();
    expect(takeReturnPoint('s1')).toBeNull();
  });

  it('drops the return point when the Note changes', () => {
    setReadingPlace('s1', p1);
    markReturnPoint('s1', p1);
    setReadingPlace('s1', p2);
    expect(getReturnPoint('s1')).toBeNull();
  });
});

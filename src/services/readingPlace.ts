import { useSyncExternalStore } from 'react';

/**
 * Reading place — where the learner was in a Note, so Temari can put them
 * back there.
 *
 * `App` conditionally mounts each hub and the selected Note is local state
 * in `NotesManager`, so switching to Quizzes and back used to lose both the
 * Note and the scroll position. This module holds that state *above* the
 * hub lifetime and persists it to `sessionStorage`, so it also survives a
 * reload within the tab.
 *
 * It is UI/session state, not study data: nothing here roams across
 * devices, and it stays out of `studyStore` (ADR-0001 is about study data).
 * Same tiny external-store pattern as `toast.tsx` / `confirm.tsx`.
 *
 * Positions are recorded relative to a **heading anchor** rather than as a
 * raw `scrollTop`: font loading, diagram layout and viewport width all move
 * pixels around, but "40px below the third heading" survives all three.
 * Anchor ids are assigned *by index* (`sec-1`, `sec-2`, …) in the Note's
 * heading renderers, so duplicate headings and Amharic headings both work,
 * and `contentRevision` (the Note's `updatedAt`) guards against an edit
 * having moved them.
 *
 * (docs/ui-plan-truthful-interaction.md §5)
 */

export interface ReadingPlace {
  noteId: string;
  /** `StoredNote.updatedAt` when the place was recorded. */
  contentRevision: string;
  /** Nearest heading at or above the viewport top; `null` = before the first heading. */
  anchorId: string | null;
  /** Pixels below that heading (or below the content top when `anchorId` is null). */
  offset: number;
}

/** One heading as the DOM knows it: its id and its top edge relative to the content top. */
export interface HeadingPosition {
  id: string;
  top: number;
}

/**
 * Picks the anchor for a scroll position: the last heading whose top is at
 * or above `scrollTop` (with a little slack so a heading sitting exactly at
 * the top still counts), and the distance below it.
 */
export function pickAnchor(
  headings: readonly HeadingPosition[],
  scrollTop: number,
  slack = 8
): Pick<ReadingPlace, 'anchorId' | 'offset'> {
  let anchor: HeadingPosition | null = null;
  for (const h of headings) {
    if (h.top <= scrollTop + slack) anchor = h;
    else break;
  }
  if (!anchor) return { anchorId: null, offset: Math.max(0, scrollTop) };
  return { anchorId: anchor.id, offset: Math.max(0, scrollTop - anchor.top) };
}

export type Resolution =
  | { kind: 'restore'; scrollTop: number }
  /** Same Note, but it was edited or the anchor is gone: start at the top. */
  | { kind: 'top'; reason: 'revision' | 'missing-anchor' }
  /** Not this Note (or no place at all): nothing to do. */
  | { kind: 'none' };

/**
 * Turns a recorded place back into a scroll position for the current DOM.
 * The result is clamped by the caller (it knows `scrollHeight`); this only
 * decides whether restoration is legitimate.
 */
export function resolvePlace(
  place: ReadingPlace | null,
  noteId: string,
  contentRevision: string,
  headings: readonly HeadingPosition[]
): Resolution {
  if (!place || place.noteId !== noteId) return { kind: 'none' };
  if (place.contentRevision !== contentRevision) return { kind: 'top', reason: 'revision' };
  if (place.anchorId === null) return { kind: 'restore', scrollTop: Math.max(0, place.offset) };
  const anchor = headings.find((h) => h.id === place.anchorId);
  if (!anchor) return { kind: 'top', reason: 'missing-anchor' };
  return { kind: 'restore', scrollTop: Math.max(0, anchor.top + place.offset) };
}

// --- Store -------------------------------------------------------------------

const STORAGE_PREFIX = 'temari:reading-place:';

type SubjectId = string;

interface StoreState {
  /** Current place per Subject. */
  places: Record<SubjectId, ReadingPlace>;
  /** Departure point saved before a jump, per Subject. Cleared when used or when the Note changes. */
  returns: Record<SubjectId, ReadingPlace>;
}

let state: StoreState = { places: {}, returns: {} };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function isPlace(v: unknown): v is ReadingPlace {
  if (!v || typeof v !== 'object') return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.noteId === 'string' &&
    typeof p.contentRevision === 'string' &&
    (p.anchorId === null || typeof p.anchorId === 'string') &&
    typeof p.offset === 'number' &&
    Number.isFinite(p.offset)
  );
}

function load(subjectId: SubjectId): ReadingPlace | null {
  if (state.places[subjectId]) return state.places[subjectId];
  const raw = storage()?.getItem(STORAGE_PREFIX + subjectId);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (isPlace(parsed)) {
      state = { ...state, places: { ...state.places, [subjectId]: parsed } };
      return parsed;
    }
  } catch {
    // Corrupt entry: ignore it.
  }
  storage()?.removeItem(STORAGE_PREFIX + subjectId);
  return null;
}

function persist(subjectId: SubjectId, place: ReadingPlace | null) {
  const s = storage();
  if (!s) return;
  try {
    if (place) s.setItem(STORAGE_PREFIX + subjectId, JSON.stringify(place));
    else s.removeItem(STORAGE_PREFIX + subjectId);
  } catch {
    // Quota or privacy mode: the in-memory copy still works for this session.
  }
}

/** Non-reactive read (for effects). */
export function getReadingPlace(subjectId: SubjectId): ReadingPlace | null {
  return load(subjectId);
}

/** Record where the learner is. Cheap to call from a throttled scroll handler. */
export function setReadingPlace(subjectId: SubjectId, place: ReadingPlace) {
  const prev = state.places[subjectId];
  if (
    prev &&
    prev.noteId === place.noteId &&
    prev.contentRevision === place.contentRevision &&
    prev.anchorId === place.anchorId &&
    prev.offset === place.offset
  ) {
    return;
  }
  // A new Note makes any pending "return to reading" for the old one meaningless.
  const returns = prev && prev.noteId !== place.noteId ? omit(state.returns, subjectId) : state.returns;
  state = { ...state, places: { ...state.places, [subjectId]: place }, returns };
  persist(subjectId, place);
  emit();
}

/** Forget the place (e.g. the Note was deleted). */
export function clearReadingPlace(subjectId: SubjectId) {
  if (!state.places[subjectId] && !state.returns[subjectId]) {
    persist(subjectId, null);
    return;
  }
  state = { ...state, places: omit(state.places, subjectId), returns: omit(state.returns, subjectId) };
  persist(subjectId, null);
  emit();
}

/**
 * Before a jump (outline, search), remember where the learner was so a
 * "Return to reading" affordance can take them back. Persistent until used
 * or until the Note changes — not a timed toast.
 */
export function markReturnPoint(subjectId: SubjectId, place: ReadingPlace) {
  state = { ...state, returns: { ...state.returns, [subjectId]: place } };
  emit();
}

/** Consume the return point (the learner used it, or dismissed it). */
export function takeReturnPoint(subjectId: SubjectId): ReadingPlace | null {
  const r = state.returns[subjectId] ?? null;
  if (r) {
    state = { ...state, returns: omit(state.returns, subjectId) };
    emit();
  }
  return r;
}

export function getReturnPoint(subjectId: SubjectId): ReadingPlace | null {
  return state.returns[subjectId] ?? null;
}

/** Reactive read of the pending return point, for the pill. */
export function useReturnPoint(subjectId: SubjectId | null | undefined): ReadingPlace | null {
  return useSyncExternalStore(
    subscribe,
    () => (subjectId ? state.returns[subjectId] ?? null : null),
    () => null
  );
}

/** Reactive read of the current place (mostly for tests and debugging). */
export function useReadingPlace(subjectId: SubjectId | null | undefined): ReadingPlace | null {
  return useSyncExternalStore(
    subscribe,
    () => (subjectId ? state.places[subjectId] ?? null : null),
    () => null
  );
}

/** Test seam. */
export function resetReadingPlaces() {
  const s = storage();
  if (s) {
    const keys: string[] = [];
    for (let i = 0; i < s.length; i += 1) {
      const k = s.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) keys.push(k);
    }
    keys.forEach((k) => s.removeItem(k));
  }
  state = { places: {}, returns: {} };
  emit();
}

function omit<T>(record: Record<string, T>, key: string): Record<string, T> {
  if (!(key in record)) return record;
  const { [key]: _dropped, ...rest } = record;
  return rest;
}

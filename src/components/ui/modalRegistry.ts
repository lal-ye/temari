import { useSyncExternalStore } from 'react';

/**
 * Modal registry: one place that knows whether *any* dialog-like surface is
 * open, regardless of where in the tree it lives.
 *
 * Why this exists. Temari has three kinds of keyboard owner that used to be
 * unaware of each other: the app-level shortcut listener (keys 1-5, "?"),
 * the Drill's own key handling, and whatever dialog happens to be open. The
 * app listener guarded only against the modals *it* rendered, so a Generate
 * modal opened inside a hub was invisible to it: pressing "2" would switch
 * hubs and unmount the modal mid-generation. The Drill listened on `window`
 * with no guard at all, so Space inside the explainer flipped the card
 * underneath.
 *
 * Ownership is now explicit: every `Modal`, the command palette and the
 * shortcuts overlay register while open; anything that reacts to global keys
 * consults `useAnyModalOpen()` (or `isAnyModalOpen()` in a listener) first.
 *
 * The registry is ordered (a `Set` keeps insertion order), which also settles
 * *which* dialog owns Escape when two are open. Base UI arbitrates that only
 * for dialogs nested in each other's React tree; `confirm()` renders from its
 * own region near the root, so a confirm raised over the Add Subject modal is
 * a sibling, not a child, and both would answer the same Escape. The most
 * recently opened dialog is topmost — see `isTopmostModal`.
 *
 * The store is a tiny external store in the same style as `toast.tsx` and
 * `confirm.tsx`; it holds no study data (ADR-0001 is not involved).
 */

const openIds = new Set<string>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  for (const l of listeners) l();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return version;
}

/** Register an open modal. Returns the matching unregister function. */
export function registerOpenModal(id: string): () => void {
  openIds.add(id);
  emit();
  return () => {
    if (openIds.delete(id)) emit();
  };
}

/** Non-reactive read, for use inside event listeners. */
export function isAnyModalOpen(): boolean {
  return openIds.size > 0;
}

/**
 * Whether `id` is the most recently opened modal. Dismissal gestures that
 * reach every open dialog (Escape) should only act on the topmost one.
 */
export function isTopmostModal(id: string): boolean {
  let last: string | undefined;
  for (const openId of openIds) last = openId;
  return last === id;
}

/** Reactive read, for components that render differently while a modal is open. */
export function useAnyModalOpen(): boolean {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return openIds.size > 0;
}

/** Test seam: clear all registrations. */
export function resetModalRegistry() {
  openIds.clear();
  emit();
}

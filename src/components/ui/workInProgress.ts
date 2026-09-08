import { useSyncExternalStore } from 'react';

/**
 * Work-in-progress registry: one place that knows whether leaving the
 * current screen would throw away something the learner is in the middle of.
 *
 * Why this exists. `App` conditionally mounts each hub, and a timed exam
 * is local state inside the Exams hub. Pressing "1", clicking another hub
 * tab, or picking a hub in the command palette unmounted the exam with no
 * warning — twenty minutes of answers gone, nothing recorded. The hub cannot
 * stop that from the inside; the navigation code has to ask first.
 *
 * Any surface with unsaveable, time-bound work registers while it is live
 * (the exam today; a long generation could too). Navigation consults
 * `getWorkInProgress()` and confirms before unmounting. Reload and tab close
 * get the browser's own `beforeunload` prompt for the same reason.
 *
 * Same tiny external-store shape as `modalRegistry.ts`; holds no study data.
 */

interface Work {
  id: string;
  /** Short noun phrase for the prompt: "your exam". */
  label: string;
}

const work = new Map<string, Work>();
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

function onBeforeUnload(e: BeforeUnloadEvent) {
  e.preventDefault();
  // Modern browsers show their own generic text; the return value is legacy.
  e.returnValue = '';
}

/** Register live work. Returns the matching unregister function. */
export function registerWorkInProgress(id: string, label: string): () => void {
  const wasEmpty = work.size === 0;
  work.set(id, { id, label });
  if (wasEmpty && typeof window !== 'undefined') window.addEventListener('beforeunload', onBeforeUnload);
  emit();
  return () => {
    if (!work.delete(id)) return;
    if (work.size === 0 && typeof window !== 'undefined') window.removeEventListener('beforeunload', onBeforeUnload);
    emit();
  };
}

/** Non-reactive read, for navigation handlers. The most recent registration wins. */
export function getWorkInProgress(): Work | null {
  let last: Work | null = null;
  for (const w of work.values()) last = w;
  return last;
}

/** Reactive read, for components that render differently while work is live. */
export function useWorkInProgress(): Work | null {
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return getWorkInProgress();
}

/** Test seam. */
export function resetWorkInProgress() {
  work.clear();
  if (typeof window !== 'undefined') window.removeEventListener('beforeunload', onBeforeUnload);
  emit();
}

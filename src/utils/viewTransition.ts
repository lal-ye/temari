/**
 * Native CSS View Transitions for lateral navigation (tab switching → cross-fade).
 * Degrades gracefully: browsers without `document.startViewTransition` get an
 * instant swap. See ADR-0004 for why we use the platform API over react@canary.
 */
type VTDoc = Document & { startViewTransition?: (update: () => void) => void };

export function runViewTransition(update: () => void): void {
  const d = document as VTDoc;
  if (typeof d.startViewTransition === 'function') {
    d.startViewTransition(update);
  } else {
    update();
  }
}
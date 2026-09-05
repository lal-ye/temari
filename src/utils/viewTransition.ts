/**
 * Native CSS View Transitions for lateral navigation (tab switching → cross-fade).
 * Degrades gracefully: browsers without `document.startViewTransition` get an
 * instant swap. See ADR-0004 for why we use the platform API over react@canary.
 */
type VTDoc = Document & { startViewTransition?: (update: () => void) => void };

/**
 * Where an interaction came from. Keyboard-initiated actions are never
 * animated: the learner already knows what they asked for, and a transition
 * they see hundreds of times a day is pure latency (learn-ui, "Frequency and
 * novelty"). Pointer-initiated actions get the standard cross-fade.
 */
export type InteractionOrigin = 'pointer' | 'keyboard';

export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

interface ViewTransitionOptions {
  /** Skip the transition and apply the update synchronously. */
  skip?: boolean;
  /** Origin of the interaction; 'keyboard' implies skip. */
  origin?: InteractionOrigin;
}

export function runViewTransition(update: () => void, options: ViewTransitionOptions = {}): void {
  const { skip = false, origin = 'pointer' } = options;

  if (skip || origin === 'keyboard' || prefersReducedMotion()) {
    update();
    return;
  }

  const d = document as VTDoc;
  if (typeof d.startViewTransition === 'function') {
    d.startViewTransition(update);
  } else {
    update();
  }
}
/**
 * Flashcard swipe gesture as a pure reducer.
 *
 * `FlashcardView` used to keep this logic in five refs and three pieces of
 * state spread across four pointer handlers, and two things were wrong with
 * it that no amount of reading could prove or disprove without a device:
 *
 * 1. **No pointer ownership.** A second finger re-ran `pointerdown`,
 *    overwrote the start point and reset the drag. `setPointerCapture` does
 *    not help — it routes one pointer's events; it does not stop another
 *    pointer from delivering its own.
 * 2. **Interruption state was set and then reset in the same handler.**
 *    Grabbing a settling card adopted its live offset and axis, then the very
 *    next lines zeroed both, so the card hard-cut to rest and a tap during
 *    the settle flipped it.
 *
 * This module is the fix and the test surface (the repo has no jsdom; see
 * `designSystem.test.ts`). It knows nothing about the DOM: the component
 * reads the live transform, builds a `GestureEvent`, calls `reduce`, applies
 * the returned state to the card and performs the returned effect.
 *
 * Ownership rules (docs/ui-plan-truthful-interaction.md §2):
 *   - one `activePointerId` owns a gesture; other pointers cannot move,
 *     finish or reset it;
 *   - only a primary, main-button pointer can start one;
 *   - `cancel` / `lostCapture` from the owner clears ownership, settles to
 *     rest and commits NOTHING;
 *   - after release, a NEW pointer may interrupt the settle and continue
 *     from the live position, and a tap while interrupting catches the card
 *     rather than flipping it.
 *
 * Commit rules (ADR-0005 §3): navigation is lightweight and reversible, so it
 * commits mid-swipe once the card passes the threshold; rating records state,
 * so it commits only on release. Velocity is a trigger alongside distance.
 *
 * Vertical rating swipe is off by default (§6b, option A): the card surface
 * uses `touch-action: pan-y pinch-zoom`, so the browser owns vertical pans
 * and pinches and reports them to us as `cancel`. The rating buttons are the
 * primary rating controls. `allowVerticalRating` exists so the decision can
 * be revisited without touching the reducer.
 */

export type Axis = 'horizontal' | 'vertical';

export interface GestureState {
  /** Pointer that owns the current gesture; `null` when idle. */
  activePointerId: number | null;
  /** Where the owning pointer went down. */
  start: { x: number; y: number; time: number } | null;
  /** Most recent sample from the owning pointer (for velocity). */
  last: { x: number; y: number; time: number } | null;
  /** Card offset adopted from a settling card at pointerdown. */
  base: { x: number; y: number };
  /** Current visual offset of the card. */
  offset: { x: number; y: number };
  /** Locked drag axis, once movement exceeds the slop. */
  axis: Axis | null;
  /** Whether this gesture moved far enough to count as a drag. */
  hasDragged: boolean;
  /** Whether this gesture grabbed a card that was still settling. */
  interrupting: boolean;
  /** Set once a mid-swipe navigation commit has fired for this gesture. */
  committed: boolean;
  /** True while a pointer owns the card (drives `transition: none`). */
  dragging: boolean;
}

export type GestureEffect = 'next' | 'prev' | 'rateHard' | 'rateEasy' | 'flip';

export interface GestureContext {
  /** Current card index and deck length, for edge damping and commit gating. */
  index: number;
  count: number;
  /** Whether the answer face is showing (rating swipes need it). */
  flipped: boolean;
  /** Whether vertical drags may rate the card. Default false (§6b, option A). */
  allowVerticalRating?: boolean;
}

export type GestureEvent =
  | {
      type: 'down';
      pointerId: number;
      x: number;
      y: number;
      time: number;
      isPrimary: boolean;
      button: number;
      /** Live card offset read from the computed transform. */
      live: { x: number; y: number };
    }
  | { type: 'move'; pointerId: number; x: number; y: number; time: number }
  | { type: 'up'; pointerId: number; x: number; y: number; time: number }
  | { type: 'cancel'; pointerId: number }
  | { type: 'lostCapture'; pointerId: number };

export interface ReduceResult {
  state: GestureState;
  effect?: GestureEffect;
}

/** Distance (px) beyond which a swipe commits. Hypothesis pending device test. */
export const DISTANCE_THRESHOLD = 65;
/** Speed (px/ms) beyond which a short swipe still commits. Hypothesis pending device test. */
export const VELOCITY_THRESHOLD = 0.4;
/** Movement (px) before a press becomes a drag and locks an axis. */
export const DRAG_SLOP = 8;
/** Follow factor while dragging; the card trails the finger slightly. */
export const DRAG_FACTOR = 0.85;
/** Follow factor when dragging past the first/last card. */
export const EDGE_DAMPING = 0.25;
/** Below this the card counts as at rest (sub-pixel settle noise). */
const REST_EPSILON = 0.5;

export const IDLE: GestureState = {
  activePointerId: null,
  start: null,
  last: null,
  base: { x: 0, y: 0 },
  offset: { x: 0, y: 0 },
  axis: null,
  hasDragged: false,
  interrupting: false,
  committed: false,
  dragging: false,
};

export function createGestureState(): GestureState {
  return { ...IDLE, base: { x: 0, y: 0 }, offset: { x: 0, y: 0 } };
}

function velocity(state: GestureState): number {
  const { start, last } = state;
  if (!start || !last) return 0;
  const elapsed = last.time - start.time;
  if (elapsed <= 0) return 0;
  return Math.hypot(last.x - start.x, last.y - start.y) / elapsed;
}

export function reduce(state: GestureState, event: GestureEvent, ctx: GestureContext): ReduceResult {
  switch (event.type) {
    case 'down':
      return down(state, event, ctx);
    case 'move':
      return move(state, event, ctx);
    case 'up':
      return up(state, event, ctx);
    case 'cancel':
    case 'lostCapture':
      return cancel(state, event);
  }
}

function down(state: GestureState, e: Extract<GestureEvent, { type: 'down' }>, ctx: GestureContext): ReduceResult {
  // Ownership: a second contact while a gesture is live is ignored entirely.
  if (state.activePointerId !== null) return { state };
  // Only the primary pointer with the main button can start a gesture.
  if (!e.isPrimary || e.button !== 0) return { state };

  const interrupting = Math.abs(e.live.x) > REST_EPSILON || Math.abs(e.live.y) > REST_EPSILON;
  const sample = { x: e.x, y: e.y, time: e.time };

  if (!interrupting) {
    return {
      state: {
        ...createGestureState(),
        activePointerId: e.pointerId,
        start: sample,
        last: sample,
        dragging: true,
      },
    };
  }

  // Grabbing a settling card: continue from where it is, on the axis it was
  // already moving along, and treat the gesture as a drag from the start so
  // releasing without moving *catches* the card instead of flipping it.
  const liveAxis: Axis = Math.abs(e.live.x) >= Math.abs(e.live.y) ? 'horizontal' : 'vertical';
  const canRate = Boolean(ctx.allowVerticalRating) && ctx.flipped;
  const axis: Axis = liveAxis === 'vertical' && !canRate ? 'horizontal' : liveAxis;
  const base = axis === 'horizontal' ? { x: e.live.x, y: 0 } : { x: 0, y: e.live.y };

  return {
    state: {
      ...createGestureState(),
      activePointerId: e.pointerId,
      start: sample,
      last: sample,
      base,
      offset: base,
      axis,
      hasDragged: true,
      interrupting: true,
      dragging: true,
    },
  };
}

function move(state: GestureState, e: Extract<GestureEvent, { type: 'move' }>, ctx: GestureContext): ReduceResult {
  if (state.activePointerId !== e.pointerId || !state.start) return { state };
  if (state.committed) return { state };

  const last = { x: e.x, y: e.y, time: e.time };
  const dx = e.x - state.start.x;
  const dy = e.y - state.start.y;

  let axis = state.axis;
  let hasDragged = state.hasDragged;

  if (!hasDragged && Math.hypot(dx, dy) > DRAG_SLOP) {
    hasDragged = true;
    const canRate = Boolean(ctx.allowVerticalRating) && ctx.flipped;
    axis = canRate && Math.abs(dy) > Math.abs(dx) ? 'vertical' : 'horizontal';
  }

  if (axis === 'horizontal') {
    const atStart = ctx.index === 0 && dx > 0;
    const atEnd = ctx.index === ctx.count - 1 && dx < 0;
    const factor = atStart || atEnd ? EDGE_DAMPING : DRAG_FACTOR;
    const x = state.base.x + dx * factor;
    const canAdvance = !atStart && !atEnd;

    if (canAdvance && Math.abs(x) > DISTANCE_THRESHOLD) {
      // Lightweight, reversible: navigation commits mid-swipe. The card is
      // re-keyed by the parent, so the offset returns to rest immediately.
      return {
        state: { ...state, last, axis, hasDragged, committed: true, offset: { x: 0, y: 0 }, base: { x: 0, y: 0 } },
        effect: x < 0 ? 'next' : 'prev',
      };
    }
    return { state: { ...state, last, axis, hasDragged, offset: { x, y: 0 } } };
  }

  if (axis === 'vertical') {
    return { state: { ...state, last, axis, hasDragged, offset: { x: 0, y: state.base.y + dy * DRAG_FACTOR } } };
  }

  return { state: { ...state, last, hasDragged } };
}

function up(state: GestureState, e: Extract<GestureEvent, { type: 'up' }>, ctx: GestureContext): ReduceResult {
  if (state.activePointerId !== e.pointerId) return { state };

  const rest = createGestureState();
  if (state.committed) return { state: rest };

  // A press that never became a drag is a tap: flip. A tap that *caught* a
  // settling card is not a flip — the learner was stopping the card.
  if (!state.hasDragged) return { state: rest, effect: 'flip' };
  if (state.interrupting && !movedBeyondSlop(state)) return { state: rest };

  const flicked = velocity(state) > VELOCITY_THRESHOLD;
  const { x, y } = state.offset;

  if (state.axis === 'horizontal') {
    const atStart = ctx.index === 0;
    const atEnd = ctx.index === ctx.count - 1;
    if (x < 0 && !atEnd && (x < -DISTANCE_THRESHOLD || flicked)) return { state: rest, effect: 'next' };
    if (x > 0 && !atStart && (x > DISTANCE_THRESHOLD || flicked)) return { state: rest, effect: 'prev' };
    return { state: rest };
  }

  if (state.axis === 'vertical' && ctx.allowVerticalRating && ctx.flipped) {
    // Rating records state: it commits only here, on release.
    if (y < 0 && (y < -DISTANCE_THRESHOLD || flicked)) return { state: rest, effect: 'rateHard' };
    if (y > 0 && (y > DISTANCE_THRESHOLD || flicked)) return { state: rest, effect: 'rateEasy' };
  }

  return { state: rest };
}

function movedBeyondSlop(state: GestureState): boolean {
  if (!state.start || !state.last) return false;
  return Math.hypot(state.last.x - state.start.x, state.last.y - state.start.y) > DRAG_SLOP;
}

function cancel(state: GestureState, e: { pointerId: number }): ReduceResult {
  // Only the owner can cancel its gesture; a stray cancel from another
  // pointer must not reset a live drag.
  if (state.activePointerId !== e.pointerId) return { state };
  // Commit nothing. The browser took the pointer (scroll, pinch, system
  // gesture) or capture was lost; the card settles back to rest.
  return { state: createGestureState() };
}

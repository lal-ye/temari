import { describe, expect, it } from 'vitest';
import {
  createGestureState,
  DISTANCE_THRESHOLD,
  DRAG_SLOP,
  reduce,
  type GestureContext,
  type GestureEvent,
  type GestureState,
} from './flashcardGesture';

/**
 * The flashcard swipe, tested as a state machine
 * (docs/ui-plan-truthful-interaction.md §2 and §7).
 *
 * These are the behaviours a device test could only sample; here they are
 * exhaustive: pointer ownership, cancel-commits-nothing, interruption that
 * keeps its state, tap-during-settle catches rather than flips, and the
 * lightweight/destructive commit split from ADR-0005.
 */

const ctx = (over: Partial<GestureContext> = {}): GestureContext => ({
  index: 2,
  count: 5,
  flipped: false,
  allowVerticalRating: false,
  ...over,
});

const REST = { x: 0, y: 0 };

function down(
  pointerId: number,
  x = 100,
  y = 100,
  over: Partial<Extract<GestureEvent, { type: 'down' }>> = {}
): GestureEvent {
  return { type: 'down', pointerId, x, y, time: 0, isPrimary: true, button: 0, live: REST, ...over };
}
const move = (pointerId: number, x: number, y: number, time: number): GestureEvent => ({
  type: 'move',
  pointerId,
  x,
  y,
  time,
});
const up = (pointerId: number, x: number, y: number, time: number): GestureEvent => ({
  type: 'up',
  pointerId,
  x,
  y,
  time,
});

/** Runs a sequence and returns the final state plus every effect emitted, in order. */
function run(events: GestureEvent[], c: GestureContext = ctx(), from: GestureState = createGestureState()) {
  const effects: string[] = [];
  let state = from;
  for (const event of events) {
    const r = reduce(state, event, c);
    state = r.state;
    if (r.effect) effects.push(r.effect);
  }
  return { state, effects };
}

describe('pointer ownership', () => {
  it('the first primary pointer owns the gesture', () => {
    const { state } = run([down(1)]);
    expect(state.activePointerId).toBe(1);
    expect(state.dragging).toBe(true);
  });

  it('a second pointer cannot start, move, finish or reset a live gesture', () => {
    // Slow, deliberate horizontal drag by pointer 1 to 40px.
    const { state, effects } = run([
      down(1),
      move(1, 120, 100, 100),
      move(1, 140, 100, 200),
      down(2, 300, 300), // second finger lands
      move(2, 200, 300, 250), // and drags a long way
      up(2, 200, 300, 300), // and lifts
    ]);
    expect(state.activePointerId).toBe(1);
    expect(state.hasDragged).toBe(true);
    // Card offset is still pointer 1's: 40px * 0.85 follow factor.
    expect(state.offset.x).toBeCloseTo(34);
    expect(effects).toEqual([]);
  });

  it('a cancel from a non-owner does not reset the drag', () => {
    const { state } = run([down(1), move(1, 140, 100, 100), { type: 'cancel', pointerId: 2 }]);
    expect(state.activePointerId).toBe(1);
    expect(state.offset.x).toBeCloseTo(34);
  });

  it('ignores non-primary pointers and non-main buttons', () => {
    expect(run([down(1, 100, 100, { isPrimary: false })]).state.activePointerId).toBeNull();
    expect(run([down(1, 100, 100, { button: 2 })]).state.activePointerId).toBeNull();
  });

  it('after the owner releases, a new pointer may own the next gesture', () => {
    const { state } = run([down(1), up(1, 100, 100, 50), down(2)]);
    expect(state.activePointerId).toBe(2);
  });
});

describe('cancel and lost capture commit nothing', () => {
  it('pointercancel mid-swipe past the threshold settles to rest with no effect', () => {
    // Drive to 60px offset (below the 65px mid-swipe commit), then cancel.
    const { state, effects } = run([down(1), move(1, 170, 100, 100), { type: 'cancel', pointerId: 1 }]);
    expect(effects).toEqual([]);
    expect(state.activePointerId).toBeNull();
    expect(state.offset).toEqual(REST);
    expect(state.dragging).toBe(false);
  });

  it('lostpointercapture behaves the same', () => {
    const { state, effects } = run([down(1), move(1, 170, 100, 100), { type: 'lostCapture', pointerId: 1 }]);
    expect(effects).toEqual([]);
    expect(state.offset).toEqual(REST);
  });

  it('a fast flick that is cancelled does not commit by velocity either', () => {
    const { effects } = run([down(1), move(1, 150, 100, 20), { type: 'cancel', pointerId: 1 }]);
    expect(effects).toEqual([]);
  });
});

describe('tap and drag detection', () => {
  it('a press with no movement is a tap: flip', () => {
    const { effects } = run([down(1), up(1, 100, 100, 80)]);
    expect(effects).toEqual(['flip']);
  });

  it('movement inside the slop is still a tap', () => {
    const { effects } = run([down(1), move(1, 100 + DRAG_SLOP - 1, 100, 50), up(1, 100 + DRAG_SLOP - 1, 100, 80)]);
    expect(effects).toEqual(['flip']);
  });

  it('movement beyond the slop locks the horizontal axis', () => {
    const { state } = run([down(1), move(1, 120, 100, 50)]);
    expect(state.hasDragged).toBe(true);
    expect(state.axis).toBe('horizontal');
  });

  it('a diagonal drag is horizontal when vertical rating is off', () => {
    const { state } = run([down(1), move(1, 110, 140, 50)], ctx({ flipped: true }));
    expect(state.axis).toBe('horizontal');
  });
});

describe('navigation commits (lightweight, ADR-0005 §3)', () => {
  it('commits "next" mid-swipe once the card passes the distance threshold', () => {
    // 0.85 follow factor: need dx > 65/0.85 ≈ 76.5px.
    const { state, effects } = run([down(1), move(1, 100 - 80, 100, 100)]);
    expect(effects).toEqual(['next']);
    expect(state.committed).toBe(true);
    expect(state.offset).toEqual(REST);
  });

  it('commits "prev" for a rightward swipe', () => {
    const { effects } = run([down(1), move(1, 180, 100, 100)]);
    expect(effects).toEqual(['prev']);
  });

  it('does not commit twice within one gesture', () => {
    const { effects } = run([down(1), move(1, 20, 100, 100), move(1, 0, 100, 150), up(1, 0, 100, 200)]);
    expect(effects).toEqual(['next']);
  });

  it('commits by velocity on release for a short fast flick', () => {
    // 40px in 50ms = 0.8 px/ms, above VELOCITY_THRESHOLD; offset 34px is below distance.
    const { effects } = run([down(1), move(1, 60, 100, 50), up(1, 60, 100, 50)]);
    expect(effects).toEqual(['next']);
  });

  it('a slow short drag released below the threshold commits nothing and settles', () => {
    const { state, effects } = run([down(1), move(1, 70, 100, 500), up(1, 70, 100, 600)]);
    expect(effects).toEqual([]);
    expect(state.offset).toEqual(REST);
  });

  it('is damped and never commits past the first or last card', () => {
    const first = run([down(1), move(1, 300, 100, 100), up(1, 300, 100, 120)], ctx({ index: 0 }));
    expect(first.effects).toEqual([]);
    const last = run([down(1), move(1, -100, 100, 100), up(1, -100, 100, 120)], ctx({ index: 4 }));
    expect(last.effects).toEqual([]);
    // Edge damping: 200px * 0.25 = 50px.
    const damped = run([down(1), move(1, 300, 100, 100)], ctx({ index: 0 }));
    expect(damped.state.offset.x).toBeCloseTo(50);
  });

  it('a mid-swipe commit is not re-armed by the release', () => {
    const { effects } = run([down(1), move(1, 20, 100, 100), up(1, 20, 100, 120)]);
    expect(effects).toEqual(['next']);
  });
});

describe('interrupting a settling card', () => {
  const settling = { x: 30, y: 0 };

  it('adopts the live offset and axis and counts as a drag from the start', () => {
    const { state } = run([down(1, 100, 100, { live: settling })]);
    expect(state.interrupting).toBe(true);
    expect(state.hasDragged).toBe(true);
    expect(state.axis).toBe('horizontal');
    expect(state.offset).toEqual(settling);
    expect(state.base).toEqual(settling);
    expect(state.dragging).toBe(true);
  });

  it('a tap that catches the card does not flip it', () => {
    const { state, effects } = run([down(1, 100, 100, { live: settling }), up(1, 101, 100, 60)]);
    expect(effects).toEqual([]);
    expect(state.offset).toEqual(REST);
  });

  it('continues from the live position without a snap', () => {
    const { state } = run([down(1, 100, 100, { live: settling }), move(1, 110, 100, 50)]);
    // base 30 + 10px * 0.85
    expect(state.offset.x).toBeCloseTo(38.5);
  });

  it('can carry the interrupted card over the threshold', () => {
    const { effects } = run([down(1, 100, 100, { live: { x: -50, y: 0 } }), move(1, 80, 100, 50)]);
    // -50 + (-20 * 0.85) = -67 → past 65 → next
    expect(effects).toEqual(['next']);
  });

  it('a vertical live offset falls back to horizontal when rating swipe is off', () => {
    const { state } = run([down(1, 100, 100, { live: { x: 0, y: 20 } })]);
    expect(state.axis).toBe('horizontal');
    expect(state.offset).toEqual(REST);
  });
});

describe('vertical rating swipe (opt-in, commits on release only)', () => {
  const rating = ctx({ flipped: true, allowVerticalRating: true });

  it('locks the vertical axis on the answer face', () => {
    const { state } = run([down(1), move(1, 100, 130, 50)], rating);
    expect(state.axis).toBe('vertical');
    expect(state.offset.y).toBeCloseTo(30 * 0.85);
  });

  it('never rates mid-swipe, even far past the threshold', () => {
    const { effects } = run([down(1), move(1, 100, 300, 500)], rating);
    expect(effects).toEqual([]);
  });

  it('rates hard on an upward release past the threshold, easy downward', () => {
    expect(run([down(1), move(1, 100, 0, 500), up(1, 100, 0, 600)], rating).effects).toEqual(['rateHard']);
    expect(run([down(1), move(1, 100, 200, 500), up(1, 100, 200, 600)], rating).effects).toEqual(['rateEasy']);
  });

  it('does not rate on the question face', () => {
    const { state, effects } = run(
      [down(1), move(1, 100, 200, 500), up(1, 100, 200, 600)],
      ctx({ flipped: false, allowVerticalRating: true })
    );
    expect(state.axis === 'vertical').toBe(false);
    expect(effects).toEqual([]);
  });

  it('a vertical live offset is kept when interrupting on the answer face', () => {
    const { state } = run([down(1, 100, 100, { live: { x: 0, y: 20 } })], rating);
    expect(state.axis).toBe('vertical');
    expect(state.offset.y).toBe(20);
  });
});

describe('release always clears ownership', () => {
  it('returns to the idle shape after any release', () => {
    const { state } = run([down(1), move(1, 130, 100, 50), up(1, 130, 100, 600)]);
    expect(state).toEqual(createGestureState());
  });

  it(`DISTANCE_THRESHOLD is the documented hypothesis value`, () => {
    expect(DISTANCE_THRESHOLD).toBe(65);
  });
});

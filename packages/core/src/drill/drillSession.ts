/**
 * The Drill machine (M3 plan §5.1): the pure flip / rate / next / prev state
 * machine behind one practice session over a Quiz. Parity target is the web
 * FlashcardView at 35d3329^ (deleted); the parity rules are copied into
 * drill.test.ts so they outlive the exhumed file.
 *
 * An empty deck returns null (plan D4): the Drill is blocked before it
 * starts, and no Attempt is ever recorded — the web's broken 0 % flow is a
 * deliberate, recorded deviation.
 */

/** What the machine needs from a Flashcard: only its identity. */
export interface DrillCard {
  id: string;
}

export type DrillRating = 'mastered' | 'need-practice';

export type DrillStatus = 'active' | 'done';

/** The recorded outcome of a finished Drill. Never recomputed after finish. */
export interface DrillResult {
  /** 0–100, the web rule: Math.round((mastered / Math.max(1, total)) * 100). */
  score: number;
  masteredCount: number;
  total: number;
}

/**
 * The machine's public state (plan §5.1, flat shape as specced there).
 * Invariant the machine maintains: `result` is null until the Drill is
 * done, and once done it never changes.
 */
export interface DrillSessionState {
  index: number;
  flipped: boolean;
  mastered: ReadonlySet<string>;
  review: ReadonlySet<string>;
  status: DrillStatus;
  result: DrillResult | null;
}

export interface DrillSession {
  /** A fresh snapshot per call; callers may hold it without aliasing. */
  state(): DrillSessionState;
  /** Toggle the current card, web-style (`setIsFlipped((f) => !f)`). */
  flip(): void;
  /** Rate the current card and advance past it. */
  rate(rating: DrillRating): void;
  /** Advance without rating; on the last card this finishes the Drill
   * (web: `handleNext` → `advance()` with the current mastered set). */
  next(): void;
  /** Unflip and step back; clamped at the first card, sets untouched. */
  prev(): void;
}

export function createDrillSession(cards: readonly DrillCard[]): DrillSession | null {
  if (cards.length === 0) return null;

  let index = 0;
  let flipped = false;
  let mastered = new Set<string>();
  let review = new Set<string>();
  let done = false;
  let result: DrillResult | null = null;

  const finish = (finalMastered: ReadonlySet<string>) => {
    result = {
      score: Math.round((finalMastered.size / Math.max(1, cards.length)) * 100),
      masteredCount: finalMastered.size,
      total: cards.length,
    };
    done = true;
    flipped = false;
  };

  const advance = (masteredSet: ReadonlySet<string>) => {
    flipped = false;
    if (index < cards.length - 1) {
      index += 1;
    } else {
      finish(masteredSet);
    }
  };

  return {
    state() {
      const status: DrillStatus = done ? 'done' : 'active';
      return { index, flipped, mastered, review, status, result };
    },
    flip() {
      if (done) return;
      flipped = !flipped;
    },
    rate(rating) {
      if (done) return;
      const id = cards[index].id;
      const nextMastered = new Set(mastered);
      const nextReview = new Set(review);
      if (rating === 'mastered') {
        nextMastered.add(id);
        nextReview.delete(id);
      } else {
        nextReview.add(id);
        nextMastered.delete(id);
      }
      mastered = nextMastered;
      review = nextReview;
      advance(nextMastered);
    },
    next() {
      if (done) return;
      advance(mastered);
    },
    prev() {
      if (done) return;
      flipped = false;
      if (index > 0) index -= 1;
    },
  };
}

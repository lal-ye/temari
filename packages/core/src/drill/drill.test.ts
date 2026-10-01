import { describe, expect, it } from 'vitest';
import { buildDrillAttempt, createDrillCompletion } from './drillCompletion';
import { createDrillSession } from './drillSession';

describe('createDrillSession', () => {
  it('returns null for an empty deck (D4: block start, no Attempt)', () => {
    expect(createDrillSession([])).toBeNull();
  });

  it('starts unflipped on the first card with empty rating sets', () => {
    const session = createDrillSession([{ id: 'card-1' }, { id: 'card-2' }]);
    expect(session?.state()).toEqual({
      status: 'active',
      index: 0,
      flipped: false,
      mastered: new Set(),
      review: new Set(),
      result: null,
    });
  });

  it('flip toggles, and advancing or stepping back unflips', () => {
    const session = createDrillSession([{ id: 'card-1' }, { id: 'card-2' }]);
    session?.flip();
    expect(session?.state().flipped).toBe(true);
    session?.flip();
    expect(session?.state().flipped).toBe(false);
    session?.flip();
    session?.next();
    expect(session?.state().flipped).toBe(false);
    session?.flip();
    session?.prev();
    expect(session?.state().flipped).toBe(false);
  });

  it('next and prev move the index, prev clamps at the first card, and neither touches the rating sets', () => {
    const session = createDrillSession([{ id: 'a' }, { id: 'b' }, { id: 'c' }]);
    session?.next();
    expect(session?.state().index).toBe(1);
    session?.next();
    expect(session?.state().index).toBe(2);
    session?.prev();
    expect(session?.state().index).toBe(1);
    session?.prev();
    session?.prev();
    expect(session?.state().index).toBe(0);
    expect(session?.state().mastered.size).toBe(0);
    expect(session?.state().review.size).toBe(0);
  });

  it('rating mastered claims the card for mastered, drops it from review, and advances', () => {
    const session = createDrillSession([{ id: 'a' }, { id: 'b' }]);
    session?.flip();
    session?.rate('mastered');
    const state = session?.state();
    expect(state?.index).toBe(1);
    expect(state?.flipped).toBe(false);
    expect(state?.mastered).toEqual(new Set(['a']));
    expect(state?.review).toEqual(new Set());
  });

  it('rating need-practice moves the card between sets in both directions', () => {
    const session = createDrillSession([{ id: 'a' }, { id: 'b' }]);
    session?.rate('mastered');
    session?.prev();
    expect(session?.state().mastered).toEqual(new Set(['a']));
    session?.rate('need-practice');
    expect(session?.state().mastered).toEqual(new Set());
    expect(session?.state().review).toEqual(new Set(['a']));
    session?.prev();
    session?.rate('mastered');
    expect(session?.state().mastered).toEqual(new Set(['a']));
    expect(session?.state().review).toEqual(new Set());
  });

  it('an all-mastered run that rates the LAST card records 100% (the web stale-closure regression)', () => {
    const cards = [1, 2, 3, 4, 5].map((n) => ({ id: `card-${n}` }));
    const session = createDrillSession(cards);
    for (let i = 0; i < cards.length - 1; i++) session?.rate('mastered');
    expect(session?.state().status).toBe('active');
    session?.rate('mastered'); // the last rating and the finish are one event
    const state = session?.state();
    expect(state?.status).toBe('done');
    expect(state?.result).toEqual({ score: 100, masteredCount: 5, total: 5 });
  });

  it('rating the last card need-practice records a score that excludes it', () => {
    const cards = [1, 2, 3, 4, 5].map((n) => ({ id: `card-${n}` }));
    const session = createDrillSession(cards);
    for (let i = 0; i < cards.length - 1; i++) session?.rate('mastered');
    session?.rate('need-practice');
    const state = session?.state();
    expect(state?.status).toBe('done');
    expect(state?.result).toEqual({ score: 80, masteredCount: 4, total: 5 });
  });

  it('next on the last card finishes the Drill with the current mastered set (web handleNext parity)', () => {
    const session = createDrillSession([{ id: 'a' }, { id: 'b' }]);
    session?.rate('mastered'); // card a, advance to card b
    session?.next(); // next on the last card = finish, sets untouched by the press
    const state = session?.state();
    expect(state?.status).toBe('done');
    expect(state?.result).toEqual({ score: 50, masteredCount: 1, total: 2 });
  });

  it('absorbs every event after done and never recomputes the recorded result', () => {
    const session = createDrillSession([{ id: 'a' }, { id: 'b' }]);
    session?.rate('mastered');
    session?.rate('need-practice'); // finishes the Drill at 50%
    const before = session?.state();
    session?.flip();
    session?.rate('mastered');
    session?.next();
    session?.prev();
    expect(session?.state()).toEqual(before);
  });
});

describe('createDrillCompletion', () => {
  it('a rapid double finish makes exactly one save call (the duplicate-Attempt gate)', async () => {
    const payloads: string[] = [];
    const resolvers: Array<() => void> = [];
    const save = (payload: string) =>
      new Promise<void>((resolve) => {
        payloads.push(payload);
        resolvers.push(resolve);
      });
    const completion = createDrillCompletion<string>({ save });

    const first = completion.finish('attempt-1');
    const second = completion.finish('attempt-1'); // absorbed, not a second save
    resolvers[0]?.();
    await Promise.all([first, second]);

    expect(payloads).toEqual(['attempt-1']);
    expect(completion.status()).toBe('done');
  });

  it('a rejected save stays retryable: no partial state, one more save, then done', async () => {
    let calls = 0;
    const save = () => {
      calls += 1;
      if (calls === 1) return Promise.reject(new Error('disk full'));
      return Promise.resolve();
    };
    const completion = createDrillCompletion({ save });

    await expect(completion.finish('attempt-1')).rejects.toThrow('disk full');
    expect(completion.status()).toBe('error'); // not done: nothing was written

    await completion.finish('attempt-1'); // the retry
    expect(calls).toBe(2);
    expect(completion.status()).toBe('done');
  });

  it('finish after done is absorbed without a new save call', async () => {
    const payloads: string[] = [];
    const completion = createDrillCompletion<string>({
      save: (payload) => {
        payloads.push(payload);
        return Promise.resolve();
      },
    });
    await completion.finish('attempt-1');
    await completion.finish('attempt-2'); // late tap after the save settled
    expect(payloads).toEqual(['attempt-1']);
    expect(completion.status()).toBe('done');
  });
});

describe('buildDrillAttempt', () => {
  const recorded = { score: 80, masteredCount: 4, total: 5 };

  it('builds the web-parity Attempt payload (§5.3) from the recorded result', () => {
    const attempt = buildDrillAttempt(
      { subjectId: 'subject-1', subjectName: 'Cellular Biology', quizName: 'Recall', result: recorded },
      () => 'att-1',
    );
    expect(attempt).toEqual(
      expect.objectContaining({
        id: 'att-1',
        subjectId: 'subject-1',
        subjectName: 'Cellular Biology',
        name: 'Recall',
        type: 'Quiz',
        overallScore: 80,
        totalQuestions: 5,
        correctQuestions: 4,
        topicsToReview: [],
      }),
    );
    // Web parity: unset means absent — no timeSpentSeconds, no gradedOffline.
    expect(attempt.timeSpentSeconds).toBeUndefined();
    expect(attempt.gradedOffline).toBeUndefined();
    // date is the web's full ISO timestamp (portable also accepts plain dates).
    expect(attempt.date).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it('takes the id from the injected factory, so two finishes get distinct ids', () => {
    let counter = 0;
    const nextId = () => {
      counter += 1;
      return `att-${counter}`;
    };
    const base = { subjectId: 's', subjectName: 'S', quizName: 'Q', result: recorded };
    expect(buildDrillAttempt(base, nextId).id).toBe('att-1');
    expect(buildDrillAttempt(base, nextId).id).toBe('att-2');
  });
});

/**
 * The Drill finish boundary (M3 plan §5.2): a single-flight guard around the
 * one write that ends a Drill — the learner's completed work. Deliberately
 * different from reader-core's Explain session guard (plan D9): there is no
 * invalidation, because dropping a completed Drill on unmount would throw
 * away the Attempt. The first accepted save always runs to completion.
 *
 * Absorb rules: further finish taps while a save is pending are absorbed
 * (they share the in-flight promise); after the save settles the machine is
 * structurally done, so later taps resolve immediately; a rejected save
 * leaves a retryable error state — never `done`, so nothing can masquerade
 * as saved. Retrying calls `finish` again with the same Attempt; it cannot
 * duplicate because the repository never partially writes (plan D8).
 *
 * buildDrillAttempt (below) is the §5.3 parity table as code: the exact
 * payload the web's handleFinishDrill recorded, with two deliberate
 * deviations recorded in the plan — the id comes from an injected
 * collision-resistant factory (D6; the web's `att-${Date.now()}` collides
 * under rapid taps) and there is no confetti (M5 polish).
 */

import type { StoredAttempt } from '../types';
import type { DrillResult } from './drillSession';

/** New-record id source: randomUUID at the app seam, counters in tests (D6). */
export type NewRecordId = () => string;

export interface DrillAttemptInput {
  subjectId: string;
  subjectName: string;
  /** The Quiz's name — the Attempt's name, web parity. */
  quizName: string;
  /** The machine's RECORDED result, captured at finish; never recomputed. */
  result: DrillResult;
}

export function buildDrillAttempt(input: DrillAttemptInput, newRecordId: NewRecordId): StoredAttempt {
  return {
    id: newRecordId(),
    subjectId: input.subjectId,
    subjectName: input.subjectName,
    name: input.quizName,
    type: 'Quiz',
    date: new Date().toISOString(),
    overallScore: input.result.score,
    totalQuestions: input.result.total,
    correctQuestions: input.result.masteredCount,
    topicsToReview: [],
  };
}

export type DrillSaveStatus = 'idle' | 'saving' | 'done' | 'error';

export interface DrillCompletion<TPayload> {
  /** Submit the Drill's work. Resolves when saved; rejects (retryably) when
   * the save fails. Absorbed callers share the outcome of the active save. */
  finish(payload: TPayload): Promise<void>;
  /** Coarse state for the screen: idle → saving → done, or saving → error. */
  status(): DrillSaveStatus;
}

export interface DrillCompletionConfig<TPayload> {
  /** The one operation — repository.recordDrillFinish in the app, a stub in
   * tests. Exactly one call per accepted save; tests assert call counts. */
  save: (payload: TPayload) => Promise<void>;
}

interface SavingState {
  status: 'saving';
  pending: Promise<void>;
}

type CompletionState =
  | { status: 'idle' }
  | SavingState
  | { status: 'done' }
  | { status: 'error' };

export function createDrillCompletion<TPayload>(
  config: DrillCompletionConfig<TPayload>,
): DrillCompletion<TPayload> {
  let state: CompletionState = { status: 'idle' };

  const finish = (payload: TPayload): Promise<void> => {
    if (state.status === 'done') return Promise.resolve();
    if (state.status === 'saving') return state.pending;
    // The save call happens synchronously, so an immediately-resolving stub
    // settles in the same microtask chain its caller awaits; a synchronous
    // throw is a failed save (the repository never partially writes), not a
    // wedged guard — the state claim happens only once `pending` exists, and
    // nothing can re-enter finish() synchronously in between.
    let pending: Promise<void>;
    try {
      pending = config.save(payload).then(
        () => {
          state = { status: 'done' };
        },
        (error: unknown) => {
          state = { status: 'error' };
          throw error;
        },
      );
    } catch (error) {
      state = { status: 'error' };
      return Promise.reject(error);
    }
    state = { status: 'saving', pending };
    return pending;
  };

  return {
    finish,
    status: () => state.status,
  };
}

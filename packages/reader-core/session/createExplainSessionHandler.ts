import {
  validateExplainRequest,
  type ExplainRejection,
  type ExplainRequest,
} from '../bridge';
import { createSingleFlightGuard } from './singleFlight';

/**
 * View state for the mock Explain session (checkpoint B plan §8.3). The
 * screen/host renders `idle/pending/done/error`; it is NOT the concurrency
 * guard — the guard and the control flow live here.
 */
export type ExplainSessionState =
  | { kind: 'idle' }
  | { kind: 'pending'; request: ExplainRequest }
  | { kind: 'done'; request: ExplainRequest; result: string }
  | { kind: 'error'; reason: ExplainRejection | 'mock-failed' };

export interface ExplainSessionHandler {
  /** The DOM action prop funnels here. Resolves when the submission settles
   * (or immediately when absorbed/invalid/stale). */
  submit(raw: unknown): Promise<void>;
  /** Close · note change · route blur · unmount. Clears the in-flight guard
   * (so a later submission always works) and drops any late completion. */
  invalidate(): void;
}

export interface ExplainSessionDeps {
  /** The note being read; validated against every payload. */
  expectedNoteId: string;
  /** Mount liveness of the host screen. */
  isAlive(): boolean;
  /** Route focus of the host screen (blur ⇒ stale). */
  isFocused(): boolean;
  /** View updates; must be side-effect free for a dead host. */
  dispatch(event: ExplainSessionState): void;
  /** The one operation (mock at checkpoint B). Exactly one call per accepted
   * submission — tests assert call counts on this. */
  run(request: ExplainRequest): Promise<string>;
}

/**
 * The single-active Explain session (plan §8.3), extracted from
 * `reader-spike.tsx` per the Phase-4 review so the §9 call-count rows run as
 * plain web-vitest tests — the Expo screen is wiring only, and the browser
 * fixture's mock host reuses this same factory (identical semantics on both
 * hosts, no RN harness needed at checkpoint B).
 *
 * Semantics: check-and-set BEFORE `run`; submissions while anything is
 * pending are absorbed (even with a different id — no supersede, no
 * request-id history at B); invalid payloads start no work; invalidation
 * bumps an epoch so a late completion is dropped; the guard clears in
 * `finally` and on `invalidate()`, so it can never stick.
 */
export function createExplainSessionHandler(deps: ExplainSessionDeps): ExplainSessionHandler {
  const guard = createSingleFlightGuard();
  let epoch = 0;
  const fresh = (submitEpoch: number) =>
    epoch === submitEpoch && deps.isAlive() && deps.isFocused();

  return {
    async submit(raw: unknown): Promise<void> {
      const submitEpoch = epoch;
      if (guard.isActive()) return; // absorbed while anything is pending
      // NOTE: the literal comparison (`checked.ok === false`) — the root
      // tsconfig does not enable strictNullChecks, under which `if (!checked.ok)`
      // and `else` arms do not narrow this discriminated union.
      const checked = validateExplainRequest(deps.expectedNoteId, raw);
      if (checked.ok === false) {
        // Validation failures surface, but no work starts.
        if (fresh(submitEpoch)) deps.dispatch({ kind: 'error', reason: checked.reason });
        return;
      }
      if (!fresh(submitEpoch)) return; // stale before start: nothing rendered
      const request = checked.request; // fresh object, permitted fields only
      guard.checkAndSet(request.requestId);
      deps.dispatch({ kind: 'pending', request });
      try {
        const result = await deps.run(request); // exactly one op
        if (fresh(submitEpoch)) deps.dispatch({ kind: 'done', request, result });
      } catch {
        if (fresh(submitEpoch)) deps.dispatch({ kind: 'error', reason: 'mock-failed' });
      } finally {
        guard.clear(request.requestId);
      }
    },

    invalidate(): void {
      epoch += 1; // in-flight completions become stale and are dropped
      guard.clearAll(); // the guard never sticks — a later submit always works
      deps.dispatch({ kind: 'idle' });
    },
  };
}

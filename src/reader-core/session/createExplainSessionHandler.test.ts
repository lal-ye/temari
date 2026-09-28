import { describe, expect, it, vi } from 'vitest';
import { createExplainSessionHandler, type ExplainSessionState } from './createExplainSessionHandler';
import { newRequestId, type ExplainRequest } from '../bridge';

/**
 * The §9 concurrency rows (plan v3), as plain vitest against the pure
 * factory — call counts on a mock `run`, no RN harness (Phase-4 review).
 * The Expo screen is wiring only; these tests are the proof.
 */

const NOTE_ID = 'm2-reader-kitchen-sink-v1';

function makeRequest(overrides: Partial<ExplainRequest> = {}): ExplainRequest {
  return {
    noteId: NOTE_ID,
    term: 'Energy',
    context: 'Energy is conserved in a closed system.',
    requestId: newRequestId(),
    ...overrides,
  };
}

/** A `run` the test resolves explicitly; every call gets its own deferred,
 * resolved oldest-first (submissions run one at a time, but an invalidated
 * one may still be in flight when the next starts). */
function deferredRun() {
  const waiters: Array<{ resolve: (result: string) => void; reject: (error: unknown) => void }> = [];
  const run = vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        waiters.push({ resolve, reject });
      }),
  );
  const next = () => {
    if (waiters.length === 0) throw new Error('nothing pending');
    return waiters.shift()!;
  };
  return {
    run,
    resolve: (result: string) => next().resolve(result),
    reject: (error: unknown) => next().reject(error),
  };
}

function setup(overrides: Partial<Parameters<typeof createExplainSessionHandler>[0]> = {}) {
  const events: ExplainSessionState[] = [];
  const isAlive = vi.fn(() => true);
  const isFocused = vi.fn(() => true);
  const session = createExplainSessionHandler({
    expectedNoteId: NOTE_ID,
    isAlive,
    isFocused,
    dispatch: (event) => events.push(event),
    run: async () => 'MOCK',
    ...overrides,
  });
  return { session, events, isAlive, isFocused };
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createExplainSessionHandler (single-active, plan §8.3)', () => {
  it('runs a valid submission exactly once and dispatches pending then done', async () => {
    const { run, resolve } = deferredRun();
    const { session, events } = setup({ run });
    const request = makeRequest();

    const pending = session.submit(request);
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    expect(events.map((e) => e.kind)).toEqual(['pending']);

    resolve('MOCK · checkpoint B');
    await pending;
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({ kind: 'done', request, result: 'MOCK · checkpoint B' });
  });

  it('absorbs rapid submissions: run is invoked once, second call is a no-op', async () => {
    const { run, resolve } = deferredRun();
    const { session, events } = setup({ run });

    const first = session.submit(makeRequest());
    const second = session.submit(makeRequest()); // different id, still absorbed
    await flush();
    expect(run).toHaveBeenCalledTimes(1);
    resolve('MOCK');
    await Promise.all([first, second]);
    expect(events.filter((e) => e.kind === 'done')).toHaveLength(1);
  });

  it('starts no work on an invalid payload and surfaces the rejection reason', async () => {
    const run = vi.fn(async () => 'MOCK');
    const { session, events } = setup({ run });

    await session.submit({ noteId: 'another-note', term: 'x', context: '', requestId: 'r-1' });
    expect(run).not.toHaveBeenCalled();
    expect(events).toEqual([{ kind: 'error', reason: 'note-id' }]);
  });

  it('invalidate() while pending drops the late completion (no panel reopening)', async () => {
    const { run, resolve } = deferredRun();
    const { session, events } = setup({ run });

    const pending = session.submit(makeRequest());
    await flush();
    session.invalidate(); // Close while pending
    expect(events.at(-1)).toEqual({ kind: 'idle' });

    resolve('MOCK'); // the late completion arrives
    await pending;
    expect(events.filter((e) => e.kind === 'done')).toHaveLength(0);
  });

  it('submit → Close while pending → submit again SUCCEEDS (guard never sticks)', async () => {
    const { run, resolve } = deferredRun();
    const { session, events } = setup({ run });

    const first = session.submit(makeRequest());
    await flush();
    session.invalidate();
    resolve('MOCK');
    await first;

    const second = session.submit(makeRequest());
    await flush();
    expect(run).toHaveBeenCalledTimes(2); // the second submission really ran
    resolve('MOCK 2');
    await second;
    expect(events.at(-1)).toMatchObject({ kind: 'done', result: 'MOCK 2' });
  });

  it('recovers after run rejects: error dispatched, guard cleared, next submit works', async () => {
    const { run, reject, resolve } = deferredRun();
    const { session, events } = setup({ run });

    const first = session.submit(makeRequest());
    await flush();
    reject(new Error('boom'));
    await first.catch(() => {});
    expect(events.at(-1)).toEqual({ kind: 'error', reason: 'mock-failed' });

    const second = session.submit(makeRequest());
    await flush();
    expect(run).toHaveBeenCalledTimes(2);
    resolve('MOCK 2');
    await second;
    expect(events.at(-1)).toMatchObject({ kind: 'done' });
  });

  it('drops the completion when the host unmounts before it settles', async () => {
    const { run, resolve } = deferredRun();
    const { session, events, isAlive } = setup({ run });

    const pending = session.submit(makeRequest());
    await flush();
    isAlive.mockReturnValue(false);
    resolve('MOCK');
    await pending;
    expect(events.filter((e) => e.kind === 'done')).toHaveLength(0);
  });

  it('drops the completion when the route blurred before it settles', async () => {
    const { run, resolve } = deferredRun();
    const { session, events, isFocused } = setup({ run });

    const pending = session.submit(makeRequest());
    await flush();
    isFocused.mockReturnValue(false);
    resolve('MOCK');
    await pending;
    expect(events.filter((e) => e.kind === 'done')).toHaveLength(0);
  });

  it('renders nothing for a submission that arrives stale', async () => {
    const run = vi.fn(async () => 'MOCK');
    const { session, events, isFocused } = setup({ run });
    isFocused.mockReturnValue(false);
    await session.submit(makeRequest());
    expect(run).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('a submission after invalidation starts a fresh epoch (old run cannot land)', async () => {
    const { run, resolve } = deferredRun();
    const { session, events } = setup({ run });

    const first = session.submit(makeRequest({ requestId: 'r-old' }));
    await flush();
    session.invalidate();
    const second = session.submit(makeRequest({ requestId: 'r-new' }));
    await flush();
    expect(run).toHaveBeenCalledTimes(2);

    resolve('old result'); // the invalidated run completes late…
    resolve('new result'); // …then the current one
    await Promise.all([first, second]);
    expect(events.filter((e) => e.kind === 'done')).toHaveLength(1);
    expect(events.filter((e) => e.kind === 'done')[0]).toMatchObject({
      request: { requestId: 'r-new' },
      result: 'new result',
    });
  });
});

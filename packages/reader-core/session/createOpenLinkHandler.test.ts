import { describe, expect, it, vi } from 'vitest';
import { createOpenLinkHandler, type OpenLinkEvent } from './createOpenLinkHandler';

/**
 * The link-handoff §9 rows (plan v3 §8.5): double-tap guard, isApprovedLink
 * re-check, cancel, failed handoff, guard recovery — plain vitest against the
 * pure factory with mock `confirm`/`open`; the Expo screen injects
 * `Alert.alert` and `Linking.openURL` (never `canOpenURL`).
 */

function setup(overrides: Partial<{ confirm: () => Promise<boolean>; open: () => Promise<void> }> = {}) {
  const events: OpenLinkEvent[] = [];
  // Every confirm call gets its own deferred, resolved oldest-first.
  const confirmWaiters: Array<(ok: boolean) => void> = [];
  const confirm = vi.fn(
    () =>
      new Promise<boolean>((resolve) => {
        confirmWaiters.push(resolve);
      }),
  );
  const open = vi.fn(async () => {});
  const handler = createOpenLinkHandler({
    confirm: overrides.confirm ?? confirm,
    open: overrides.open ?? open,
    dispatch: (event) => events.push(event),
  });
  return {
    handler,
    events,
    confirm,
    open,
    resolveConfirm: (ok: boolean) => {
      if (confirmWaiters.length === 0) throw new Error('no confirm pending');
      confirmWaiters.shift()!(ok);
    },
  };
}

const APPROVED = { url: 'https://example.org/article', requestId: 'link-1' };

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('createOpenLinkHandler (native link confirm, plan §8.5)', () => {
  it('confirms once, hands the URL to open, and reports opened', async () => {
    const { handler, events, confirm, open, resolveConfirm } = setup();
    const pending = handler.submit(APPROVED);
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(open).not.toHaveBeenCalled();
    resolveConfirm(true);
    await pending;
    expect(open).toHaveBeenCalledWith('https://example.org/article');
    expect(events).toEqual([{ kind: 'opened', url: 'https://example.org/article' }]);
  });

  it('absorbs a double-tap: the second submission triggers no second confirm', async () => {
    const { handler, confirm, open, resolveConfirm } = setup();
    const first = handler.submit(APPROVED);
    const second = handler.submit({ ...APPROVED, requestId: 'link-2' }); // rapid second tap
    await flush();
    expect(confirm).toHaveBeenCalledTimes(1); // never two stacked Alerts
    resolveConfirm(false); // cancel resolves both
    await Promise.all([first, second]);
    expect(open).not.toHaveBeenCalled();
  });

  it('re-runs isApprovedLink: non-approved URLs are rejected before any confirm', async () => {
    for (const url of ['http://example.org/x', '//example.org/x', 'javascript:alert(1)', '/app', '#sec-1', '']) {
      const { handler, events, confirm, open } = setup();
      await handler.submit({ url, requestId: 'link-1' });
      expect(confirm).not.toHaveBeenCalled();
      expect(open).not.toHaveBeenCalled();
      expect(events).toEqual([{ kind: 'rejected', reason: 'invalid-url' }]);
    }
  });

  it('rejects malformed payloads without any work', async () => {
    const { handler, events, confirm, open } = setup();
    await handler.submit({ url: 'https://example.org', requestId: 'link-1', extra: 'nope' });
    await handler.submit('nonsense');
    await handler.submit({ url: 'https://example.org' });
    expect(confirm).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
    expect(events).toEqual([
      { kind: 'rejected', reason: 'shape' },
      { kind: 'rejected', reason: 'shape' },
      { kind: 'rejected', reason: 'shape' },
    ]);
  });

  it('cancel dispatches nothing — the app stays where it was', async () => {
    const { handler, events, open, resolveConfirm } = setup();
    const pending = handler.submit(APPROVED);
    await flush();
    resolveConfirm(false);
    await pending;
    expect(open).not.toHaveBeenCalled();
    expect(events).toEqual([]);
  });

  it('reports a failed handoff and recovers (the guard cleared)', async () => {
    let openCalls = 0;
    const open = vi.fn(async () => {
      openCalls += 1;
      if (openCalls === 1) throw new Error('no handler');
    });
    const confirm = vi.fn(async () => true);
    const { handler, events } = setup({ confirm, open });

    await handler.submit(APPROVED);
    expect(events).toEqual([{ kind: 'failed' }]);

    // The next submission works — the guard never sticks.
    await handler.submit({ ...APPROVED, requestId: 'link-2' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(events).toEqual([{ kind: 'failed' }, { kind: 'opened', url: APPROVED.url }]);
  });

  it('accepts a fresh submission after a completed handoff', async () => {
    const confirm = vi.fn(async () => true);
    const { handler, events } = setup({ confirm });
    await handler.submit(APPROVED);
    await handler.submit({ ...APPROVED, requestId: 'link-2' });
    expect(events).toEqual([
      { kind: 'opened', url: APPROVED.url },
      { kind: 'opened', url: APPROVED.url },
    ]);
  });

  it('invalidate() clears the guard so the next submission is accepted', async () => {
    const { handler, events, confirm, resolveConfirm } = setup();
    const pending = handler.submit(APPROVED);
    await flush();
    handler.invalidate(); // e.g. Close/blur while the confirm is up
    expect(events.at(-1)).toEqual({ kind: 'idle' });
    resolveConfirm(true);
    await pending;

    const confirmCalls = confirm.mock.calls.length;
    const next = handler.submit({ ...APPROVED, requestId: 'link-2' });
    await flush();
    expect(confirm.mock.calls.length).toBe(confirmCalls + 1); // accepted again
    resolveConfirm(true);
    await next;
  });
});

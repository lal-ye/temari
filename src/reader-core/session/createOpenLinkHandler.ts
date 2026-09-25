import { isApprovedLink, MAX_REQUEST_ID, type OpenLinkRequest } from '../bridge';
import { createSingleFlightGuard } from './singleFlight';

/**
 * Link-handoff session (plan §8.5, checkpoint B Phase 4.3).
 *
 * The DOM renders approved HTTPS links as action buttons (§7.3); this factory
 * is the native side of that contract — injected `confirm` (an `Alert`) and
 * `open` (`Linking.openURL`) keep it pure and testable from web vitest. The
 * review's three corrections are structural here:
 *
 * - the confirm is the host's NATIVE alert (never a DOM bar);
 * - `isApprovedLink` runs AGAIN before anything happens (render-time approval
 *   is untrusted at this boundary);
 * - the same single-flight guard as Explain absorbs double-taps, so two rapid
 *   taps can never stack two Alerts;
 * - `open` is a bare `try/catch` handoff — NEVER `canOpenURL` (Android 11+
 *   package-visibility gives false negatives). In airplane mode the handoff
 *   attempt is the success criterion, not a loaded page.
 */
export type OpenLinkRejection = 'shape' | 'invalid-url';

export type OpenLinkEvent =
  | { kind: 'idle' }
  | { kind: 'opened'; url: string }
  | { kind: 'rejected'; reason: OpenLinkRejection }
  | { kind: 'failed' };

export interface OpenLinkHandler {
  submit(raw: unknown): Promise<void>;
  invalidate(): void;
}

export interface OpenLinkDeps {
  /** Native confirm (Alert): resolves true to proceed with the handoff. */
  confirm(url: string): Promise<boolean>;
  /** OS handoff (Linking.openURL); rejects when no handler takes the URL. */
  open(url: string): Promise<void>;
  dispatch(event: OpenLinkEvent): void;
}

/** Accepts exactly the two string fields of `OpenLinkRequest` — unknown keys
 * are a shape failure (nothing else may cross the bridge), like
 * `validateExplainRequest`. */
function parseOpenLinkRequest(raw: unknown): OpenLinkRequest | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const fields = raw as Record<string, unknown>;
  if (typeof fields.url !== 'string' || typeof fields.requestId !== 'string') return null;
  for (const key of Object.keys(fields)) {
    if (key !== 'url' && key !== 'requestId') return null;
  }
  if (fields.requestId.length === 0 || fields.requestId.length > MAX_REQUEST_ID) return null;
  return { url: fields.url, requestId: fields.requestId };
}

export function createOpenLinkHandler(deps: OpenLinkDeps): OpenLinkHandler {
  const guard = createSingleFlightGuard();
  return {
    async submit(raw: unknown): Promise<void> {
      if (guard.isActive()) return; // double-tap absorbed: one confirm, never stacked Alerts
      const request = parseOpenLinkRequest(raw);
      if (request === null) {
        deps.dispatch({ kind: 'rejected', reason: 'shape' });
        return;
      }
      if (!isApprovedLink(request.url)) {
        // Defence in depth: render-time approval is not trusted here.
        deps.dispatch({ kind: 'rejected', reason: 'invalid-url' });
        return;
      }
      guard.checkAndSet(request.requestId);
      try {
        if (await deps.confirm(request.url)) {
          await deps.open(request.url);
          deps.dispatch({ kind: 'opened', url: request.url });
        }
        // A cancel dispatches nothing: the app stays exactly where it was.
      } catch {
        deps.dispatch({ kind: 'failed' });
      } finally {
        guard.clear(request.requestId);
      }
    },

    invalidate(): void {
      guard.clearAll(); // the guard never sticks
      deps.dispatch({ kind: 'idle' });
    },
  };
}

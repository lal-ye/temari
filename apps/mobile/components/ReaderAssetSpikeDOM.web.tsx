/** Expo 'use dom' renders inline on web. Keep untrusted Notes isolated in a
 * sandboxed iframe instead of poisoning the app document's CSP.
 *
 * `allow-same-origin` is required for the offline shell: a service worker cannot
 * intercept requests from an opaque-origin frame, so a sandbox without it could
 * never be served `/reader/index.html` from the cache and the reader was blank
 * offline. Network isolation is unaffected — `scripts/build-reader-web.mjs` gives
 * the reader its own `connect-src 'none'` CSP. Storage isolation *is* given up:
 * the reader shares the app's origin. That is an accepted trade, because the
 * reader runs our own bundled code and untrusted Note text only ever reaches it
 * as postMessage data rendered through sanitized markdown, never as document HTML.
 * Do not add `allow-top-navigation`, `allow-popups` or `allow-forms`. */
import { useCallback, useEffect, useRef } from 'react';
import type { ExplainAction, OpenLinkAction } from '@temari/reader-core/bridge';
import type { DOMProps } from 'expo/dom';
export default function ReaderAssetSpikeDOM({ title, content, noteId = '', onExplain, onOpenLink }: {
  title: string; content: string; noteId?: string; onExplain?: ExplainAction; onOpenLink?: OpenLinkAction; dom?: DOMProps;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const token = useRef<string>(crypto.randomUUID());
  const send = useCallback(() => frame.current?.contentWindow?.postMessage({ type: 'temari:note', token: token.current, title, content, noteId }, '*'), [title, content, noteId]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      // The frame is same-origin so the service worker can serve it offline, so the
      // origin is now a real check rather than the "null" an opaque sandbox reports.
      // Source + unguessable token still bind the channel.
      if (event.origin !== window.location.origin) return;
      if (event.source !== frame.current?.contentWindow || event.data?.token !== token.current) return;
      if (event.data.type === 'temari:explain') void onExplain?.(event.data.payload);
      if (event.data.type === 'temari:link') void onOpenLink?.(event.data.payload);
    };
    window.addEventListener('message', receive); send();
    return () => window.removeEventListener('message', receive);
  }, [send, onExplain, onOpenLink]);
  return <iframe ref={frame} title="Note reader" src="/reader/index.html" sandbox="allow-scripts allow-same-origin" referrerPolicy="no-referrer" onLoad={send} style={{ border: 0, width: '100%', height: '100%', flex: 1, background: '#f7f4ed' }} />;
}

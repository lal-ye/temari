/** Expo 'use dom' renders inline on web. Keep CSP and untrusted Notes isolated
 * in an opaque-origin sandbox instead of poisoning the app document's CSP. */
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
      // Opaque sandbox origins report "null"; source + unguessable channel bind it.
      if (event.source !== frame.current?.contentWindow || event.data?.token !== token.current) return;
      if (event.data.type === 'temari:explain') void onExplain?.(event.data.payload);
      if (event.data.type === 'temari:link') void onOpenLink?.(event.data.payload);
    };
    window.addEventListener('message', receive); send();
    return () => window.removeEventListener('message', receive);
  }, [send, onExplain, onOpenLink]);
  return <iframe ref={frame} title="Note reader" src="/reader/index.html" sandbox="allow-scripts" referrerPolicy="no-referrer" onLoad={send} style={{ border: 0, width: '100%', height: '100%', flex: 1, background: '#f7f4ed' }} />;
}

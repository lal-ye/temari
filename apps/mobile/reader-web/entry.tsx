/** Sandboxed browser host. No keys, storage or network capabilities. */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { NoteReader } from '@temari/reader-core/NoteReader';
import '@temari/reader-core/assets.generated.css';
import '@temari/reader-core/reader.css';
const root = createRoot(document.getElementById('root')!);
let channel: string | null = null;
window.addEventListener('message', (event: MessageEvent) => {
  if (event.source !== parent || event.data?.type !== 'temari:note') return;
  const { title, content, noteId, token } = event.data;
  if (typeof title !== 'string' || typeof content !== 'string' || content.length > 4 * 1024 * 1024 || typeof noteId !== 'string' || typeof token !== 'string') return;
  if (channel !== null && token !== channel) return;
  channel = token;
  const send = async (type: string, payload: unknown) => { parent.postMessage({ type, token, payload }, '*'); };
  root.render(<NoteReader key={noteId} title={title} content={content} noteId={noteId} development={false} linkMode="native-action"
    onExplain={(request) => send('temari:explain', request)} onOpenLink={(request) => send('temari:link', request)} />);
});

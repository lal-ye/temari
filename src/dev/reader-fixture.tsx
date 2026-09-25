import React, { useCallback, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import fixture from '../../fixtures/mobile/reader-kitchen-sink.json';
import { NoteReader } from '../reader-core/NoteReader';
import { newRequestId, type OpenLinkRequest } from '../reader-core/bridge';
import {
  createExplainSessionHandler,
  type ExplainSessionHandler,
  type ExplainSessionState,
} from '../reader-core/session/createExplainSessionHandler';
import '../reader-core/assets.generated.css';
import '../reader-core/reader.css';

// Served only by the Vite development middleware, not imported by the web app.
// Fast loop for checkpoint B Phase 4: the kitchen-sink note through the same
// NoteContent pipeline every host uses, reader skin, with the explicit link
// policy (native-action) against mock bridge actions logged below — no native
// side, no network, no AI, nothing persistent.
//
// Phase 4.1: the mock Explain host runs the SAME createExplainSessionHandler
// factory as the phone screen, so the browser fast loop and the device run
// identical single-active semantics (absorb-while-pending, invalidate drops
// late completions, the guard never sticks).

const MOCK_RUN_MS = 600;

function DevFixture() {
  const [log, setLog] = useState<string[]>([]);
  const [view, setView] = useState<ExplainSessionState>({ kind: 'idle' });
  const push = useCallback((entry: string) => {
    setLog((entries) => [entry, ...entries].slice(0, 6));
  }, []);

  const sessionRef = useRef<ExplainSessionHandler | null>(null);
  if (sessionRef.current === null) {
    sessionRef.current = createExplainSessionHandler({
      expectedNoteId: fixture.id,
      isAlive: () => true, // the dev page lives as long as its tab
      isFocused: () => true,
      dispatch: setView,
      run: async (request) => {
        await new Promise((resolve) => setTimeout(resolve, MOCK_RUN_MS));
        return `MOCK · checkpoint B — “${request.term}”: ${request.context.slice(0, 120)}`;
      },
    });
  }
  const session = sessionRef.current;

  // Mocks only (D3): labeled as mock wherever they surface.
  const onOpenLink = useCallback(async (request: OpenLinkRequest) => {
    push(`onOpenLink (mock) · ${request.url} · ${request.requestId}`);
  }, [push]);

  const sendMock = useCallback(() => {
    void session.submit({
      noteId: fixture.id,
      term: 'Dev panel',
      context: 'constant payload from the dev fixture (mock)',
      requestId: newRequestId(),
    });
  }, [session]);
  const invalidate = useCallback(() => {
    session.invalidate();
  }, [session]);

  return (
    <>
      <NoteReader
        title={fixture.title}
        content={fixture.content}
        development
        linkMode="native-action"
        onOpenLink={onOpenLink}
      />
      <aside className="reader-dev-panel" aria-label="Mock bridge actions (dev panel)">
        <strong>Mock bridge actions (dev panel)</strong>
        <p>
          The mock Explain host runs the same session factory as the phone
          screen: submit twice quickly and the second is absorbed; Close while
          pending drops the late completion and never wedges the guard.
          Selection wiring arrives in Phase 4.2 — the button below feeds the
          session directly with a constant payload.
        </p>
        <div className="reader-dev-actions">
          <button type="button" onClick={sendMock}>Send mock Explain (dev panel)</button>
          <button type="button" onClick={invalidate}>Close (invalidate)</button>
        </div>
        <p role="status">
          Session: <strong>{view.kind}</strong>
          {view.kind === 'done' && <> · “{view.request.term}” · {view.result.slice(0, 80)}…</>}
          {view.kind === 'error' && <> · {view.reason}</>}
        </p>
        <ul>
          {log.length === 0
            ? <li>No link actions yet — try the “Remote link label” action button in the note.</li>
            : log.map((entry) => <li key={entry}>{entry}</li>)}
        </ul>
      </aside>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<DevFixture />);

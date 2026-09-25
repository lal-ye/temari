import React, { useCallback, useState } from 'react';
import { createRoot } from 'react-dom/client';
import fixture from '../../fixtures/mobile/reader-kitchen-sink.json';
import { ReaderAssetSpike } from '../reader-core/ReaderAssetSpike';
import { newRequestId, type ExplainRequest, type OpenLinkRequest } from '../reader-core/bridge';
import '../reader-core/assets.generated.css';
import '../reader-core/reader.css';

// Served only by the Vite development middleware, not imported by the web app.
// Fast loop for checkpoint B Phase 3: the kitchen-sink note through the same
// NoteContent pipeline every host uses, reader skin, with the explicit link
// policy (native-action) resolved against MOCK bridge actions logged below —
// no native side, no network, no AI, nothing persistent.

function DevFixture() {
  const [log, setLog] = useState<string[]>([]);
  const push = useCallback((entry: string) => {
    setLog((entries) => [entry, ...entries].slice(0, 6));
  }, []);

  // Mocks only (D3): labeled as mock wherever they surface. Phase 3 wires the
  // link action; Explain fires from real selection wiring in Phase 4.
  const onOpenLink = useCallback(async (request: OpenLinkRequest) => {
    push(`onOpenLink (mock) · ${request.url} · ${request.requestId}`);
  }, [push]);
  const onExplain = useCallback(async (request: ExplainRequest) => {
    push(`onExplain (mock) · ${request.term} · ${request.requestId}`);
  }, [push]);

  return (
    <>
      <ReaderAssetSpike
        title={fixture.title}
        content={fixture.content}
        development
        linkMode="native-action"
        onOpenLink={onOpenLink}
      />
      <aside className="reader-dev-panel" aria-label="Mock bridge actions (dev panel)">
        <strong>Mock bridge actions (dev panel)</strong>
        <p>
          Phase 3 wires the approved-HTTPS link action only. The Explain action
          still has no selection wiring; the button below sends one mock payload
          through the same contract.
        </p>
        <button
          type="button"
          onClick={() => {
            void onExplain({
              noteId: fixture.id,
              term: 'Dev panel',
              context: 'constant payload from the dev fixture (mock)',
              requestId: newRequestId(),
            });
          }}
        >
          Send mock Explain (dev panel)
        </button>
        <ul>
          {log.length === 0
            ? <li>No actions yet — try the “Remote link label” action button in the note.</li>
            : log.map((entry) => <li key={entry}>{entry}</li>)}
        </ul>
      </aside>
    </>
  );
}

createRoot(document.getElementById('root')!).render(<DevFixture />);

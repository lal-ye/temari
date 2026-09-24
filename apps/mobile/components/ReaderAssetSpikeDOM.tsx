'use dom';

import { ReaderAssetSpike } from '../../../src/reader-core/ReaderAssetSpike';
import { newRequestId, type ExplainAction } from '../../../src/reader-core/bridge';
import '../../../src/reader-core/assets.generated.css';
import '../../../src/reader-core/reader.css';

export default function ReaderAssetSpikeDOM({ title, content, noteId, onExplain }: {
  title: string;
  content: string;
  /** Checkpoint B bridge: the note's id, sent with every action payload. */
  noteId?: string;
  /** Checkpoint B bridge: top-level async action (mock at B). Serializable
   * payloads only — no DOM nodes, nested callbacks or settings. */
  onExplain?: ExplainAction;
  dom?: import('expo/dom').DOMProps;
}) {
  return <>
    {onExplain && noteId && (
      <button
        type="button"
        style={{ display: 'block', width: '100%', padding: '10px 12px', font: '600 13px/1.4 "Geist Variable", sans-serif', color: '#fffaf0', background: '#2457a5', border: 0 }}
        onClick={async () => {
          // Phase 1 smoke: constant payload over the real function-prop bridge.
          // Replaced by selection → Explain wiring in Phase 4.
          try {
            await onExplain({ noteId, term: 'Smoke', context: 'constant payload', requestId: newRequestId() });
          } catch {
            // Failures are surfaced natively; the DOM shows nothing extra.
          }
        }}
      >Send test action (checkpoint B bridge smoke)</button>
    )}
    <ReaderAssetSpike title={title} content={content} development={process.env.NODE_ENV !== 'production'} />
  </>;
}

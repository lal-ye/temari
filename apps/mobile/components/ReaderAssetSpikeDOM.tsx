'use dom';

import { NoteReader } from '../../../src/reader-core/NoteReader';
import type { ExplainAction, OpenLinkAction } from '../../../src/reader-core/bridge';
import '../../../src/reader-core/assets.generated.css';
import '../../../src/reader-core/reader.css';

/**
 * The one 'use dom' seam (checkpoint B): note fields plus the two top-level
 * async actions. Serializable payloads only — no DOM nodes, nested callbacks
 * or settings. The Phase-1 smoke button is retired in Phase 4.2: real
 * selection wiring drives `onExplain` now, and approved links dispatch
 * `onOpenLink` (native-action) for the host's single native confirmation.
 */
export default function ReaderAssetSpikeDOM({ title, content, noteId, onExplain, onOpenLink, dom }: {
  title: string;
  content: string;
  /** Checkpoint B bridge: the note's id, sent with every action payload. */
  noteId?: string;
  /** Checkpoint B bridge: Explain action (mock at B). */
  onExplain?: ExplainAction;
  /** Checkpoint B bridge: approved-HTTPS link handoff (native confirm). */
  onOpenLink?: OpenLinkAction;
  dom?: import('expo/dom').DOMProps;
}) {
  return (
    <NoteReader
      title={title}
      content={content}
      development={process.env.NODE_ENV !== 'production'}
      noteId={noteId}
      onExplain={onExplain}
      // The reader screen's explicit policy; without an onOpenLink handler
      // approved links render inert (never navigable anchors by accident).
      linkMode="native-action"
      onOpenLink={onOpenLink}
    />
  );
}

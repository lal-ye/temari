import React, { useEffect, useRef, useState } from 'react';
import { NoteContent } from './NoteContent';
import { readerCsp } from './csp';
import {
  buildExplainRequest,
  MIN_TERM_LENGTH,
  MAX_TERM_LENGTH,
  type ExplainAction,
  type OpenLinkAction,
} from './bridge';
import { contextWindow } from './selection/segmentTerm';

const fontChecks = [
  { label: 'Amharic / Abyssinica SIL', font: '17px "Abyssinica SIL"', text: 'ተማሪ' },
  { label: 'Body / Geist', font: '17px "Geist Variable"', text: 'Energy' },
  { label: 'Headings / Playfair Display', font: '700 24px "Playfair Display"', text: 'Energy' },
  { label: 'Math / KaTeX', font: '17px KaTeX_Main', text: 'E=mc' },
];

/**
 * Selection settle window (plan §8.1): Android's WebView fires `selectionchange`
 * continuously while a selection handle is dragged, so the candidate is
 * derived ONCE, this many ms after the last event — and `term`/`context` are
 * captured at that settle moment, never on chip tap (the button press changes
 * focus and collapses the selection).
 */
export const SELECTION_SETTLE_MS = 300;

/** Block-level content elements: a phrase may live in one, never across two. */
const BLOCK_SELECTOR = 'p, li, h1, h2, h3, h4, h5, h6, td, th, blockquote, pre, figcaption, figure, dt, dd';

/** A term+context pair captured at selection settle (or from a diagram tap). */
export interface SelectionCandidate {
  term: string;
  context: string;
}

function closestBlock(node: Node, container: HTMLElement): HTMLElement | null {
  let current: Node | null = node;
  while (current && current !== container) {
    if (current.nodeType === 1) {
      const element = current as HTMLElement;
      if (element.matches(BLOCK_SELECTOR)) return element;
    }
    current = current.parentNode;
  }
  return current === container ? container : null;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Derive a candidate from the current selection, or null when the selection
 * must not propose anything (plan §8.1): collapsed, either endpoint outside
 * the note container, anchor and focus in different blocks (multi-block
 * selections are rejected, not repaired — `contextWindow` assumes one text
 * context), or the whitespace-collapsed phrase outside 2..60 chars.
 */
function deriveCandidate(container: HTMLElement | null): SelectionCandidate | null {
  if (!container) return null;
  if (typeof document === 'undefined') return null;
  const selection = document.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
  const { anchorNode, focusNode } = selection;
  if (!anchorNode || !focusNode) return null;
  // Both endpoints must live inside the note content — selections from the
  // status panel, chips or other UI are ignored.
  if (!container.contains(anchorNode) || !container.contains(focusNode)) return null;
  const anchorBlock = closestBlock(anchorNode, container);
  const focusBlock = closestBlock(focusNode, container);
  if (!anchorBlock || anchorBlock !== focusBlock) return null;
  const phrase = collapseWhitespace(selection.toString());
  if (phrase.length < MIN_TERM_LENGTH || phrase.length > MAX_TERM_LENGTH) return null;
  const blockText = collapseWhitespace(anchorBlock.textContent ?? '');
  const idx = blockText.indexOf(phrase);
  if (idx < 0) return null;
  return { term: phrase, context: contextWindow(blockText, idx, idx + phrase.length) };
}

/** Reader host shell (renamed from ReaderAssetSpike at checkpoint B Phase 4.1);
 * deliberately no settings object or browser store access. CSS is imported by
 * each host, keeping this module importable in a Node smoke test.
 * The note itself renders through the shared NoteContent pipeline (skin
 * "reader") — the same renderer the web app uses, so the fixture exercises the
 * exact production pipeline.
 *
 * Phase 4.2: selection (debounced, container-scoped, single-block, 2..60
 * chars) proposes a candidate; the fixed-bottom mock-labeled chip runs it
 * through `buildExplainRequest` into the host's `onExplain` action. Diagram
 * node taps join the same funnel. `onOpenLink` is the native-action link
 * path (one native confirmation, §7.3).
 */
export function NoteReader({ title, content, development, linkMode = 'disabled', onOpenLink, noteId, onExplain }: {
  title: string;
  content: string;
  development: boolean;
  /** Explicit link policy (plan §7.3); never inferred from `onOpenLink`.
   * `native-action` without a handler renders approved links inert. */
  linkMode?: 'disabled' | 'native-action';
  /** native-action mode only: receives approved HTTPS URLs; the host owns the
   * single confirmation and the OS handoff. */
  onOpenLink?: OpenLinkAction;
  /** The note being read; sent with every Explain payload. */
  noteId?: string;
  /** The host's Explain action (the single-active session lives there). */
  onExplain?: ExplainAction;
}) {
  const [ready, setReady] = useState(false);
  const [fonts, setFonts] = useState<Record<string, string>>({});
  const [violations, setViolations] = useState<string[]>([]);
  const [candidate, setCandidate] = useState<SelectionCandidate | null>(null);
  const contentRef = useRef<HTMLElement>(null);
  const settleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Keep the meta for the document lifetime. Removing it does not remove an
    // enforced CSP anyway. Neither this browser page nor DOM document mounts App.
    if (!document.querySelector('meta[data-reader-csp]')) {
      const meta = document.createElement('meta');
      meta.httpEquiv = 'Content-Security-Policy';
      meta.content = readerCsp(development, window.location.origin);
      meta.dataset.readerCsp = 'true';
      document.head.prepend(meta);
    }
    const onViolation = (event: SecurityPolicyViolationEvent) => {
      // Never log a blocked URL: it can carry user data in its path/query.
      setViolations(previous => Array.from(new Set([...previous, event.effectiveDirective])));
    };
    document.addEventListener('securitypolicyviolation', onViolation);
    setReady(true);
    let active = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const check of fontChecks) {
      const timer = setTimeout(() => {
        if (active) setFonts(values => ({ ...values, [check.label]: 'FAILED: font load timed out' }));
      }, 10000);
      timers.push(timer);
      const load = document.fonts
        ? document.fonts.load(check.font, check.text)
        : Promise.reject(new Error('Font Loading API unavailable'));
      load.then(faces => {
        clearTimeout(timer);
        if (active) setFonts(values => ({ ...values, [check.label]: faces.length > 0 ? 'loaded' : 'FAILED: bundled face missing' }));
      }).catch(() => {
        clearTimeout(timer);
        if (active) setFonts(values => ({ ...values, [check.label]: 'FAILED: font could not load' }));
      });
    }
    return () => {
      active = false;
      timers.forEach(clearTimeout);
      document.removeEventListener('securitypolicyviolation', onViolation);
    };
  }, [development]);

  // ONE debounced selection derive (plan §8.1 / §12): selectionchange fires
  // continuously during handle-drag on Android; touchend/mouseup only re-arm
  // the same settle timer. Deriving happens once, SELECTION_SETTLE_MS after
  // the last event.
  useEffect(() => {
    const schedule = () => {
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
      settleTimerRef.current = setTimeout(() => {
        settleTimerRef.current = null;
        setCandidate(deriveCandidate(contentRef.current));
      }, SELECTION_SETTLE_MS);
    };
    document.addEventListener('selectionchange', schedule);
    document.addEventListener('touchend', schedule);
    document.addEventListener('mouseup', schedule);
    return () => {
      document.removeEventListener('selectionchange', schedule);
      document.removeEventListener('touchend', schedule);
      document.removeEventListener('mouseup', schedule);
      if (settleTimerRef.current) clearTimeout(settleTimerRef.current);
    };
  }, []);

  /**
   * Chip run: the candidate was captured at selection settle (never re-read
   * here — the press collapses the selection); the builder owns bounds and
   * the 302→300 context clamp. Failures surface on the host side.
   */
  const runMockExplain = () => {
    const current = candidate;
    setCandidate(null);
    if (!current || !noteId || !onExplain) return;
    const request = buildExplainRequest({ noteId, term: current.term, context: current.context });
    if (!request) return;
    onExplain(request).catch(() => {});
  };

  // Diagram node taps join the same funnel; the element (web morph origin)
  // stays DOM-side and is dropped here.
  const handleTermActivate = (term: string, context: string) => {
    setCandidate({ term, context });
  };

  const failed = violations.length > 0 || Object.values(fonts).some(value => value.startsWith('FAILED'));
  return <main className="reader-lab">
    <header>
      <span className="reader-eyebrow">M2 · Reader / kitchen-sink fixture</span>
      <h1>{title}</h1>
      <p className="reader-intro">One Note, two hosts. Local fonts, math and editorial SVG. No storage, API calls or real credentials. Select a phrase for the mock Explain action; approved HTTPS links hand off through the host action.</p>
    </header>
    <aside className="reader-status" data-failed={failed} role="status" aria-live="polite">
      <strong>{failed ? 'Asset/security check needs attention' : 'Bundled font checks'}</strong>
      <ul>{fontChecks.map(check => <li key={check.label}>{check.label}: {fonts[check.label] ?? 'checking…'}</li>)}</ul>
      <p>CSP: {ready ? 'installed before Note mount' : 'installing…'} · {development ? 'development / local server permitted' : 'release / network connections blocked'}</p>
      {violations.length > 0 && <p>Blocked resource directives: {violations.join(', ')}. Inspect locally; do not paste sensitive URLs.</p>}
      <p>Loaded fonts are not proof of offline operation. Verify this screen in an installed preview APK, after force-stop, with airplane mode on and Wi-Fi off.</p>
    </aside>
    {ready ? (
      <article aria-label="Kitchen-sink Note" ref={contentRef}>
        <NoteContent
          content={content}
          noteTitle={title}
          skin="reader"
          linkMode={linkMode}
          onOpenLink={onOpenLink}
          onTermActivate={handleTermActivate}
        />
      </article>
    ) : <p>Preparing protected reader…</p>}
    {/* Selection chip (plan §8.1): a FIXED bottom bar inside the DOM, never a
        positioned popover — Android's floating ActionMode toolbar owns the
        space above a selection in a WebView. The action is labeled mock (D3). */}
    {candidate && noteId && onExplain && (
      <div className="reader-chip-bar" role="status">
        <span className="reader-chip-term">“{candidate.term}”</span>
        <span className="reader-chip-hint">Run a <strong>mock</strong> explanation (checkpoint B — no network, no AI)?</span>
        <span className="reader-chip-spacer" />
        <button type="button" className="reader-chip-dismiss" onClick={() => setCandidate(null)}>Not now</button>
        <button type="button" className="reader-chip-run" onClick={runMockExplain}>Run mock explanation</button>
      </div>
    )}
  </main>;
}

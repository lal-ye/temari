// @vitest-environment jsdom
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, act } from '@testing-library/react';
import { NoteReader, SELECTION_SETTLE_MS } from './NoteReader';

/**
 * Selection wiring (plan §8.1), client-side: the debounced selectionchange
 * funnel, container/bounds/multi-block rejection, capture-at-settle, the
 * fixed-bottom mock-labeled chip, and the diagram-tap funnel. The single-active
 * semantics behind `onExplain` are covered separately against the pure session
 * factory (createExplainSessionHandler.test.ts).
 */

const CONTENT = [
  '# Heading',
  '',
  'First paragraph with selectable words inside it.',
  '',
  'Second paragraph holds entirely different words.',
  '',
  'A third paragraph deliberately long enough to exceed the sixty character phrase bound.',
].join('\n');

const fence = (title: string) =>
  [
    '```diagram',
    JSON.stringify({
      version: 1,
      type: 'loop',
      title,
      hub: { id: 'atp', label: 'ATP' },
      nodes: [
        { id: 'a', label: 'Glycolysis' },
        { id: 'b', label: 'Krebs cycle' },
      ],
      edges: [{ from: 'a', to: 'atp', label: 'Pyruvate' }],
    }),
    '```',
  ].join('\n');

function select(startNode: Node, startOffset: number, endNode: Node, endOffset: number) {
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  const range = document.createRange();
  range.setStart(startNode, startOffset);
  range.setEnd(endNode, endOffset);
  selection.addRange(range);
  document.dispatchEvent(new Event('selectionchange'));
}

function collapseSelection() {
  const selection = document.getSelection()!;
  selection.removeAllRanges();
  document.dispatchEvent(new Event('selectionchange'));
}

/** Paragraph text nodes by order of appearance in the rendered note. */
function paragraph(container: HTMLElement, index: number): Text {
  const p = container.querySelectorAll('article p')[index];
  if (!p?.firstChild) throw new Error(`paragraph ${index} not rendered`);
  return p.firstChild as Text;
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(SELECTION_SETTLE_MS);
  });
}

const PROPS = {
  title: 'Reader test',
  content: CONTENT,
  development: true,
  noteId: 'note-reader-test',
  onExplain: undefined as undefined | (() => Promise<void>),
};

describe('NoteReader selection funnel (plan §8.1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    document.getSelection()?.removeAllRanges();
    vi.useRealTimers();
  });

  it('derives nothing before the debounce settles, then shows the mock-labeled chip', async () => {
    const onExplain = vi.fn(async () => {});
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    select(paragraph(container, 0), 0, paragraph(container, 0), 5); // "First"
    expect(container.querySelector('.reader-chip-bar')).toBeNull(); // debounce pending

    await settle();
    const bar = container.querySelector('.reader-chip-bar');
    expect(bar).not.toBeNull();
    expect(bar!.textContent).toContain('First');
    expect(bar!.textContent).toContain('mock'); // D3: the action itself is labeled
  });

  it('runs the chip through buildExplainRequest (bounded payload, fresh id) and hides', async () => {
    const onExplain = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    select(paragraph(container, 0), 0, paragraph(container, 0), 5);
    await settle();
    fireEvent.click(container.querySelector('.reader-chip-run')!);

    expect(onExplain).toHaveBeenCalledTimes(1);
    const request = onExplain.mock.calls[0][0];
    expect(request).toMatchObject({ noteId: 'note-reader-test', term: 'First' });
    expect(request.requestId).toMatch(/^r-/);
    expect(typeof request.context).toBe('string');
    expect(request.context.length).toBeGreaterThan(0);
    expect(request.context.length).toBeLessThanOrEqual(300);
    // No extra fields cross the boundary.
    expect(Object.keys(request).sort()).toEqual(['context', 'noteId', 'requestId', 'term']);
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
  });

  it('captures at settle: the payload is never re-read from the (collapsed) selection at press time', async () => {
    const onExplain = vi.fn().mockResolvedValue(undefined);
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    select(paragraph(container, 0), 0, paragraph(container, 0), 5);
    await settle();
    // The button press moves focus and collapses the selection — the candidate
    // was already captured at settle, so the dispatched term is still "First".
    collapseSelection();
    fireEvent.click(container.querySelector('.reader-chip-run')!);
    expect(onExplain).toHaveBeenCalledTimes(1);
    expect(onExplain.mock.calls[0][0].term).toBe('First');
  });

  it('clears the chip when the selection collapses', async () => {
    const onExplain = vi.fn(async () => {});
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    select(paragraph(container, 0), 0, paragraph(container, 0), 5);
    await settle();
    expect(container.querySelector('.reader-chip-bar')).not.toBeNull();

    collapseSelection();
    await settle();
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
    expect(onExplain).not.toHaveBeenCalled();
  });

  it('rejects a phrase longer than 60 chars (web behavior cap)', async () => {
    const onExplain = vi.fn(async () => {});
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    const text = paragraph(container, 2); // "A third paragraph with a selected phrase for bounds tests."
    select(text, 0, text, 70);
    await settle();
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
    expect(onExplain).not.toHaveBeenCalled();
  });

  it('rejects multi-block selections (anchor and focus in different blocks)', async () => {
    const onExplain = vi.fn(async () => {});
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    select(paragraph(container, 0), 0, paragraph(container, 1), 8); // spans the paragraph boundary
    await settle();
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
    expect(onExplain).not.toHaveBeenCalled();
  });

  it('ignores selections outside the note container (status panel, header)', async () => {
    const onExplain = vi.fn(async () => {});
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    const heading = container.querySelector('header h1')!.firstChild!;
    select(heading, 0, heading, 6);
    await settle();
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
    expect(onExplain).not.toHaveBeenCalled();
  });

  it('shows no chip without an Explain action (selection alone proposes nothing)', async () => {
    const { container } = render(<NoteReader {...PROPS} onExplain={undefined} />);

    select(paragraph(container, 0), 0, paragraph(container, 0), 5);
    await settle();
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
  });

  it('funnels diagram node taps through the same chip and builder', async () => {
    const onExplain = vi.fn().mockResolvedValue(undefined);
    const { container } = render(
      <NoteReader
        {...PROPS}
        content={[fence('Overview'), CONTENT].join('\n')}
        onExplain={onExplain}
      />,
    );

    const node = container.querySelector('g[aria-label="Explain Glycolysis"]');
    expect(node).not.toBeNull();
    fireEvent.click(node!);

    // Diagram taps propose immediately (no selection to debounce).
    expect(container.querySelector('.reader-chip-bar')).not.toBeNull();
    fireEvent.click(container.querySelector('.reader-chip-run')!);
    expect(onExplain).toHaveBeenCalledTimes(1);
    expect(onExplain.mock.calls[0][0]).toMatchObject({ term: 'Glycolysis' });
  });

  it('“Not now” dismisses the chip without dispatching', async () => {
    const onExplain = vi.fn(async () => {});
    const { container } = render(<NoteReader {...PROPS} onExplain={onExplain} />);

    select(paragraph(container, 0), 0, paragraph(container, 0), 5);
    await settle();
    fireEvent.click(container.querySelector('.reader-chip-dismiss')!);
    expect(container.querySelector('.reader-chip-bar')).toBeNull();
    expect(onExplain).not.toHaveBeenCalled();
  });
});

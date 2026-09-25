// @vitest-environment jsdom
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { NoteContent } from './NoteContent';

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
      edges: [
        { from: 'a', to: 'atp', label: 'Pyruvate' },
        { from: 'atp', to: 'b', kind: 'return' },
      ],
    }),
    '```',
  ].join('\n');

const callout = '> [!TIP]\n> Keep **bold** and `code` intact.';

describe('NoteContent skins (one structure, presentation tokens)', () => {
  it('renders the web skin with the web classes and callout icons', () => {
    const html = renderToStaticMarkup(<NoteContent content={callout} skin="web" />);
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('note-callout');
    expect(html).toContain('Helpful Tip');
    expect(html).toContain('lucide'); // lucide-react inline SVG (web skin icons)
    expect(html).toContain('bold</strong>');
  });

  it('renders the reader skin on the same structure without icons', () => {
    const html = renderToStaticMarkup(<NoteContent content={callout} skin="reader" />);
    expect(html).toContain('data-callout="tip"');
    expect(html).toContain('reader-callout');
    expect(html).toContain('reader-callout-label');
    expect(html).toContain('Helpful Tip');
    expect(html).not.toContain('lucide');
    expect(html).toContain('bold</strong>');
  });

  it('keeps the web h2 amber dot and omits it on the reader skin', () => {
    expect(renderToStaticMarkup(<NoteContent content="## Heading" skin="web" />)).toContain('bg-amber-500');
    expect(renderToStaticMarkup(<NoteContent content="## Heading" skin="reader" />)).not.toContain('bg-amber-500');
  });
});

describe('NoteContent content normalization', () => {
  it('normalizes citation spans in one place', () => {
    const html = renderToStaticMarkup(
      <NoteContent content={'As shown <span class="citation">[[3]]</span> earlier.'} skin="web" />,
    );
    expect(html).toContain('<sup>[3]</sup>');
    expect(html).not.toContain('class="citation"');
  });

  it('numbers figures by document order (shared rehypeNoteAnchors)', () => {
    const html = renderToStaticMarkup(
      <NoteContent content={[fence('Overview'), '```ts', 'const notAFigure = true;', '```', fence('Detail')].join('\n')} skin="reader" />,
    );
    expect(html).toContain('Fig. 1');
    expect(html).toContain('Fig. 2');
    expect(html).not.toContain('Fig. 3');
    expect(html).toContain('fig-1-title');
    expect(html).toContain('fig-2-title');
  });
});

describe('NoteContent term activation (client-side)', () => {
  afterEach(cleanup);

  it('routes a diagram node click to onTermActivate WITH its element (web morph origin)', () => {
    const onTermActivate = vi.fn();
    const { container } = render(<NoteContent content={fence('Overview')} skin="web" onTermActivate={onTermActivate} />);

    const node = container.querySelector('g[aria-label="Explain Glycolysis"]');
    expect(node).not.toBeNull();
    fireEvent.click(node!);

    expect(onTermActivate).toHaveBeenCalledTimes(1);
    const [term, context, element] = onTermActivate.mock.calls[0];
    expect(term).toBe('Glycolysis');
    expect(typeof context).toBe('string');
    expect(context.length).toBeGreaterThan(0);
    // The element travels DOM-side only (web morph); the native host drops it.
    expect(element).toBe(node);
  });
});

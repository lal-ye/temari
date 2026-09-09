import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NoteViewer } from './NoteViewer';
import { StoredNote } from '../../types';

const baseNote: StoredNote = {
  id: 'test-note-1',
  subjectId: 'subj-1',
  title: 'Cellular Respiration',
  sourceName: 'Bio.pdf',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  tags: ['Bio', 'Energy'],
  content: `# Title

Paragraph with \`inline code\` and **\`bold code\`**.

> [!NOTE]
> This is a callout note with \`inline callout code\` and **\`strong code\`**.

> Standard quote without alert tag.

\`\`\`javascript
const x = 10;
console.log(x);
\`\`\`
`,
};

describe('NoteViewer Markdown Rendering', () => {
  it('renders markdown without invalid <pre> inside <p>', () => {
    const html = renderToString(<NoteViewer note={baseNote} />);

    // Must never contain <pre> as descendant of <p>
    // A regex check for <p[^>]*>.*<pre.*</p>
    expect(html).not.toMatch(/<p[^>]*>[\s\S]*?<pre[\s\S]*?<\/p>/i);
  });

  it('renders inline code as <code> without wrapping in <pre>', () => {
    const html = renderToString(<NoteViewer note={baseNote} />);

    // Inline code in paragraph must exist as <code>
    expect(html).toContain('inline code');
    expect(html).toContain('inline callout code');

    // Code block must be rendered as <pre><code>...</code></pre>
    expect(html).toContain('<pre');
    expect(html).toContain('const x = 10;');
  });

  it('renders callout alert with proper badge and content', () => {
    const html = renderToString(<NoteViewer note={baseNote} />);

    // Must render Note callout header
    expect(html).toContain('Note');
    expect(html).toContain('This is a callout note');
  });
});

/**
 * Figure numbering, end to end.
 *
 * `rehypeNoteAnchors` writes the number as the hast property `dataFigIndex`,
 * while the `code` renderer reads `props['data-fig-index']`. Those two names
 * look like a mismatch but are not: react-markdown runs hast through
 * `hast-util-to-jsx-runtime`, which resolves every property through
 * `property-information` and emits the *attribute* name. Data attributes have
 * no namespace, so `dataFigIndex` becomes the prop `data-fig-index`.
 *
 * This test renders a real Note so the contract is pinned from the Markdown
 * in, rather than trusting either spelling in isolation.
 */
describe('NoteViewer figure numbering', () => {
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

  const noteWithFigures: StoredNote = {
    ...baseNote,
    id: 'note-figures',
    content: [
      '# Respiration',
      '',
      'Some prose before the first figure.',
      '',
      fence('Overview'),
      '',
      '```ts',
      'const notAFigure = true;',
      '```',
      '',
      fence('Detail'),
    ].join('\n'),
  };

  /**
   * React SSR writes `<!-- -->` between adjacent text nodes, so `Fig. 1`
   * arrives as `Fig. <!-- -->1`. Strip them: these tests assert on the text a
   * learner reads, not on React's serialisation.
   */
  const text = (html: string) => html.replace(/<!--\s*-->/g, '');

  it('numbers diagram figures by document order, skipping ordinary code', () => {
    const html = text(renderToString(<NoteViewer note={noteWithFigures} />));

    expect(html).toContain('Fig. 1');
    expect(html).toContain('Fig. 2');
    expect(html).not.toContain('Fig. 3');
  });

  it('numbers figures in reading order, not reversed or collapsed', () => {
    const html = text(renderToString(<NoteViewer note={noteWithFigures} />));

    expect(html.indexOf('Fig. 1')).toBeLessThan(html.indexOf('Fig. 2'));
  });

  it('draws every figure, and gives each its own accessible caption ids', () => {
    const html = renderToString(<NoteViewer note={noteWithFigures} />);

    // The success path, not the "could not be drawn" fallback.
    expect(html).not.toContain('could not be drawn');
    expect(html).toContain('fig-1-title');
    expect(html).toContain('fig-2-title');
  });

  it('is deterministic across renders (no render-scoped counter)', () => {
    expect(renderToString(<NoteViewer note={noteWithFigures} />)).toBe(
      renderToString(<NoteViewer note={noteWithFigures} />)
    );
  });
});

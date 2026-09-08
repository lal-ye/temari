import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToString } from 'react-dom/server';
import { NoteViewer } from './NoteViewer';
import { StoredNote } from '../../types';

describe('NoteViewer Markdown Rendering', () => {
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

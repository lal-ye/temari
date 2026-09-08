import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeRaw from 'rehype-raw';
import { figureLanguage, rehypeNoteAnchors } from './rehypeNoteAnchors';

/**
 * Reading landmarks (docs/ui-plan-truthful-interaction.md §5).
 *
 * The reading place is stored as "N px below heading `sec-K`". That only
 * works if `sec-K` is a pure function of the Markdown — the same on every
 * render, in StrictMode, and after a hub switch. These tests run the real
 * unified pipeline (parse → rehype → raw HTML) with the plugin and read the
 * ids straight off the hast tree.
 */

interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  value?: string;
}

function toHast(markdown: string): HastNode {
  const processor = unified()
    .use(remarkParse)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeRaw)
    .use(rehypeNoteAnchors as never);
  const mdast = processor.parse(markdown);
  return processor.runSync(mdast) as unknown as HastNode;
}

function collect(node: HastNode, pred: (n: HastNode) => boolean, out: HastNode[] = []): HastNode[] {
  if (pred(node)) out.push(node);
  node.children?.forEach((c) => collect(c, pred, out));
  return out;
}

const text = (n: HastNode): string =>
  n.value ?? (n.children ?? []).map(text).join('');

const headingsOf = (md: string) =>
  collect(toHast(md), (n) => n.type === 'element' && /^h[1-3]$/.test(n.tagName ?? '')).map((h) => ({
    id: h.properties?.id,
    text: text(h),
  }));

describe('rehypeNoteAnchors: heading ids', () => {
  it('numbers h1/h2/h3 by document order', () => {
    expect(headingsOf('# A\n\n## B\n\n### C\n\n## D')).toEqual([
      { id: 'sec-1', text: 'A' },
      { id: 'sec-2', text: 'B' },
      { id: 'sec-3', text: 'C' },
      { id: 'sec-4', text: 'D' },
    ]);
  });

  it('gives duplicate headings distinct ids (slugs would collide)', () => {
    const ids = headingsOf('## Structure\n\ntext\n\n## Structure\n\ntext\n\n## Structure').map((h) => h.id);
    expect(ids).toEqual(['sec-1', 'sec-2', 'sec-3']);
    expect(new Set(ids).size).toBe(3);
  });

  it('handles Amharic headings (no Latin characters to slug)', () => {
    expect(headingsOf('# የሕዋስ ክፍሎች\n\n## ሽፋን')).toEqual([
      { id: 'sec-1', text: 'የሕዋስ ክፍሎች' },
      { id: 'sec-2', text: 'ሽፋን' },
    ]);
  });

  it('leaves h4+ alone (the outline is h1–h3 only)', () => {
    const tree = toHast('#### Deep\n\n# Top');
    const h4 = collect(tree, (n) => n.tagName === 'h4')[0];
    expect(h4.properties?.id).toBeUndefined();
    expect(headingsOf('#### Deep\n\n# Top')).toEqual([{ id: 'sec-1', text: 'Top' }]);
  });

  it('is deterministic: the same Markdown yields the same ids every run', () => {
    const md = '# A\n\n## B\n\n## B\n\n### C';
    expect(headingsOf(md)).toEqual(headingsOf(md));
    expect(headingsOf(md)).toEqual(headingsOf(md));
  });

  it('numbers raw-HTML headings too, since rehype-raw runs first', () => {
    expect(headingsOf('<h2>Raw</h2>\n\n## Markdown')).toEqual([
      { id: 'sec-1', text: 'Raw' },
      { id: 'sec-2', text: 'Markdown' },
    ]);
  });
});

describe('rehypeNoteAnchors: figure numbering', () => {
  it('numbers diagram fences in order and skips ordinary code', () => {
    const md = ['```ts', 'x', '```', '', '```diagram', 'a', '```', '', '```mermaid', 'b', '```'].join('\n');
    const codes = collect(toHast(md), (n) => n.tagName === 'code');
    expect(codes.map((c) => c.properties?.dataFigIndex)).toEqual([undefined, 1, 2]);
  });

  it('figureLanguage recognises the fence languages NoteViewer renders as figures', () => {
    expect(figureLanguage(['language-diagram'])).toBe('diagram');
    expect(figureLanguage('language-Mermaid')).toBe('mermaid');
    expect(figureLanguage(['language-ts'])).toBeNull();
    expect(figureLanguage(undefined)).toBeNull();
  });
});

describe('NoteViewer wires the landmarks', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const viewer = readFileSync(join(here, './NoteViewer.tsx'), 'utf8');

  it('runs the plugin and passes the ids through the heading renderers', () => {
    expect(viewer).toContain('rehypePlugins={[rehypeRaw, rehypeKatex, rehypeNoteAnchors]}');
    expect(viewer).toMatch(/h1\(\{ children, id \}: any\)[\s\S]*<h1 id=\{id\}/);
    expect(viewer).toMatch(/h2\(\{ children, id \}: any\)[\s\S]*<h2 id=\{id\}/);
    expect(viewer).toMatch(/h3\(\{ children, id \}: any\)[\s\S]*<h3 id=\{id\}/);
  });

  it('does not count with a render-scoped counter (memoised renderers never reset it)', () => {
    expect(viewer).not.toMatch(/let (figureCounter|headingCounter)\s*=\s*0/);
  });

  it('uses the reading-place hook with the Note revision, and the Return pill reads the store', () => {
    expect(viewer).toContain('contentRevision: note.updatedAt');
    expect(viewer).toContain('useReturnPoint(note.subjectId)');
    expect(viewer).toContain('Return to reading');
  });

  it('offers the outline as a popover, not a permanent column (ADR-0006)', () => {
    expect(viewer).toContain('<OnThisPage');
    const onThisPage = readFileSync(join(here, './OnThisPage.tsx'), 'utf8');
    expect(onThisPage).toContain("from '@base-ui/react/popover'");
    expect(onThisPage).toContain('modal={false}');
  });
});

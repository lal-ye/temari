/**
 * rehype plugin: number the Note's landmarks deterministically.
 *
 * - `h1`/`h2`/`h3` get `id="sec-N"` by document order. Index ids (rather
 *   than text slugs) survive duplicate headings and Amharic headings; the
 *   reading place's `contentRevision` guards against an edit moving them.
 * - Diagram code fences get `data-fig-index="N"` so figure captions number
 *   themselves without a counter in the renderer.
 *
 * Why a plugin and not a counter in the component renderers: the renderers
 * are memoised, so a `let counter = 0` declared in the component body is
 * captured once and never reset — every re-render (state change, StrictMode
 * double render) continued counting from where the last one stopped, which
 * produced `sec-6…sec-10` and "Fig. 3" for the first figure. The plugin runs
 * once per parse with fresh state, so ids are a pure function of the Markdown.
 */

/** The diagram fence languages `NoteViewer` renders as figures. */
export const FIGURE_LANGUAGES = ['diagram', 'mindmap', 'flow', 'stack', 'figure', 'mermaid'] as const;

// Minimal structural hast types, so this file does not depend on the
// transitive `@types/hast` package being hoisted.
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

export function rehypeNoteAnchors() {
  return (tree: HastNode) => {
    let heading = 0;
    let figure = 0;
    walk(tree, (node) => {
      if (node.type !== 'element') return;
      const tag = node.tagName;
      if (tag === 'h1' || tag === 'h2' || tag === 'h3') {
        heading += 1;
        node.properties = { ...node.properties, id: `sec-${heading}` };
        return;
      }
      if (tag === 'pre') {
        const code = node.children?.find((c) => c.type === 'element' && c.tagName === 'code');
        if (code && isFigureFence(code)) {
          figure += 1;
          code.properties = { ...code.properties, dataFigIndex: figure };
        }
      }
    });
  };
}

/** Which languages count as figures; exported for the renderer to share the same list. */
export function figureLanguage(className: unknown): string | null {
  const classes = Array.isArray(className) ? className.map(String) : typeof className === 'string' ? className.split(/\s+/) : [];
  for (const c of classes) {
    const m = /^language-(\w+)$/.exec(c);
    if (m && (FIGURE_LANGUAGES as readonly string[]).includes(m[1].toLowerCase())) return m[1].toLowerCase();
  }
  return null;
}

function isFigureFence(code: HastNode): boolean {
  return figureLanguage(code.properties?.className) !== null;
}

function walk(node: HastNode, visit: (n: HastNode) => void) {
  visit(node);
  node.children?.forEach((child) => walk(child, visit));
}

import type { Options as Schema } from 'rehype-sanitize';

/**
 * Sanitize parsed raw HTML BEFORE trusted KaTeX/diagram generation. No imported
 * SVG, CSS, images, forms or arbitrary attributes. This is rehype-sanitize's
 * schema, not a home-grown HTML parser.
 *
 * Precise semantics (verified against hast-util-sanitize 5.0.2 — see
 * M2-CHECKPOINT-B-PLAN.md §7.2 and the Phase 3 handoff §4):
 *
 * - `protocols` does not deny anything by itself. A URL attribute survives or
 *   dies with the per-tag `attributes` allowlist; `protocols` then only
 *   constrains values that carry a scheme. `protocols: { href: ['https'] }`
 *   therefore admits scheme-less values (`#sec-1`, `/app`) and
 *   protocol-relative ones (`//host`) — a colon appearing after `/`, `?` or
 *   `#` is not treated as a scheme separator. It is NOT an absolute-HTTPS
 *   validator: `isApprovedLink` (bridge.ts) is the single URL rule, applied at
 *   render time and again natively.
 * - Sanitization does NOT always preserve text. Elements listed in `strip`
 *   (forms, scripts, frames…) lose their entire contents; only unknown
 *   elements not in `strip` are unwrapped, keeping their children.
 * - The schema is shallow-merged over hast-util-sanitize's default
 *   (`{...defaultSchema, ...options}`), so the default `required` still
 *   applies: `{ input: { disabled: true, type: 'checkbox' } }` fills any
 *   surviving `input` that lacks `type` — turning an authored text input into
 *   a disabled checkbox instead of removing it. `rehypeTaskListInputs` runs
 *   BEFORE this schema and removes that ambiguity: only checkboxes ever reach
 *   it, already disabled. The fill-in then changes nothing.
 * - Authored `id`/`name` are not allowlisted, so they are dropped (not merely
 *   clobber-prefixed); heading ids are generated fresh by `rehypeNoteAnchors`
 *   after sanitization.
 */
export const readerSchema: Schema = {
  tagNames: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
    'ul', 'ol', 'li', 'strong', 'em', 'del', 's', 'sup', 'sub', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'div',
    // Task-list checkboxes only; every other input is removed by the
    // rehypeTaskListInputs pre-filter before this schema runs.
    'input',
  ],
  attributes: {
    code: [['className', /^language-[\w-]+$/, 'math-inline', 'math-display']],
    ol: ['start'],
    th: [['align', 'left', 'right', 'center']],
    td: [['align', 'left', 'right', 'center']],
    // href values are scheme-filtered to https: here (scheme-less values pass
    // — see above); the linkMode renderer applies isApprovedLink on top.
    a: ['href'],
    input: [['type', 'checkbox'], ['checked', true], ['disabled', true]],
  },
  protocols: { href: ['https'] },
  strip: [
    'script', 'style', 'iframe', 'object', 'embed', 'form', 'button',
    'textarea', 'select', 'svg', 'math', 'template',
  ],
  clobberPrefix: 'reader-',
};

/** Minimal structural hast types, so this file does not depend on the
 * transitive `@types/hast` package being hoisted. */
interface HastNode {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
}

/**
 * Input pre-filter, run BEFORE rehype-sanitize (plan §7.2).
 *
 * An attribute allowlist filters attribute VALUES, not elements: with `input`
 * allowlisted for checkboxes, hast-util-sanitize's default `required`
 * (`{ input: { disabled: true, type: 'checkbox' } }`) would surface an
 * authored `<input type="text">` or bare `<input name="credential">` as a
 * DISABLED CHECKBOX instead of removing it. So the decision is made here,
 * element by element:
 *
 * - `type="checkbox"` (any case) → keep, force `disabled` (keep `checked` if
 *   set) — task lists stay readable and can never submit anything.
 * - every other `<input>` → remove the element entirely, with its content.
 *
 * GFM task lists (`- [ ]` / `- [x]`) already arrive as disabled checkboxes
 * from remark-rehype; this filter is what makes the same guarantee hold for
 * raw authored HTML.
 */
export function rehypeTaskListInputs() {
  return (tree: HastNode) => {
    function visit(node: HastNode) {
      if (!Array.isArray(node.children)) return;
      const kept: HastNode[] = [];
      for (const child of node.children) {
        if (child.type === 'element' && child.tagName === 'input') {
          const type = String(child.properties?.type ?? '').toLowerCase();
          if (type !== 'checkbox') continue; // remove entirely, content included
          child.properties = { ...child.properties, type: 'checkbox', disabled: true };
        }
        visit(child);
        kept.push(child);
      }
      node.children = kept;
    }
    visit(tree);
  };
}

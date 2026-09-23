import type { Options as Schema } from 'rehype-sanitize';

/** Sanitize parsed raw HTML BEFORE trusted KaTeX/diagram generation. No imported
 * SVG, CSS, images, forms or arbitrary attributes. This is rehype-sanitize's
 * schema, not a home-grown HTML parser. Links are deliberately inert in the spike.
 */
export const readerSchema: Schema = {
  tagNames: [
    'p', 'br', 'hr', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote',
    'ul', 'ol', 'li', 'strong', 'em', 'del', 's', 'sup', 'sub', 'pre', 'code',
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'a', 'span', 'div',
  ],
  attributes: {
    code: [['className', /^language-[\w-]+$/, 'math-inline', 'math-display']],
    ol: ['start'],
    th: [['align', 'left', 'right', 'center']],
    td: [['align', 'left', 'right', 'center']],
  },
  protocols: {},
  strip: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'svg', 'math', 'template'],
  clobberPrefix: 'reader-',
};

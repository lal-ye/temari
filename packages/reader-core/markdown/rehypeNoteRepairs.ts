/** Narrow display-only repairs for known generated Markdown mistakes.
 * Work on parsed nodes, never global text replacements: code blocks, diagram
 * JSON, inline code and stored/exported source remain untouched.
 */
interface Node {
  type: string;
  tagName?: string;
  value?: string;
  children?: Node[];
  position?: { start: { offset?: number } };
}
const ALERT = /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s|$)/i;

export function rehypeNoteRepairs() {
  return (tree: Node, file: { value?: unknown }) => {
    const source = String(file.value ?? '');
    // Only repair entity-encoded quote prefixes, not intentional \> examples.
    const encodedQuoteText = (node: Node): Node | undefined => {
      const text = node.tagName === 'p' ? node.children?.[0] : undefined;
      const offset = text?.position?.start.offset;
      return text?.type === 'text' && /^>\s/.test(text.value ?? '') &&
        offset !== undefined && source.slice(offset).startsWith('&gt;') ? text : undefined;
    };
    const stripQuote = (text: Node) => {
      text.value = text.value!.replace(/^>\s?/, '').replace(/\n> ?/g, '\n');
    };
    function walk(node: Node) {
      if (node.tagName === 'pre' || node.tagName === 'code') return;
      if (/^h[1-6]$/.test(node.tagName ?? '')) {
        const first = node.children?.[0];
        const hashes = '#'.repeat(Number(node.tagName![1]));
        const offset = first?.position?.start.offset;
        // Remove one duplicate of this heading's own level, not arbitrary # text.
        if (first?.type === 'text' && first.value?.startsWith(hashes + ' ') &&
          offset !== undefined && source.slice(offset).startsWith(hashes + ' ')) {
          first.value = first.value.slice(hashes.length + 1);
        }
      }
      const children = node.children;
      if (!children) return;
      for (let i = 0; i < children.length; i++) {
        const first = encodedQuoteText(children[i]);
        if (!first || !ALERT.test(first.value ?? '')) continue;
        const paragraphs = [children[i]];
        stripQuote(first);
        let end = i + 1;
        while (end < children.length) {
          let next = end;
          while (children[next]?.type === 'text' && !children[next].value?.trim()) next++;
          if (!children[next]) break;
          const text = encodedQuoteText(children[next]);
          if (!text || ALERT.test(text.value ?? '')) break;
          stripQuote(text);
          paragraphs.push(children[next]);
          end = next + 1;
        }
        children.splice(i, end - i, { type: 'element', tagName: 'blockquote', children: paragraphs });
      }
      children.forEach(walk);
    }
    walk(tree);
  };
}

/** Recognize GitHub-style alerts before React maps paragraphs to components.
 * Only a marker at the start of a quote's first paragraph is special. Code,
 * escaped markers, unknown tags, and markers later in a quote stay literal.
 */
interface HastNode {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
  position?: { start: { offset?: number } };
}

export function rehypeNoteCallouts() {
  return (tree: HastNode, file: { value?: unknown }) => {
    const source = String(file.value ?? '');
    function walk(node: HastNode) {
      if (node.type === 'element' && node.tagName === 'blockquote') {
        const first = node.children?.find(child => child.type !== 'text' || child.value?.trim());
        const text = first?.children?.[0];
        if (first?.tagName === 'p' && text?.type === 'text') {
          const match = text.value?.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+|$)/i);
          const offset = text.position?.start.offset;
          // An explicitly escaped marker is documentation, not an alert.
          const escaped = offset !== undefined && source[offset] === '\\';
          if (match && !escaped) {
            node.properties = { ...node.properties, dataCallout: match[1].toLowerCase() };
            text.value = text.value!.slice(match[0].length);
            if (!text.value) first.children!.shift();
            if (!first.children?.length) {
              node.children = node.children!.filter(child => child !== first);
            }
          }
        }
      }
      node.children?.forEach(walk);
    }
    walk(tree);
  };
}

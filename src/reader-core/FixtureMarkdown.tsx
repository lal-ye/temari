import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import { readerSchema } from './sanitize';
import { rehypeNoteRepairs } from './markdown/rehypeNoteRepairs';
import { rehypeNoteCallouts } from './markdown/rehypeNoteCallouts';
import { rehypeNoteAnchors, figureLanguage } from './markdown/rehypeNoteAnchors';
import { parseDiagramFence } from './diagrams/diagramDoc';
import { FigureRenderer } from './diagrams/FigureRenderer';

/** Asset-spike renderer, NOT yet the replacement for web NoteViewer.
 * Trusted diagram components generate SVG only after raw imported SVG is removed.
 * No note title, settings, persistence, network or native APIs are accepted here.
 */
export function FixtureMarkdown({ content }: { content: string }) {
  return <ReactMarkdown
    remarkPlugins={[remarkGfm, remarkMath]}
    rehypePlugins={[
      rehypeRaw, [rehypeSanitize, readerSchema], rehypeNoteRepairs,
      rehypeNoteCallouts, rehypeNoteAnchors,
      [rehypeKatex, { trust: false, maxExpand: 100, maxSize: 20 }],
    ]}
    components={{
      a: ({ children }) => <span className="reader-inert-link" title="Links disabled in asset spike">{children}</span>,
      // Render figures at the pre level, never a div/SVG nested in a paragraph.
      pre: ({ children, node }) => {
        const code = node?.children.find(child => child.type === 'element' && child.tagName === 'code');
        if (code?.type === 'element' && figureLanguage(code.properties.className)) {
          const source = code.children.map(child => child.type === 'text' ? child.value : '').join('');
          const parsed = parseDiagramFence(source);
          if (parsed.kind === 'doc' && parsed.doc) {
            const index = Number(code.properties.dataFigIndex);
            return <figure className="reader-figure">
              <div className="reader-overflow"><FigureRenderer doc={parsed.doc} figIndex={index} /></div>
              <figcaption>Fig. {index} · {parsed.doc.title}</figcaption>
            </figure>;
          }
          return <pre aria-label="Diagram source (unsupported in asset spike)">{source}</pre>;
        }
        return <pre>{children}</pre>;
      },
      blockquote: ({ children, node }) => {
        const kind = node?.properties.dataCallout;
        return <blockquote data-callout={typeof kind === 'string' ? kind : undefined}>
          {typeof kind === 'string' && <strong className="reader-callout-label">{kind}</strong>}
          {children}
        </blockquote>;
      },
      table: ({ children }) => <div className="reader-overflow" role="region" aria-label="Scrollable table" tabIndex={0}><table>{children}</table></div>,
    }}
  >{content}</ReactMarkdown>;
}

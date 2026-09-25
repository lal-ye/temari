import React, { createContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import { Info, AlertTriangle, Lightbulb } from 'lucide-react';
import { rehypeNoteCallouts } from './markdown/rehypeNoteCallouts';
import { rehypeNoteRepairs } from './markdown/rehypeNoteRepairs';
import { figureLanguage, rehypeNoteAnchors } from './markdown/rehypeNoteAnchors';
import { FigureBlock } from './diagrams/FigureBlock';

/**
 * The shared content renderer (checkpoint B extraction). One Markdown
 * pipeline and one components map for every host; presentation varies through
 * the `NoteSkin` token maps (`web` reproduces the web app's classes and callout
 * icons exactly, `reader` is the reader-lab skin). CSS is imported by each
 * host. KaTeX runs trusted (`trust: false`) AFTER raw HTML passes the shared
 * display repairs. Sanitization/link policy converge here in Phase 3 of the
 * checkpoint B plan; until then this pipeline is the web pipeline, moved
 * verbatim so behavior diffs stay attributable.
 */
export interface NoteContentProps {
  /** `note.content` raw — citation normalization happens inside, in one place. */
  content: string;
  /** Figure captions and legacy fallbacks only; never a settings object. */
  noteTitle?: string;
  /**
   * Term hits (diagram nodes today). The element is host-side UI (the web
   * explainer's morph origin) and must not cross a native bridge — native
   * callers drop it when building `ExplainRequest`.
   */
  onTermActivate?: (term: string, context: string, element?: HTMLElement | SVGElement) => void;
  /** Host's pre-JSON diagram renderer; absent ⇒ labelled source fallback. */
  legacyFigure?: React.ComponentType<{ content: string; title?: string; figIndex?: number }>;
  skin: 'web' | 'reader';
}

interface CalloutTokens {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  border: string;
  bg: string;
  text: string;
  badge: string;
}

interface NoteSkin {
  calloutWrap: string;
  calloutBadge: string;
  calloutIcon: string;
  calloutBody: string;
  callouts: Record<'note' | 'important' | 'tip' | 'warning' | 'caution', CalloutTokens>;
  quote: string;
  figureWrap: string;
  pre: string;
  inlineCode: string;
  tableWrap: string;
  table: string;
  thead: string;
  th: string;
  tr: string;
  td: string;
  h1: string;
  h2: string;
  h2Dot: string | null;
  h2Text: string;
  h3: string;
  p: string;
  ul: string;
  ol: string;
  li: string;
  strong: string;
  a: string;
  hr: string;
}

const ALERT_TYPES = ['NOTE', 'IMPORTANT', 'TIP', 'WARNING', 'CAUTION'] as const;

/** Web app skin: the class strings `NoteViewer` rendered before the extraction. */
const webSkin: NoteSkin = {
  calloutWrap: 'note-callout p-4 my-4 rounded-r-xl border text-sm',
  calloutBadge: 'flex items-center gap-1.5 text-xs uppercase tracking-wider mb-2',
  calloutIcon: 'w-4 h-4 shrink-0',
  calloutBody: 'space-y-2',
  callouts: {
    note: {
      label: 'Note',
      icon: Info,
      border: 'border-l-4 border-blue-500',
      bg: 'bg-blue-50/60 dark:bg-blue-950/25',
      text: 'text-slate-900 dark:text-slate-100',
      badge: 'text-blue-700 dark:text-blue-300 font-semibold',
    },
    important: {
      label: 'Important',
      icon: AlertTriangle,
      border: 'border-l-4 border-rose-500',
      bg: 'bg-rose-50/60 dark:bg-rose-950/25',
      text: 'text-slate-900 dark:text-slate-100',
      badge: 'text-rose-700 dark:text-rose-300 font-semibold',
    },
    tip: {
      label: 'Helpful Tip',
      icon: Lightbulb,
      border: 'border-l-4 border-emerald-500',
      bg: 'bg-emerald-50/60 dark:bg-emerald-950/25',
      text: 'text-slate-900 dark:text-slate-100',
      badge: 'text-emerald-700 dark:text-emerald-300 font-semibold',
    },
    warning: {
      label: 'Warning',
      icon: AlertTriangle,
      border: 'border-l-4 border-amber-500',
      bg: 'bg-amber-50/60 dark:bg-amber-950/25',
      text: 'text-slate-900 dark:text-slate-100',
      badge: 'text-amber-700 dark:text-amber-300 font-semibold',
    },
    caution: {
      label: 'Caution',
      icon: AlertTriangle,
      border: 'border-l-4 border-red-500',
      bg: 'bg-red-50/60 dark:bg-red-950/25',
      text: 'text-slate-900 dark:text-slate-100',
      badge: 'text-red-700 dark:text-red-300 font-semibold',
    },
  },
  quote: 'border-l-4 border-muted-foreground/30 pl-4 py-1 my-4 italic text-muted-foreground',
  figureWrap: 'note-figure my-6 not-prose',
  pre: 'note-codeblock my-4 p-4 rounded-xl bg-zinc-900 text-zinc-100 overflow-x-auto font-mono text-xs leading-relaxed dark:bg-zinc-950 border border-border',
  inlineCode: 'px-1.5 py-0.5 rounded-md bg-muted font-mono text-[13px] text-foreground font-medium',
  tableWrap: 'my-6 overflow-x-auto rounded-xl border border-border bg-card shadow-xs',
  table: 'w-full text-left text-sm border-collapse',
  thead: 'bg-muted/60 text-foreground font-semibold border-b border-border',
  th: 'p-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/40 last:border-r-0',
  tr: 'border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors',
  td: 'p-3.5 text-sm text-foreground/90 border-r border-border/40 last:border-r-0 leading-normal',
  h1: 'font-editorial text-2xl md:text-3xl font-bold text-foreground mt-8 mb-4 pb-2.5 border-b border-border tracking-tight leading-tight scroll-mt-3',
  h2: 'font-editorial text-xl md:text-2xl font-bold text-foreground mt-7 mb-3.5 flex items-center gap-2.5 tracking-tight leading-snug scroll-mt-3',
  h2Dot: 'w-2 h-2 rounded-full bg-amber-500 shrink-0',
  h2Text: 'min-w-0 break-words',
  h3: 'font-editorial text-lg md:text-xl font-semibold text-foreground/90 mt-5 mb-2.5 tracking-tight scroll-mt-3',
  p: 'text-foreground/90 leading-relaxed my-3.5 text-[15px] font-normal',
  ul: 'list-disc pl-6 my-3.5 space-y-1.5 text-foreground/90 text-[15px]',
  ol: 'list-decimal pl-6 my-3.5 space-y-1.5 text-foreground/90 text-[15px]',
  li: 'leading-relaxed pl-1',
  strong: 'font-semibold text-foreground bg-amber-50/80 dark:bg-amber-950/40 px-1 py-0.5 rounded',
  a: 'text-amber-600 dark:text-amber-400 font-medium underline underline-offset-4 hover:opacity-80 transition-opacity',
  hr: 'my-8 border-border',
};

/** Reader-lab skin: same structure, reader.css classes, no icons (D1). */
const readerSkin: NoteSkin = {
  calloutWrap: 'reader-callout',
  calloutBadge: 'reader-callout-label',
  calloutIcon: '',
  calloutBody: '',
  callouts: {
    note: { label: 'Note', border: '', bg: '', text: '', badge: '' },
    important: { label: 'Important', border: '', bg: '', text: '', badge: '' },
    tip: { label: 'Helpful Tip', border: '', bg: '', text: '', badge: '' },
    warning: { label: 'Warning', border: '', bg: '', text: '', badge: '' },
    caution: { label: 'Caution', border: '', bg: '', text: '', badge: '' },
  },
  quote: 'reader-quote',
  figureWrap: 'reader-figure-wrap',
  pre: 'reader-pre',
  inlineCode: 'reader-inline-code',
  tableWrap: 'reader-overflow',
  table: 'reader-table',
  thead: '',
  th: '',
  tr: '',
  td: '',
  h1: '',
  h2: '',
  h2Dot: null,
  h2Text: '',
  h3: '',
  p: '',
  ul: '',
  ol: '',
  li: '',
  strong: '',
  a: 'reader-link',
  hr: '',
};

const skins = { web: webSkin, reader: readerSkin };

const InPreContext = createContext(false);

function buildComponents(
  skin: NoteSkin,
  noteTitle: string | undefined,
  onTermActivate: NoteContentProps['onTermActivate'],
  legacyFigure: NoteContentProps['legacyFigure'],
) {
  return {
    blockquote: function CalloutBlockquote({ children, node }: any) {
      const callout = node?.properties?.dataCallout;
      const alertType = typeof callout === 'string' ? callout.toUpperCase() : '';
      if ((ALERT_TYPES as readonly string[]).includes(alertType)) {
        const kind = alertType.toLowerCase() as keyof NoteSkin['callouts'];
        const current = skin.callouts[kind] ?? skin.callouts.note;
        const IconComponent = current.icon;
        return (
          <div
            data-callout={kind}
            className={`${skin.calloutWrap} ${current.border} ${current.bg} ${current.text}`}
          >
            <div className={`${skin.calloutBadge} ${current.badge}`}>
              {IconComponent && <IconComponent className={skin.calloutIcon} />}
              <span>{current.label}</span>
            </div>
            <div className={skin.calloutBody}>{children}</div>
          </div>
        );
      }
      return (
        <blockquote className={skin.quote}>
          {children}
        </blockquote>
      );
    },
    pre({ node, children, ...props }: any) {
      const codeNode = node?.children?.find((c: any) => c?.tagName === 'code');
      const classNames = codeNode?.properties?.className;
      const cls = Array.isArray(classNames) ? classNames.join(' ') : classNames || '';
      const lang = figureLanguage(cls);
      if (lang) {
        return <InPreContext.Provider value={true}>{children}</InPreContext.Provider>;
      }
      return (
        <InPreContext.Provider value={true}>
          <pre className={skin.pre} {...props}>
            {children}
          </pre>
        </InPreContext.Provider>
      );
    },
    code({ node, className, children, ...props }: any) {
      return (
        <InPreContext.Consumer>
          {(inPre) => {
            const lang = figureLanguage(className);

            // Intercept programmatic diagram blocks and render the shared figure.
            if (inPre && lang) {
              const figIndex = Number((props as Record<string, unknown>)['data-fig-index']);
              return (
                <div className={skin.figureWrap}>
                  <FigureBlock
                    source={String(children).trim()}
                    title={noteTitle}
                    figIndex={Number.isFinite(figIndex) && figIndex > 0 ? figIndex : undefined}
                    onNodeActivate={onTermActivate}
                    legacyFigure={legacyFigure}
                  />
                </div>
              );
            }

            if (inPre) {
              return (
                <code className={className} {...props}>
                  {children}
                </code>
              );
            }

            return (
              <code className={skin.inlineCode} {...props}>
                {children}
              </code>
            );
          }}
        </InPreContext.Consumer>
      );
    },
    table({ children }: any) {
      return (
        <div className={skin.tableWrap}>
          <table className={skin.table}>{children}</table>
        </div>
      );
    },
    thead({ children }: any) {
      return <thead className={skin.thead}>{children}</thead>;
    },
    th({ children }: any) {
      return <th className={skin.th}>{children}</th>;
    },
    tr({ children }: any) {
      return <tr className={skin.tr}>{children}</tr>;
    },
    td({ children }: any) {
      return <td className={skin.td}>{children}</td>;
    },
    h1({ children, id }: any) {
      return (
        <h1 id={id} className={skin.h1}>
          {children}
        </h1>
      );
    },
    h2({ children, id }: any) {
      return (
        <h2 id={id} className={skin.h2}>
          {skin.h2Dot && <span aria-hidden="true" className={skin.h2Dot} />}
          <span className={skin.h2Text}>{children}</span>
        </h2>
      );
    },
    h3({ children, id }: any) {
      return (
        <h3 id={id} className={skin.h3}>
          {children}
        </h3>
      );
    },
    p({ children }: any) {
      return <p className={skin.p}>{children}</p>;
    },
    ul({ children }: any) {
      return <ul className={skin.ul}>{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className={skin.ol}>{children}</ol>;
    },
    li({ children }: any) {
      return <li className={skin.li}>{children}</li>;
    },
    strong({ children }: any) {
      return <strong className={skin.strong}>{children}</strong>;
    },
    a({ href, children }: any) {
      return (
        <a href={href} target="_blank" rel="noopener noreferrer" className={skin.a}>
          {children}
        </a>
      );
    },
    hr() {
      return <hr className={skin.hr} />;
    },
  };
}

export const NoteContent: React.FC<NoteContentProps> = React.memo(function NoteContent({
  content,
  noteTitle,
  onTermActivate,
  legacyFigure,
  skin,
}) {
  // Citation normalization, in one place (display-only; stored source is never
  // rewritten): [[1]] -> <sup>[[1]</sup> when wrapped in the citation span.
  const normalized = useMemo(() => {
    if (!content) return '';
    return content.replace(/<span class="citation">\[\[(\d+)\]\]<\/span>/g, '<sup>[$1]</sup>');
  }, [content]);

  const components = useMemo(
    () => buildComponents(skins[skin] ?? webSkin, noteTitle, onTermActivate, legacyFigure),
    [skin, noteTitle, onTermActivate, legacyFigure],
  );

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeRaw, rehypeNoteRepairs, rehypeNoteCallouts, rehypeKatex, rehypeNoteAnchors]}
      components={components}
    >
      {normalized}
    </ReactMarkdown>
  );
});

import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

import { StoredNote } from '../../types';
import { takeReturnPoint, useReturnPoint } from '../../services/readingPlace';
import {
  Copy,
  Check,
  Printer,
  Download,
  Sparkles,
  Tag,
  BookOpen,
  Clock,
  Edit3,
  Info,
  AlertTriangle,
  Lightbulb,
  CornerLeftUp,
  X,
} from 'lucide-react';
import { EditorialDiagram } from '../diagrams/EditorialDiagram';
import { pointOrigin, type MorphOrigin } from '../ui/Modal';
import { contextWindow, termAtOffset } from '../../utils/segmentTerm';
import { useReadingPlace } from './useReadingPlace';
import { OnThisPage } from './OnThisPage';
import { figureLanguage, rehypeNoteAnchors } from './rehypeNoteAnchors';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from '../ui/toast';

interface NoteViewerProps {
  note: StoredNote;
  /** Active Subject name, shown in the print masthead only. */
  subjectName?: string;
  onEdit?: () => void;
  onHighlightTerm?: (term: string, context?: string, origin?: MorphOrigin) => void;
}

/** What the long-press recognised: the term, its context, and where it is on screen. */
interface RecognisedTerm {
  term: string;
  context: string;
  /** Client rects of the term's text range, for the highlight. */
  rects: DOMRect[];
}

/**
 * Resolves the word under a screen point to a text range, using
 * `caretPositionFromPoint` (WebKit's `caretRangeFromPoint` as a fallback)
 * and the Unicode-aware segmenter in `utils/segmentTerm`. Returns the
 * term's client rects so the UI can show *which* text was recognised — the
 * word is under the learner's finger for the whole press, so without this
 * they are guessing (docs/ui-plan-truthful-interaction.md §3).
 */
function recogniseTermAtPoint(x: number, y: number, within: HTMLElement | null): RecognisedTerm | null {
  if (typeof document === 'undefined') return null;

  let node: Node | null = null;
  let offset = 0;
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => Range | null;
  };
  if (typeof doc.caretPositionFromPoint === 'function') {
    const pos = doc.caretPositionFromPoint(x, y);
    if (pos) {
      node = pos.offsetNode;
      offset = pos.offset;
    }
  } else if (typeof doc.caretRangeFromPoint === 'function') {
    const r = doc.caretRangeFromPoint(x, y);
    if (r) {
      node = r.startContainer;
      offset = r.startOffset;
    }
  }

  if (!node || node.nodeType !== Node.TEXT_NODE) return null;
  if (within && !within.contains(node)) return null;
  // Not inside code or maths: those are not "terms" in the learner's sense.
  const parentEl = node.parentElement;
  if (parentEl?.closest('pre, code, .katex, svg')) return null;

  const text = node.textContent ?? '';
  const found = termAtOffset(text, offset);
  if (!found) return null;

  // The highlight is a bonus; the term is the point. Never let a missing
  // rect API stop recognition.
  let rects: DOMRect[] = [];
  try {
    const range = document.createRange();
    range.setStart(node, found.start);
    range.setEnd(node, found.end);
    rects = typeof range.getClientRects === 'function' ? Array.from(range.getClientRects()) : [];
  } catch {
    rects = [];
  }

  // Context: the enclosing block's text, windowed around the term.
  const block = parentEl?.closest('p, li, td, th, h1, h2, h3, h4, h5, h6, blockquote, dd, dt, figcaption') ?? parentEl;
  const blockText = block?.textContent ?? text;
  const idxInBlock = blockText.indexOf(found.term);
  const context =
    idxInBlock >= 0 ? contextWindow(blockText, idxInBlock, idxInBlock + found.term.length) : found.context;

  return { term: found.term, context, rects };
}

/**
 * Callout alert component for GitHub-style markdown alerts
 */
function CalloutBlockquote({ children }: { children: React.ReactNode }) {
  const childArray = React.Children.toArray(children);
  const firstChild = childArray[0];

  if (React.isValidElement(firstChild) && firstChild.type === 'p') {
    const pChildren = React.Children.toArray((firstChild.props as any).children);
    const firstText = typeof pChildren[0] === 'string' ? pChildren[0] : '';
    const match = firstText.match(/^\[!(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\]\s*/i);

    if (match) {
      const alertType = match[1].toUpperCase();
      const remainingFirst = firstText.slice(match[0].length);
      const newPChildren = remainingFirst ? [remainingFirst, ...pChildren.slice(1)] : pChildren.slice(1);
      const newFirstChild = React.cloneElement(firstChild, {}, ...newPChildren);
      const restChildren = [newFirstChild, ...childArray.slice(1)];

      const alertMap: Record<
        string,
        {
          label: string;
          icon: React.ComponentType<{ className?: string }>;
          border: string;
          bg: string;
          text: string;
          badge: string;
        }
      > = {
        NOTE: {
          label: 'Note',
          icon: Info,
          border: 'border-l-4 border-blue-500',
          bg: 'bg-blue-50/60 dark:bg-blue-950/25',
          text: 'text-slate-900 dark:text-slate-100',
          badge: 'text-blue-700 dark:text-blue-300 font-semibold',
        },
        IMPORTANT: {
          label: 'Important',
          icon: AlertTriangle,
          border: 'border-l-4 border-rose-500',
          bg: 'bg-rose-50/60 dark:bg-rose-950/25',
          text: 'text-slate-900 dark:text-slate-100',
          badge: 'text-rose-700 dark:text-rose-300 font-semibold',
        },
        TIP: {
          label: 'Helpful Tip',
          icon: Lightbulb,
          border: 'border-l-4 border-emerald-500',
          bg: 'bg-emerald-50/60 dark:bg-emerald-950/25',
          text: 'text-slate-900 dark:text-slate-100',
          badge: 'text-emerald-700 dark:text-emerald-300 font-semibold',
        },
        WARNING: {
          label: 'Warning',
          icon: AlertTriangle,
          border: 'border-l-4 border-amber-500',
          bg: 'bg-amber-50/60 dark:bg-amber-950/25',
          text: 'text-slate-900 dark:text-slate-100',
          badge: 'text-amber-700 dark:text-amber-300 font-semibold',
        },
        CAUTION: {
          label: 'Caution',
          icon: AlertTriangle,
          border: 'border-l-4 border-red-500',
          bg: 'bg-red-50/60 dark:bg-red-950/25',
          text: 'text-slate-900 dark:text-slate-100',
          badge: 'text-red-700 dark:text-red-300 font-semibold',
        },
      };

      const current = alertMap[alertType] || alertMap.NOTE;
      const IconComponent = current.icon;

      return (
        <div
          data-callout={alertType.toLowerCase()}
          className={`note-callout p-4 my-4 rounded-r-xl border border-l-0 ${current.border} ${current.bg} ${current.text} text-sm`}
        >
          <div className={`flex items-center gap-1.5 text-xs uppercase tracking-wider mb-2 ${current.badge}`}>
            <IconComponent className="w-4 h-4 shrink-0" />
            <span>{current.label}</span>
          </div>
          <div className="space-y-2">{restChildren}</div>
        </div>
      );
    }
  }

  return (
    <blockquote className="border-l-4 border-muted-foreground/30 pl-4 py-1 my-4 italic text-muted-foreground">
      {children}
    </blockquote>
  );
}

export const NoteViewer: React.FC<NoteViewerProps> = ({
  note,
  subjectName,
  onEdit,
  onHighlightTerm,
}) => {
  const [copied, setCopied] = useState(false);
  /**
   * The candidate term awaiting the learner's Explain. Both paths — mouse
   * selection and long-press — end here; generation starts only when the
   * Explain button is pressed. One path, one behaviour.
   */
  const [candidate, setCandidate] = useState<{
    term: string;
    context: string;
    /** Screen origin for the explainer's morph (the pressed word or the button). */
    origin: MorphOrigin | null;
    /** Highlight rects for a long-pressed term (a mouse selection paints itself). */
    rects: DOMRect[];
  } | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // Long-press (touch): acknowledgment ring at the contact point, plus a chip
  // above the finger naming the term as it is recognised — the touch-content
  // proxy. The ring is acknowledgment only; it is gated to touch because a
  // mouse click already knows where it landed.
  const [press, setPress] = useState<{ x: number; y: number; ring: boolean } | null>(null);
  const [preview, setPreview] = useState<RecognisedTerm | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);

  const clearPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
    pressRef.current = null;
    setPress(null);
    setPreview(null);
  };

  // Note change or unmount: no stale timer may fire into the next Note.
  useEffect(() => {
    setCandidate(null);
    return clearPress;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Heading ids (`sec-N`) and figure numbers come from `rehypeNoteAnchors`,
  // which runs once per parse. (A counter here would be captured by the
  // memoised renderers below and never reset between re-renders.)

  // Clean note content for citations and HTML tags
  const processedContent = useMemo(() => {
    if (!note.content) return '';
    // Normalize citation references [[1]] -> <sup>[[1]]</sup>
    return note.content.replace(/<span class="citation">\[\[(\d+)\]\]<\/span>/g, '<sup>[$1]</sup>');
  }, [note.content]);

  /** Mouse path: a text selection proposes itself as the candidate. */
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text && text.length > 1 && text.length < 60) {
      const blockText = selection.anchorNode?.parentElement?.textContent || text;
      const idx = blockText.indexOf(text);
      setCandidate({
        term: text,
        context: idx >= 0 ? contextWindow(blockText, idx, idx + text.length) : blockText.slice(0, 240),
        origin: null,
        rects: [],
      });
    } else if (!pressRef.current) {
      setCandidate(null);
    }
  };

  /**
   * Touch path: a 300ms press recognises the word under the finger. While
   * the press is held the chip shows the candidate; on release the same
   * Explain tooltip the mouse path uses appears, and nothing is generated
   * until the learner presses Explain (§3: explicit action before
   * generation). Slop is 8px — a scroll is not a press.
   */
  const LONG_PRESS_MS = 300;
  const PRESS_SLOP_PX = 8;

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || !e.isPrimary) return;
    // One press at a time; a second finger does not restart the timer.
    if (pressRef.current) return;
    // Mouse users select text; the long-press is a touch (and pen) affordance.
    if (e.pointerType === 'mouse') return;

    pressRef.current = { pointerId: e.pointerId, x: e.clientX, y: e.clientY };
    setPress({ x: e.clientX, y: e.clientY, ring: e.pointerType === 'touch' });

    pressTimerRef.current = setTimeout(() => {
      const held = pressRef.current;
      pressTimerRef.current = null;
      if (!held) return;
      const found = recogniseTermAtPoint(held.x, held.y, contentRef.current);
      if (found) {
        setPreview(found);
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
          navigator.vibrate(25);
        }
      } else {
        clearPress();
      }
    }, LONG_PRESS_MS);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    const held = pressRef.current;
    if (!held || e.pointerId !== held.pointerId) return;
    if (Math.hypot(e.clientX - held.x, e.clientY - held.y) > PRESS_SLOP_PX) {
      // The finger moved: this is a scroll or a selection, not a press.
      clearPress();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const held = pressRef.current;
    if (!held || e.pointerId !== held.pointerId) return;
    const recognised = preview;
    clearPress();
    if (recognised) {
      // Hand over to the shared confirmation; the explainer will morph from
      // the pressed word.
      setCandidate({
        term: recognised.term,
        context: recognised.context,
        origin: pointOrigin(held.x, held.y),
        rects: recognised.rects,
      });
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    const held = pressRef.current;
    if (!held || e.pointerId !== held.pointerId) return;
    clearPress();
  };

  const copyToClipboard = () => {
    navigator.clipboard
      .writeText(note.content)
      .then(() => toast.success('Note copied to clipboard.'))
      .catch(() => toast.error('Could not copy — select the text manually.'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Download the note's source Markdown. Works offline and on Netlify: it
  // builds a Blob on the learner's device and triggers a download, with no
  // server round-trip (the print stylesheet handles the PDF/Paper route).
  const downloadMarkdown = () => {
    const stamp = new Date(note.createdAt).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
    const header = [
      `# ${note.title}`,
      '',
      subjectName ? `> Subject: ${subjectName}` : null,
      note.sourceName ? `> Source: ${note.sourceName}` : null,
      `> ${stamp}`,
      note.tags && note.tags.length ? `> Tags: ${note.tags.join(', ')}` : null,
      '',
      '---',
      '',
    ]
      .filter((line) => line !== null)
      .join('\n');

    const blob = new Blob([header + note.content], {
      type: 'text/markdown;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeTitle = note.title.replace(/[^a-z0-9\-_.]+/gi, '-').replace(/^-+|-+$/g, '') || 'note';
    a.href = url;
    a.download = `${safeTitle}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    toast.success('Markdown source downloaded.');
  };

  const handlePrint = () => {
    window.print();
  };

  const createdLabel = new Date(note.createdAt).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Markdown component mappings
  const markdownComponents = useMemo(() => ({
    blockquote: CalloutBlockquote,
    code({ node, inline, className, children, ...props }: any) {
      const lang = figureLanguage(className);

      // Intercept programmatic diagram blocks and render EditorialDiagram
      if (!inline && lang) {
        const figIndex = Number((props as Record<string, unknown>)['data-fig-index']);
        return (
          <div className="note-figure my-6 not-prose">
            <EditorialDiagram
              content={String(children).trim()}
              title={note.title}
              figIndex={Number.isFinite(figIndex) && figIndex > 0 ? figIndex : undefined}
              onNodeActivate={(label, context, el) => {
                if (onHighlightTerm) {
                  onHighlightTerm(label, context, el as HTMLElement);
                }
              }}
            />
          </div>
        );
      }

      if (inline) {
        return (
          <code
            className="px-1.5 py-0.5 rounded-md bg-muted font-mono text-[13px] text-foreground font-medium"
            {...props}
          >
            {children}
          </code>
        );
      }

      return (
        <pre className="note-codeblock my-4 p-4 rounded-xl bg-zinc-900 text-zinc-100 overflow-x-auto font-mono text-xs leading-relaxed dark:bg-zinc-950 border border-border">
          <code className={className} {...props}>
            {children}
          </code>
        </pre>
      );
    },
    table({ children }: any) {
      return (
        <div className="my-6 overflow-x-auto rounded-xl border border-border bg-card shadow-xs">
          <table className="w-full text-left text-sm border-collapse">{children}</table>
        </div>
      );
    },
    thead({ children }: any) {
      return <thead className="bg-muted/60 text-foreground font-semibold border-b border-border">{children}</thead>;
    },
    th({ children }: any) {
      return <th className="p-3.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground border-r border-border/40 last:border-r-0">{children}</th>;
    },
    tr({ children }: any) {
      return <tr className="border-b border-border/40 last:border-b-0 hover:bg-muted/30 transition-colors">{children}</tr>;
    },
    td({ children }: any) {
      return <td className="p-3.5 text-sm text-foreground/90 border-r border-border/40 last:border-r-0 leading-normal">{children}</td>;
    },
    h1({ children, id }: any) {
      return (
        <h1 id={id} className="font-editorial text-2xl md:text-3xl font-bold text-foreground mt-8 mb-4 pb-2.5 border-b border-border tracking-tight leading-tight scroll-mt-3">
          {children}
        </h1>
      );
    },
    h2({ children, id }: any) {
      return (
        <h2 id={id} className="font-editorial text-xl md:text-2xl font-bold text-foreground mt-7 mb-3.5 flex items-center gap-2.5 tracking-tight leading-snug scroll-mt-3">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          {children}
        </h2>
      );
    },
    h3({ children, id }: any) {
      return (
        <h3 id={id} className="font-editorial text-lg md:text-xl font-semibold text-foreground/90 mt-5 mb-2.5 tracking-tight scroll-mt-3">
          {children}
        </h3>
      );
    },
    p({ children }: any) {
      return <p className="text-foreground/90 leading-relaxed my-3.5 text-[15px] font-normal">{children}</p>;
    },
    ul({ children }: any) {
      return <ul className="list-disc pl-6 my-3.5 space-y-1.5 text-foreground/90 text-[15px]">{children}</ul>;
    },
    ol({ children }: any) {
      return <ol className="list-decimal pl-6 my-3.5 space-y-1.5 text-foreground/90 text-[15px]">{children}</ol>;
    },
    li({ children }: any) {
      return <li className="leading-relaxed pl-1">{children}</li>;
    },
    strong({ children }: any) {
      return <strong className="font-semibold text-foreground bg-amber-50/80 dark:bg-amber-950/40 px-1 py-0.5 rounded">{children}</strong>;
    },
    a({ href, children }: any) {
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-amber-600 dark:text-amber-400 font-medium underline underline-offset-4 hover:opacity-80 transition-opacity"
        >
          {children}
        </a>
      );
    },
    hr() {
      return <hr className="my-8 border-border" />;
    },
  }), [note.title, onHighlightTerm]);

  // Reading continuity: remember where the learner is in this Note and put
  // them back there after a hub switch or reload; let them return after an
  // outline jump.
  const { headings, jumpTo, returnToReading } = useReadingPlace({
    subjectId: note.subjectId,
    noteId: note.id,
    contentRevision: note.updatedAt,
    contentRef,
  });
  const returnPoint = useReturnPoint(note.subjectId);
  const returnLabel =
    returnPoint && returnPoint.noteId === note.id
      ? headings.find((h) => h.id === returnPoint.anchorId)?.text ?? null
      : null;

  return (
    <div
      className="note-print-root bg-card border border-border/80 rounded-2xl shadow-xs overflow-hidden flex flex-col relative select-text"
    >
      {/* Print-only masthead (page one). Hidden on screen via the base
          .print-only rule; revealed under @media print in index.css. */}
      <header className="print-only note-print-masthead">
        <div className="note-masthead-brand">
          <span className="font-ethiopic">ተማሪ</span>
          <span>Temari Study Note</span>
        </div>
        <h1>{note.title}</h1>
        <div className="note-masthead-meta">
          {subjectName && <span>{subjectName}</span>}
          {note.sourceName && <span>Source: {note.sourceName}</span>}
          <span>{createdLabel}</span>
          {note.tags && note.tags.length > 0 && <span>{note.tags.join(' · ')}</span>}
        </div>
      </header>

      {/* Long-press acknowledgment: ring at the contact point (touch only). */}
      {press?.ring && !preview && (
        <div className="pulse-ring-indicator" style={{ left: `${press.x}px`, top: `${press.y}px` }} />
      )}

      {/* Touch-content proxy: the recognised term, shown above the finger, and
          its actual text range highlighted. Purely presentational. */}
      {press && preview && (
        <>
          {preview.rects.map((r, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="term-range-highlight"
              style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
            />
          ))}
          <div
            role="status"
            className="term-proxy-chip"
            style={{ left: `${press.x}px`, top: `${press.y}px` }}
          >
            <span className="font-semibold">{preview.term}</span>
            <span className="text-[10px] font-medium opacity-80">release to explain</span>
          </div>
        </>
      )}

      {/* Top Action Bar */}
      <div className="p-4 bg-card border-b border-border flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-lg border border-amber-500/20">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">{note.title}</h2>
            <div className="flex items-center gap-2.5 text-xs text-muted-foreground mt-0.5">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(note.createdAt).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
              {note.sourceName && (
                <span className="px-1.5 py-0.5 bg-muted text-muted-foreground rounded text-[11px] font-mono">
                  {note.sourceName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {headings.length >= 2 && <OnThisPage headings={headings} onJump={jumpTo} />}

          {onEdit && (
            <Button
              onClick={onEdit}
              variant="outline"
              size="sm"
              className="gap-1.5"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </Button>
          )}

          <Button
            onClick={copyToClipboard}
            variant="outline"
            size="sm"
            className="gap-1.5"
            title="Copy Note Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </Button>

          <Button
            onClick={downloadMarkdown}
            variant="outline"
            size="sm"
            className="gap-1.5"
            title="Download Markdown source"
          >
            <Download className="w-3.5 h-3.5" />
            <span>.md</span>
          </Button>

          <Button
            onClick={handlePrint}
            variant="default"
            size="sm"
            className="gap-1.5"
            title="Print or Export PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / PDF</span>
          </Button>
        </div>
      </div>

      {/* Explain confirmation — the single path for selection and long-press.
          Generation starts only here. */}
      {candidate && (
        <>
          {candidate.rects.map((r, i) => (
            <div
              key={i}
              aria-hidden="true"
              className="term-range-highlight"
              style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
            />
          ))}
          <div className="sticky top-3 z-30 mx-auto -mb-8 w-fit max-w-[calc(100%-2rem)] bg-zinc-900 text-zinc-100 px-4 py-2 rounded-xl border border-zinc-700 shadow-lg flex items-center gap-3 animate-in zoom-in-95 duration-150 no-print">
            <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs font-medium truncate">
              Explain &ldquo;<strong className="text-amber-300 font-semibold">{candidate.term}</strong>&rdquo; with{' '}
              <span className="font-ethiopic font-bold text-amber-400 text-sm">ተማሪ</span> AI?
            </span>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => setCandidate(null)}
              className="text-zinc-300 hover:text-zinc-100 hover:bg-zinc-800 text-xs"
              aria-label="Dismiss"
            >
              Not now
            </Button>
            <Button
              size="xs"
              variant="default"
              onClick={(e) => {
                if (onHighlightTerm) onHighlightTerm(candidate.term, candidate.context, candidate.origin ?? e.currentTarget);
                setCandidate(null);
              }}
              className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs"
            >
              Explain
            </Button>
          </div>
        </>
      )}

      {/* Return to reading — the departure point saved before an outline
          jump. Persistent until used or until the Note changes; not a timed
          toast (§5). */}
      {returnPoint && returnPoint.noteId === note.id && (
        <div className="sticky top-3 z-20 mx-auto -mb-8 w-fit max-w-[calc(100%-2rem)] flex items-center gap-1 pl-3 pr-1 py-1 bg-card border border-border rounded-full shadow-md text-xs font-medium text-foreground animate-in fade-in-0 slide-in-from-top-1 duration-150 no-print">
          <button
            type="button"
            onClick={returnToReading}
            className="flex items-center gap-1.5 py-0.5 rounded-full outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <CornerLeftUp className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>
              Return to reading
              {returnLabel && (
                <span className="text-muted-foreground"> · {truncate(returnLabel, 32)}</span>
              )}
            </span>
          </button>
          <button
            type="button"
            onClick={() => takeReturnPoint(note.subjectId)}
            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Note Tags (Role: Badge / Chip) */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-6 pt-4 flex flex-wrap gap-1.5 no-print">
          {note.tags.map((tag, idx) => (
            <Badge
              key={idx}
              variant="secondary"
              className="gap-1 font-normal text-xs"
            >
              <Tag className="w-3 h-3 text-muted-foreground" />
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {/* Note Content: Render Markdown with LaTeX & Programmatic Diagrams */}
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        className="note-body p-6 md:p-8 text-foreground select-text max-w-4xl mx-auto w-full"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex, rehypeNoteAnchors]}
          components={markdownComponents}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

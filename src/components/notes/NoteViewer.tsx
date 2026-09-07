import React, { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import 'katex/dist/katex.min.css';

import { StoredNote } from '../../types';
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
  CheckCircle2,
} from 'lucide-react';
import { EditorialDiagram } from '../diagrams/EditorialDiagram';
import { pointOrigin, type MorphOrigin } from '../ui/Modal';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from '../ui/toast';

interface NoteViewerProps {
  note: StoredNote;
  /** Active Subject name, shown in the print masthead only. */
  subjectName?: string;
  onEdit?: () => void;
  onHighlightTerm?: (term: string, context?: string, origin?: MorphOrigin) => void;
  onRefresh?: () => void | Promise<void>;
}

/**
 * Extracts a word/term and surrounding sentence context from DOM coordinates
 */
function getWordAtPoint(x: number, y: number): { word: string; context: string } | null {
  if (typeof document === 'undefined') return null;

  let range: Range | null = null;
  if (document.caretRangeFromPoint) {
    range = document.caretRangeFromPoint(x, y);
  } else if ((document as any).caretPositionFromPoint) {
    const pos = (document as any).caretPositionFromPoint(x, y);
    if (pos && pos.offsetNode) {
      range = document.createRange();
      range.setStart(pos.offsetNode, pos.offset);
      range.setEnd(pos.offsetNode, pos.offset);
    }
  }

  if (range && range.startContainer && range.startContainer.nodeType === Node.TEXT_NODE) {
    const textNode = range.startContainer;
    const text = textNode.textContent || '';
    const offset = range.startOffset;

    // Word character regex supporting English, digits, and Ge'ez/Amharic Unicode range \u1200-\u137F
    const isWordChar = (char: string) => /[\w\-\u1200-\u137F]/.test(char);
    let start = offset;
    let end = offset;

    while (start > 0 && isWordChar(text.charAt(start - 1))) {
      start--;
    }
    while (end < text.length && isWordChar(text.charAt(end))) {
      end++;
    }

    const word = text.slice(start, end).trim();
    if (word.length >= 2) {
      const parentNode = textNode.parentElement;
      const context = parentNode?.textContent?.slice(0, 200) || '';
      return { word, context };
    }
  }

  // Fallback: Check if user has an active window selection
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length >= 2) {
    return {
      word: sel.toString().trim(),
      context: sel.anchorNode?.parentElement?.textContent?.slice(0, 200) || '',
    };
  }

  // Fallback: Check element under point
  const elem = document.elementFromPoint(x, y);
  if (elem && elem.textContent) {
    const words = elem.textContent.trim().split(/\s+/);
    if (words.length > 0 && words[0].length >= 2) {
      return { word: words[0].slice(0, 32), context: elem.textContent.slice(0, 200) };
    }
  }

  return null;
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
  onRefresh,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [termContext, setTermContext] = useState<string | undefined>(undefined);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Gesture: Long-Press Term Explainer States
  const [pulseRingCoords, setPulseRingCoords] = useState<{ x: number; y: number } | null>(null);
  const pressTimerRef = useRef<any>(null);
  const pressStartRef = useRef<{ x: number; y: number } | null>(null);

  // Gesture: Pull-down Rubber-band Refresh States
  const [pullY, setPullY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState(false);
  const pullStartRef = useRef<{ y: number; scrollTop: number } | null>(null);

  // Keep track of diagram figure numbering during markdown render
  let figureCounter = 0;

  // Clean note content for citations and HTML tags
  const processedContent = useMemo(() => {
    if (!note.content) return '';
    // Normalize citation references [[1]] -> <sup>[[1]]</sup>
    return note.content.replace(/<span class="citation">\[\[(\d+)\]\]<\/span>/g, '<sup>[$1]</sup>');
  }, [note.content]);

  // Handle text highlight for "Explain with AI"
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text && text.length > 1 && text.length < 60) {
      setSelectedTerm(text);
      const parentText = selection.anchorNode?.parentElement?.textContent || '';
      setTermContext(parentText.slice(0, 200));
    } else if (!pulseRingCoords) {
      setSelectedTerm(null);
    }
  };

  // Long-press detection on note terms (300ms hold)
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    pressStartRef.current = { x: e.clientX, y: e.clientY };

    // Show pulse ring immediately at touch coordinates
    setPulseRingCoords({ x: e.clientX, y: e.clientY });

    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    pressTimerRef.current = setTimeout(() => {
      if (pressStartRef.current) {
        const { x, y } = pressStartRef.current;
        const result = getWordAtPoint(x, y);
        if (result && result.word) {
          setSelectedTerm(result.word);
          setTermContext(result.context);
          if (onHighlightTerm) {
            onHighlightTerm(result.word, result.context, pointOrigin(x, y));
          }
          if (typeof navigator !== 'undefined' && navigator.vibrate) {
            navigator.vibrate(25);
          }
        }
      }
      setPulseRingCoords(null);
    }, 300);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pressStartRef.current) return;
    const dist = Math.hypot(e.clientX - pressStartRef.current.x, e.clientY - pressStartRef.current.y);
    if (dist > 8) {
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      setPulseRingCoords(null);
      pressStartRef.current = null;
    }
  };

  const handlePointerUp = () => {
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    setPulseRingCoords(null);
    pressStartRef.current = null;
  };

  // Pull-down Rubber-band Handlers on Note Top
  const handlePullDownStart = (e: React.PointerEvent | React.TouchEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const scrollY = containerRef.current?.scrollTop ?? window.scrollY;

    if (scrollY <= 2) {
      pullStartRef.current = { y: clientY, scrollTop: scrollY };
      setIsPulling(true);
    }
  };

  const handlePullDownMove = (e: React.PointerEvent | React.TouchEvent) => {
    if (!pullStartRef.current || isRefreshing) return;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const deltaY = clientY - pullStartRef.current.y;

    if (deltaY > 0) {
      const damped = Math.min(84, Math.pow(deltaY, 0.76) * 2.2);
      setPullY(damped);
    } else {
      setPullY(0);
    }
  };

  const handlePullDownEnd = async () => {
    if (!pullStartRef.current) return;
    pullStartRef.current = null;
    setIsPulling(false);

    if (pullY >= 55) {
      setIsRefreshing(true);
      setPullY(52);

      try {
        if (onRefresh) {
          await onRefresh();
        } else {
          await new Promise((resolve) => setTimeout(resolve, 850));
        }
        setRefreshSuccess(true);
        setTimeout(() => {
          setRefreshSuccess(false);
          setPullY(0);
          setIsRefreshing(false);
        }, 600);
      } catch {
        setPullY(0);
        setIsRefreshing(false);
      }
    } else {
      setPullY(0);
    }
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
      const match = /language-(\w+)/.exec(className || '');
      const lang = match ? match[1].toLowerCase() : '';

      // Intercept programmatic diagram blocks and render EditorialDiagram
      if (!inline && ['diagram', 'mindmap', 'flow', 'stack', 'figure', 'mermaid'].includes(lang)) {
        figureCounter += 1;
        const currentFigIndex = figureCounter;
        return (
          <div className="note-figure my-6 not-prose">
            <EditorialDiagram
              content={String(children).trim()}
              title={note.title}
              figIndex={currentFigIndex}
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
    h1({ children }: any) {
      return (
        <h1 className="font-editorial text-2xl md:text-3xl font-bold text-foreground mt-8 mb-4 pb-2.5 border-b border-border tracking-tight leading-tight">
          {children}
        </h1>
      );
    },
    h2({ children }: any) {
      return (
        <h2 className="font-editorial text-xl md:text-2xl font-bold text-foreground mt-7 mb-3.5 flex items-center gap-2.5 tracking-tight leading-snug">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          {children}
        </h2>
      );
    },
    h3({ children }: any) {
      return (
        <h3 className="font-editorial text-lg md:text-xl font-semibold text-foreground/90 mt-5 mb-2.5 tracking-tight">
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

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePullDownStart}
      onPointerMove={handlePullDownMove}
      onPointerUp={handlePullDownEnd}
      onTouchStart={handlePullDownStart}
      onTouchMove={handlePullDownMove}
      onTouchEnd={handlePullDownEnd}
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

      {/* Pulse Ring Indicator for 300ms Long-press Gesture */}
      {pulseRingCoords && (
        <div
          className="pulse-ring-indicator"
          style={{
            left: `${pulseRingCoords.x}px`,
            top: `${pulseRingCoords.y}px`,
          }}
        />
      )}

      {/* Rubber-band Pull-down Banner with Spinner Reveal */}
      <div
        className="overflow-hidden bg-muted/40 border-b border-border flex items-center justify-center gap-2.5 text-xs font-medium text-foreground transition-all duration-150 ease-out"
        style={{
          height: `${pullY}px`,
          opacity: pullY > 0 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2">
          {refreshSuccess ? (
            <div className="flex items-center gap-1.5 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 px-3 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800 text-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Note Refreshed with ተማሪ AI</span>
            </div>
          ) : (
            <>
              <div
                className="p-1.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 rounded-lg border border-amber-300 dark:border-amber-700 transition-transform"
                style={{
                  transform: isRefreshing ? undefined : `rotate(${pullY * 4.5}deg)`,
                }}
              >
                <Sparkles className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </div>
              <span className="font-medium text-muted-foreground text-xs">
                {isRefreshing
                  ? 'Re-summarizing with ተማሪ AI...'
                  : pullY >= 55
                  ? 'Release to refresh note'
                  : 'Pull down to refresh'}
              </span>
            </>
          )}
        </div>
      </div>

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

      {/* Floating Highlight / Long-Press Explainer Tooltip */}
      {selectedTerm && (
        <div className="sticky top-3 z-30 mx-auto -mb-8 w-fit bg-zinc-900 text-zinc-100 px-4 py-2 rounded-xl border border-zinc-700 shadow-lg flex items-center gap-3 animate-in zoom-in-95 duration-150 no-print">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs font-medium">
            Explain &ldquo;<strong className="text-amber-300 font-semibold">{selectedTerm}</strong>&rdquo; with{' '}
            <span className="font-ethiopic font-bold text-amber-400 text-sm">ተማሪ</span> AI?
          </span>
          <Button
            size="xs"
            variant="default"
            onClick={(e) => {
              if (onHighlightTerm) onHighlightTerm(selectedTerm, termContext, e.currentTarget);
              setSelectedTerm(null);
            }}
            className="bg-amber-500 hover:bg-amber-600 text-zinc-950 font-semibold text-xs"
          >
            Explain
          </Button>
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
        onPointerCancel={handlePointerUp}
        className="note-body p-6 md:p-8 text-foreground select-text max-w-4xl mx-auto w-full"
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeRaw, rehypeKatex]}
          components={markdownComponents}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    </div>
  );
};

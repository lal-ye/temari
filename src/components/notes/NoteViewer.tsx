import React, { useMemo, useRef, useState } from 'react';
import { StoredNote } from '../../types';
import { Copy, Check, Printer, FileText, Maximize2, Share2, Sparkles, Tag, BookOpen, Clock, RefreshCw } from 'lucide-react';
import { EditorialDiagram } from '../diagrams/EditorialDiagram';
import { pointOrigin, type MorphOrigin } from '../ui/Modal';

interface NoteViewerProps {
  note: StoredNote;
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

interface NoteSegment {
  type: 'markdown' | 'diagram';
  content: string;
}

/**
 * Split note raw content into markdown segments and editorial diagram blocks
 */
function parseNoteSegments(raw: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  const diagramRegex = /```(?:diagram|mindmap|mermaid|flow|stack)([\s\S]*?)```/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = diagramRegex.exec(raw)) !== null) {
    if (match.index > lastIndex) {
      const markdownChunk = raw.substring(lastIndex, match.index);
      if (markdownChunk.trim()) {
        segments.push({ type: 'markdown', content: markdownChunk });
      }
    }
    segments.push({ type: 'diagram', content: match[1].trim() });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < raw.length) {
    const remaining = raw.substring(lastIndex);
    if (remaining.trim()) {
      segments.push({ type: 'markdown', content: remaining });
    }
  }

  return segments.length > 0 ? segments : [{ type: 'markdown', content: raw }];
}

/**
 * Pure function to convert markdown into HTML with callouts and tables.
 * Extracted outside component to avoid re-creation on every render.
 */
const formatMarkdown = (md: string): string => {
  let formatted = md;

  // Callouts
  formatted = formatted.replace(
    />\s*\[!NOTE\]\s*([\s\S]*?)(?=\n\n|$)/g,
    '<div class="p-4 my-4 rounded-xl border-2 border-slate-900 bg-[#DBEAFE] text-slate-950 font-normal text-sm shadow-neo-sm"><strong class="badge-chip text-blue-900 block mb-1">Note</strong>$1</div>'
  );
  formatted = formatted.replace(
    />\s*\[!IMPORTANT\]\s*([\s\S]*?)(?=\n\n|$)/g,
    '<div class="p-4 my-4 rounded-xl border-2 border-slate-900 bg-[#FFE4E6] text-slate-950 font-normal text-sm shadow-neo-sm"><strong class="badge-chip text-rose-900 block mb-1">Important</strong>$1</div>'
  );
  formatted = formatted.replace(
    />\s*\[!TIP\]\s*([\s\S]*?)(?=\n\n|$)/g,
    '<div class="p-4 my-4 rounded-xl border-2 border-slate-900 bg-[#DCFCE7] text-slate-950 font-normal text-sm shadow-neo-sm"><strong class="badge-chip text-emerald-900 block mb-1">Helpful Tip</strong>$1</div>'
  );

  // Citations
  formatted = formatted.replace(
    /<span class="citation">\[\[(\d+)\]\]<\/span>/g,
    '<sup class="px-1.5 py-0.5 ml-1 bg-yellow-200 border border-slate-900 rounded font-mono text-[10px] font-black text-slate-950 shadow-xs">[$1]</sup>'
  );

  // Basic headers: Section headings follow the 22px / 1.15 700 Playfair Display type scale
  formatted = formatted.replace(/^# (.*$)/gim, '<h1 class="font-editorial text-[26px] font-bold text-slate-950 mt-6 mb-3 pb-2 border-b-2 border-slate-900 leading-[1.15]">$1</h1>');
  formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="section-heading text-slate-900 mt-6 mb-2.5 flex items-center gap-2"><span class="w-2.5 h-2.5 bg-yellow-400 border border-slate-900 rounded-sm shrink-0"></span>$1</h2>');
  formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="font-editorial text-[18px] font-bold text-slate-800 mt-4 mb-2 leading-[1.2]">$1</h3>');

  // Bold / italic
  formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-slate-950 bg-yellow-100 px-0.5 rounded">$1</strong>');
  formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic font-semibold">$1</em>');

  // Lists
  formatted = formatted.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc pl-1 text-slate-800 my-1 text-sm font-normal">$1</li>');
  formatted = formatted.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal pl-1 text-slate-800 my-1 text-sm font-normal">$1</li>');

  // Basic Markdown Table Parser
  const lines = formatted.split('\n');
  let inTable = false;
  let tableHtml = '';
  const resultLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      if (!inTable) {
        inTable = true;
        tableHtml = '<div class="my-5 overflow-x-auto border-2 border-slate-900 rounded-xl shadow-neo-sm bg-white"><table class="w-full text-left text-xs border-collapse">';
        // Header row
        const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableHtml += '<thead class="bg-[#FEF08A] text-slate-950 font-black border-b-2 border-slate-900"><tr>';
        cells.forEach((c) => (tableHtml += `<th class="p-3 font-black text-slate-950 border-r border-slate-900/20 last:border-r-0">${c.trim()}</th>`));
        tableHtml += '</tr></thead><tbody>';
        // Skip divider row if next is |---|
        if (lines[i + 1] && lines[i + 1].includes('---')) {
          i++;
        }
      } else {
        // Body row
        const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
        tableHtml += '<tr class="border-b border-slate-200 hover:bg-slate-50 transition-colors">';
        cells.forEach((c) => (tableHtml += `<td class="p-3 font-medium text-slate-800 border-r border-slate-200 last:border-r-0">${c.trim()}</td>`));
        tableHtml += '</tr>';
      }
    } else {
      if (inTable) {
        tableHtml += '</tbody></table></div>';
        resultLines.push(tableHtml);
        inTable = false;
        tableHtml = '';
      }
      resultLines.push(lines[i]);
    }
  }
  if (inTable) {
    tableHtml += '</tbody></table></div>';
    resultLines.push(tableHtml);
  }

  return resultLines.join('\n');
};

export const NoteViewer: React.FC<NoteViewerProps> = ({ note, onEdit, onHighlightTerm, onRefresh }) => {
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

  // Parse note content into alternating markdown and diagram segments
  const segments = useMemo(() => parseNoteSegments(note.content), [note.content]);

  // Figure numbering runs across the whole note. Reset on every render pass so
  // it stays in step with the segments actually drawn.
  let figureCounter = 0;

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
            // No element to point at — morph out of the press point itself.
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
      // Rubber-band physics damping curve: Math.pow(deltaY, 0.76) * 2.2 up to max 84px
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
      setPullY(52); // Keep spinner revealed while refreshing

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
    navigator.clipboard.writeText(note.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePullDownStart}
      onPointerMove={handlePullDownMove}
      onPointerUp={handlePullDownEnd}
      onTouchStart={handlePullDownStart}
      onTouchMove={handlePullDownMove}
      onTouchEnd={handlePullDownEnd}
      className="bg-white border-3 border-slate-900 rounded-2xl shadow-neo-md overflow-hidden flex flex-col relative select-text"
    >
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
        className="overflow-hidden bg-[#FAF8F5] border-b-2 border-slate-900 flex items-center justify-center gap-2.5 text-xs font-black text-slate-900 transition-all duration-150 ease-out"
        style={{
          height: `${pullY}px`,
          opacity: pullY > 0 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2">
          {refreshSuccess ? (
            <div className="flex items-center gap-1.5 text-emerald-800 bg-emerald-100 px-3 py-1 rounded-xl border-2 border-slate-900 shadow-neo-xs">
              <Check className="w-4 h-4 text-emerald-700" />
              <span>Note Refreshed with ተማሪ AI</span>
            </div>
          ) : (
            <>
              <div
                className="p-1.5 bg-yellow-300 border-2 border-slate-900 rounded-xl shadow-neo-xs transition-transform"
                style={{
                  transform: isRefreshing ? undefined : `rotate(${pullY * 4.5}deg)`,
                }}
              >
                <Sparkles className={`w-4 h-4 text-slate-950 ${isRefreshing ? 'animate-spin' : ''}`} />
              </div>
              <span className="font-black text-slate-900 text-[11px]">
                {isRefreshing
                  ? 'Re-summarizing with ተማሪ AI...'
                  : pullY >= 55
                  ? 'Release to refresh note'
                  : 'Pull down to refresh / re-summarize'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Top Action Bar */}
      <div className="p-4 bg-[#FAF8F5] border-b-2 border-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-300 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-black text-slate-950">{note.title}</h2>
            <div className="flex items-center gap-2.5 text-[11px] font-bold text-slate-600">
              <span className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
              {note.sourceName && (
                <span className="px-2 py-0.5 bg-white border border-slate-900 text-slate-950 rounded-md text-[10px] font-mono font-bold shadow-xs">
                  {note.sourceName}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onEdit && (
            <button
              onClick={onEdit}
              className="btn-kinetic px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-black text-slate-900 rounded-xl border-2 border-slate-900 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5"
            >
              Edit Markdown
            </button>
          )}

          <button
            onClick={copyToClipboard}
            className="btn-kinetic flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-black text-slate-900 rounded-xl border-2 border-slate-900 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5"
            title="Copy Note Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handlePrint}
            className="btn-kinetic flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-300 hover:bg-cyan-200 text-slate-950 text-xs font-black rounded-xl border-2 border-slate-900 shadow-neo-sm active:translate-x-0.5 active:translate-y-0.5"
            title="Print or Export PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Floating Highlight / Long-Press Explainer Tooltip */}
      {selectedTerm && (
        <div className="sticky top-2 z-30 mx-auto -mb-8 w-fit bg-slate-900 text-white px-4 py-2 rounded-xl border-2 border-yellow-300 shadow-neo-lg flex items-center gap-3 animate-in zoom-in-95 duration-150 no-print">
          <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
          <span className="text-xs font-bold">
            Explain &ldquo;<strong className="text-yellow-200 font-black">{selectedTerm}</strong>&rdquo; with{' '}
            <span className="font-ethiopic font-bold text-yellow-300 text-sm">ተማሪ</span> AI?
          </span>
          <button
            onClick={(e) => {
              if (onHighlightTerm) onHighlightTerm(selectedTerm, termContext, e.currentTarget);
              setSelectedTerm(null);
            }}
            className="px-2.5 py-1 bg-yellow-300 text-slate-950 font-black text-xs rounded-lg border border-slate-900 hover:bg-yellow-200 transition-colors shadow-neo-sm"
          >
            Explain
          </button>
        </div>
      )}

      {/* Note Tags (Role: Badge / Chip) */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-6 pt-4 flex flex-wrap gap-1.5 no-print">
          {note.tags.map((tag, idx) => (
            <span
              key={idx}
              className="badge-chip inline-flex items-center gap-1.5 px-3 py-1 bg-white border-2 border-slate-900 text-slate-900 rounded-lg shadow-neo-sm"
            >
              <Tag className="w-3 h-3 text-slate-600" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Note Content: Render Segments (Markdown + Editorial Diagrams) */}
      {/* Role: Note body | Long-press gesture listener */}
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="note-body p-6 md:p-8 text-slate-900 select-text max-w-4xl mx-auto w-full"
      >
        {segments.map((segment, idx) => {
          if (segment.type === 'diagram') {
            // Figures are numbered across the note so the caption ("Fig. 2")
            // matches what a learner would cite when asking about it.
            figureCounter += 1;
            const figIndex = figureCounter;
            return (
              <EditorialDiagram
                key={`diagram-${idx}`}
                content={segment.content}
                title={note.title}
                figIndex={figIndex}
                onNodeActivate={(label, context, el) => {
                  // A node is a portal, not an illustration: tapping it asks
                  // the explainer about that exact term, morphing out of the
                  // box that was pressed.
                  if (onHighlightTerm) onHighlightTerm(label, context, el as HTMLElement);
                }}
              />
            );
          }

          return (
            <div
              key={`markdown-${idx}`}
              className="overflow-x-auto mb-4"
              dangerouslySetInnerHTML={{ __html: formatMarkdown(segment.content) }}
            />
          );
        })}
      </div>
    </div>
  );
};

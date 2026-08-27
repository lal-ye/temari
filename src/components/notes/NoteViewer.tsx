import React, { useEffect, useRef, useState } from 'react';
import { StoredNote } from '../../types';
import { Copy, Check, Printer, FileText, Maximize2, Share2, Sparkles, Tag, BookOpen, Clock } from 'lucide-react';

interface NoteViewerProps {
  note: StoredNote;
  onEdit?: () => void;
  onHighlightTerm?: (term: string, context?: string) => void;
}

export const NoteViewer: React.FC<NoteViewerProps> = ({ note, onEdit, onHighlightTerm }) => {
  const [copied, setCopied] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string | null>(null);
  const [termContext, setTermContext] = useState<string | undefined>(undefined);
  const [showDiagramModal, setShowDiagramModal] = useState<string | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const mermaidCounterRef = useRef(0);

  // Render mermaid diagrams
  useEffect(() => {
    if (!contentRef.current) return;

    const renderMermaid = async () => {
      if (!(window as any).mermaid) return;

      const codeBlocks = contentRef.current?.querySelectorAll('pre code.language-mermaid, .mermaid-code-target');
      if (!codeBlocks || codeBlocks.length === 0) return;

      for (let i = 0; i < codeBlocks.length; i++) {
        const el = codeBlocks[i];
        const rawCode = el.textContent || '';
        if (!rawCode.trim()) continue;

        try {
          const id = `mermaid-svg-${Date.now()}-${mermaidCounterRef.current++}`;
          const { svg } = await (window as any).mermaid.render(id, rawCode.trim());
          const container = document.createElement('div');
          container.className = 'my-5 p-4 bg-slate-50 border border-slate-200 rounded-xl overflow-x-auto flex justify-center text-center';
          container.innerHTML = svg;
          el.parentElement?.replaceWith(container);
        } catch (e) {
          console.warn('Mermaid rendering skipped for block:', e);
        }
      }
    };

    renderMermaid();
  }, [note.content]);

  // Handle text highlight for "Explain with AI"
  const handleMouseUp = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const text = selection.toString().trim();
    if (text && text.length > 1 && text.length < 60) {
      setSelectedTerm(text);
      // Context from parent node
      const parentText = selection.anchorNode?.parentElement?.textContent || '';
      setTermContext(parentText.slice(0, 200));
    } else {
      setSelectedTerm(null);
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

  // Convert markdown into HTML with callouts and tables
  const formatMarkdown = (md: string) => {
    let formatted = md;

    // Callouts
    formatted = formatted.replace(
      />\s*\[!NOTE\]\s*([\s\S]*?)(?=\n\n|$)/g,
      '<div class="p-4 my-4 rounded-xl border-2 border-slate-900 bg-[#DBEAFE] text-slate-950 font-medium text-xs shadow-neo-sm"><strong class="text-blue-900 block mb-1 text-[11px] font-black uppercase tracking-wider">Note</strong>$1</div>'
    );
    formatted = formatted.replace(
      />\s*\[!IMPORTANT\]\s*([\s\S]*?)(?=\n\n|$)/g,
      '<div class="p-4 my-4 rounded-xl border-2 border-slate-900 bg-[#FFE4E6] text-slate-950 font-medium text-xs shadow-neo-sm"><strong class="text-rose-900 block mb-1 text-[11px] font-black uppercase tracking-wider">Important</strong>$1</div>'
    );
    formatted = formatted.replace(
      />\s*\[!TIP\]\s*([\s\S]*?)(?=\n\n|$)/g,
      '<div class="p-4 my-4 rounded-xl border-2 border-slate-900 bg-[#DCFCE7] text-slate-950 font-medium text-xs shadow-neo-sm"><strong class="text-emerald-900 block mb-1 text-[11px] font-black uppercase tracking-wider">Helpful Tip</strong>$1</div>'
    );

    // Citations
    formatted = formatted.replace(
      /<span class="citation">\[\[(\d+)\]\]<\/span>/g,
      '<sup class="px-1.5 py-0.5 ml-1 bg-yellow-200 border border-slate-900 rounded font-mono text-[9px] font-black text-slate-950 shadow-xs">[$1]</sup>'
    );

    // Mermaid code blocks
    formatted = formatted.replace(
      /```mermaid([\s\S]*?)```/g,
      '<div class="mermaid-code-target my-4">$1</div>'
    );

    // Basic headers
    formatted = formatted.replace(/^# (.*$)/gim, '<h1 class="text-xl font-black text-slate-950 mt-6 mb-3 pb-2 border-b-2 border-slate-900">$1</h1>');
    formatted = formatted.replace(/^## (.*$)/gim, '<h2 class="text-base font-black text-slate-900 mt-5 mb-2.5 flex items-center gap-2"><span class="w-2.5 h-2.5 bg-yellow-400 border border-slate-900 rounded-sm"></span>$1</h2>');
    formatted = formatted.replace(/^### (.*$)/gim, '<h3 class="text-sm font-black text-slate-800 mt-4 mb-1.5">$1</h3>');

    // Bold / italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<strong class="font-black text-slate-950 bg-yellow-100 px-0.5 rounded">$1</strong>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<em class="italic font-semibold">$1</em>');

    // Lists
    formatted = formatted.replace(/^\s*-\s+(.*$)/gim, '<li class="ml-4 list-disc pl-1 text-slate-800 my-1 text-xs font-medium">$1</li>');
    formatted = formatted.replace(/^\s*\d+\.\s+(.*$)/gim, '<li class="ml-4 list-decimal pl-1 text-slate-800 my-1 text-xs font-medium">$1</li>');

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

  return (
    <div className="bg-white border-3 border-slate-900 rounded-2xl shadow-neo-md overflow-hidden flex flex-col">
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
                <span className="px-2 py-0.5 bg-white border border-slate-900 text-slate-900 rounded-md text-[10px] font-mono font-bold shadow-xs">
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
              className="px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-black text-slate-900 rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
            >
              Edit Markdown
            </button>
          )}

          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-xs font-black text-slate-900 rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
            title="Copy Note Text"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? 'Copied' : 'Copy'}
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-cyan-300 hover:bg-cyan-200 text-slate-950 text-xs font-black rounded-xl border-2 border-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
            title="Print or Export PDF"
          >
            <Printer className="w-3.5 h-3.5" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* Floating Highlight Explainer Tooltip */}
      {selectedTerm && (
        <div className="sticky top-2 z-30 mx-auto -mb-8 w-fit bg-slate-900 text-white px-4 py-2 rounded-xl border-2 border-yellow-300 shadow-neo-lg flex items-center gap-3 animate-in zoom-in-95 duration-150 no-print">
          <Sparkles className="w-4 h-4 text-yellow-300 shrink-0" />
          <span className="text-xs font-bold">
            Explain &ldquo;<strong className="text-yellow-200 font-black">{selectedTerm}</strong>&rdquo; with ተማሪ AI?
          </span>
          <button
            onClick={() => {
              if (onHighlightTerm) onHighlightTerm(selectedTerm, termContext);
              setSelectedTerm(null);
            }}
            className="px-2.5 py-1 bg-yellow-300 text-slate-950 font-black text-xs rounded-lg border border-slate-900 hover:bg-yellow-200 transition-colors shadow-neo-sm"
          >
            Explain
          </button>
        </div>
      )}

      {/* Note Tags */}
      {note.tags && note.tags.length > 0 && (
        <div className="px-6 pt-4 flex flex-wrap gap-1.5 no-print">
          {note.tags.map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border-2 border-slate-900 text-slate-900 text-[11px] font-black rounded-lg shadow-neo-sm"
            >
              <Tag className="w-3 h-3 text-slate-600" />
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Note Content */}
      <div
        ref={contentRef}
        onMouseUp={handleMouseUp}
        className="p-6 md:p-8 text-slate-900 text-xs leading-relaxed overflow-x-auto select-text font-normal"
        dangerouslySetInnerHTML={{ __html: formatMarkdown(note.content) }}
      />
    </div>
  );
};

import React, { useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import type { DiagramDoc } from './diagramDoc';
import { FIGURE } from './figureTokens';

interface FigureShellProps {
  doc: DiagramDoc;
  figIndex?: number;
  children: React.ReactNode;
}

/**
 * Frame and caption around a figure.
 *
 * The chrome/figure boundary is this frame: the border and its shadow belong
 * to the app's neo-brutalist chrome, and everything inside is flat printed
 * illustration. That line is why figures read as textbook plates rather than
 * as another dashboard card.
 *
 * The caption is a real <figcaption> under a real <figure>, so the numbering
 * and title are available to assistive tech and to print, rather than being a
 * styled div that only looks like a caption.
 */
const FigureShellBase: React.FC<FigureShellProps> = ({ doc, figIndex, children }) => (
  <figure className="temari-figure my-6">
    <div
      className="rounded-2xl border-2 overflow-hidden"
      style={{ borderColor: FIGURE.ink, background: FIGURE.paper }}
    >
      <div className="p-4 md:p-6 overflow-x-auto flex justify-center">{children}</div>
    </div>

    <figcaption className="mt-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1 px-1">
      {figIndex !== undefined && (
        <span
          className="text-[10px] font-mono font-black uppercase tracking-wider"
          style={{ color: FIGURE.accent }}
        >
          Fig. {figIndex}
        </span>
      )}
      <span className="text-xs font-bold" style={{ color: FIGURE.ink }}>
        {doc.title}
      </span>
      {doc.subtitle && (
        <span className="text-[11px] font-medium text-pretty" style={{ color: FIGURE.muted }}>
          {doc.subtitle}
        </span>
      )}
    </figcaption>
  </figure>
);

interface FigureErrorProps {
  errors: string[];
  raw: string;
  figIndex?: number;
}

/**
 * Shown when a fence claims to be JSON but fails validation.
 *
 * It states what was wrong rather than silently dropping the figure or
 * rendering something misleading: a study note that quietly loses a diagram is
 * worse than one that says a diagram failed. The raw source stays available
 * behind a disclosure so the content is never actually lost.
 */
const FigureError: React.FC<FigureErrorProps> = ({ errors, raw, figIndex }) => {
  const [open, setOpen] = useState(false);

  return (
    <figure className="my-6">
      <div className="rounded-2xl border-2 border-dashed border-amber-600 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black text-amber-950">
              {figIndex !== undefined ? `Figure ${figIndex} ` : 'A figure '}
              could not be drawn
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {errors.slice(0, 4).map((e, i) => (
                <li key={i} className="text-[11px] font-medium text-amber-900 text-pretty">
                  {e}
                </li>
              ))}
              {errors.length > 4 && (
                <li className="text-[11px] font-bold text-amber-800">
                  and {errors.length - 4} more
                </li>
              )}
            </ul>

            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-black text-amber-900 hover:text-amber-950"
              aria-expanded={open}
            >
              <ChevronDown
                className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
              {open ? 'Hide source' : 'Show source'}
            </button>

            {open && (
              <pre className="mt-2 p-2.5 bg-white border border-amber-300 rounded-lg text-[10px] font-mono text-slate-700 overflow-x-auto max-h-48">
                {raw}
              </pre>
            )}
          </div>
        </div>
      </div>
    </figure>
  );
};

type FigureShellComponent = React.FC<FigureShellProps> & { Error: React.FC<FigureErrorProps> };

export const FigureShell = FigureShellBase as FigureShellComponent;
FigureShell.Error = FigureError;

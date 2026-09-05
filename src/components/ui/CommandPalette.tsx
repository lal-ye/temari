import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Search } from 'lucide-react';

export interface Command {
  id: string;
  label: string;
  /** Grouping header, e.g. "Go to" or "Create". */
  group: string;
  icon: LucideIcon;
  /** Shown right-aligned; the shortcut that also runs this command. */
  hint?: string;
  /** Extra words to match on that are not in the label. */
  keywords?: string;
  run: () => void;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  commands: Command[];
}

/**
 * Keyboard-first launcher for every navigation and creation action.
 *
 * Deliberately unanimated. This is opened by a keyboard shortcut and used many
 * times a session, which puts it in the top tier of the motion budget: no
 * animation, ever (DEVELOPING.md). A fade here would be a tax paid on every
 * single open, and the palette's whole value is that it feels instantaneous.
 *
 * Matching is a plain subsequence test rather than fuzzy scoring: with a few
 * dozen commands it is predictable, and predictability beats cleverness when
 * the user is typing blind and hitting Enter.
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose, commands }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      // Focus after paint so the caret lands reliably.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => {
      const haystack = `${c.label} ${c.group} ${c.keywords ?? ''}`.toLowerCase();
      // Subsequence match: "gnq" finds "Generate New Quiz".
      let i = 0;
      for (const ch of haystack) {
        if (ch === q[i]) i += 1;
        if (i === q.length) return true;
      }
      return haystack.includes(q);
    });
  }, [commands, query]);

  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, results.length - 1)));
  }, [results.length]);

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  if (!open) return null;

  const runActive = () => {
    const command = results[activeIndex];
    if (!command) return;
    onClose();
    command.run();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (results.length ? (i - 1 + results.length) % results.length : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      runActive();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Group headers are rendered inline, but the index space stays flat so
  // arrow keys move through results rather than through groups.
  let renderedGroup: string | null = null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center bg-slate-900/60 backdrop-blur-xs p-4 pt-[12vh]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl bg-white border-3 border-slate-900 rounded-2xl shadow-neo-xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 border-b-3 border-slate-900">
          <Search className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search actions"
            aria-label="Search actions"
            aria-controls="command-results"
            aria-activedescendant={results[activeIndex] ? `command-${results[activeIndex].id}` : undefined}
            className="flex-1 py-3.5 text-sm font-bold text-slate-950 bg-transparent outline-hidden placeholder:text-slate-400 placeholder:font-medium"
          />
          <kbd className="text-[10px] font-mono font-black text-slate-500 border border-slate-300 rounded px-1.5 py-0.5">
            esc
          </kbd>
        </div>

        <div
          id="command-results"
          ref={listRef}
          role="listbox"
          aria-label="Actions"
          className="max-h-[52vh] overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <p className="px-3 py-8 text-center text-xs font-bold text-slate-500">
              No actions match “{query}”.
            </p>
          )}

          {results.map((command, index) => {
            const Icon = command.icon;
            const isActive = index === activeIndex;
            const showGroup = command.group !== renderedGroup;
            renderedGroup = command.group;

            return (
              <React.Fragment key={command.id}>
                {showGroup && (
                  <div className="px-2 pt-2 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
                    {command.group}
                  </div>
                )}
                <div
                  id={`command-${command.id}`}
                  data-index={index}
                  role="option"
                  aria-selected={isActive}
                  tabIndex={-1}
                  onMouseMove={() => setActiveIndex(index)}
                  onClick={() => {
                    onClose();
                    command.run();
                  }}
                  className={`flex items-center gap-2.5 px-2.5 py-2 rounded-xl cursor-pointer border-2 ${
                    isActive
                      ? 'bg-[#67E8F9] border-slate-900 text-slate-950'
                      : 'border-transparent text-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span className="flex-1 text-xs font-bold">{command.label}</span>
                  {command.hint && (
                    <kbd className="text-[10px] font-mono font-black text-slate-600 border border-slate-300 rounded px-1.5 py-0.5">
                      {command.hint}
                    </kbd>
                  )}
                </div>
              </React.Fragment>
            );
          })}
        </div>
      </div>
    </div>
  );
};

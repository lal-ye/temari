import React, { useEffect, useRef, useState } from 'react';
import { BookOpen, Check, ChevronDown, Plus } from 'lucide-react';
import type { Subject } from '../../types';

interface SubjectSwitcherProps {
  subjects: Subject[];
  activeSubjectId: string | null;
  currentSubject: Subject | undefined;
  onSelect: (id: string) => void;
  onAddSubject: (e: React.MouseEvent<HTMLElement>) => void;
}

/**
 * The active subject dropdown switcher in the header.
 * Clean, accessible popover with Amharic typography and Subject codes.
 */
export const SubjectSwitcher: React.FC<SubjectSwitcherProps> = ({
  subjects,
  activeSubjectId,
  currentSubject,
  onSelect,
  onAddSubject,
}) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Dismiss on outside click and on Escape
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Active subject: ${currentSubject?.name ?? 'none'}. Change subject`}
        className="flex items-center gap-2 pl-2.5 pr-2 py-1.5 bg-card hover:bg-muted/60 border border-border/80 rounded-lg shadow-xs max-w-[15rem] transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
          style={{ backgroundColor: currentSubject?.color || '#3B82F6' }}
        />
        <span className="text-xs font-semibold text-foreground truncate">
          {currentSubject?.name || 'General Studies'}
        </span>
        {currentSubject?.code && (
          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-muted text-muted-foreground font-mono font-medium rounded shrink-0">
            {currentSubject.code}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0 transition-transform duration-150" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : undefined }} />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Subjects"
          className="absolute left-0 top-full mt-1.5 w-72 bg-popover text-popover-foreground border border-border rounded-xl shadow-md z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-100"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
            <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <BookOpen className="w-3.5 h-3.5 text-muted-foreground" aria-hidden="true" />
              Active subject
            </span>
            <button
              onClick={(e) => {
                setOpen(false);
                onAddSubject(e);
              }}
              className="px-2 py-0.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md flex items-center gap-1 text-[11px] font-medium transition-colors"
            >
              <Plus className="w-3 h-3" aria-hidden="true" /> New
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
            {subjects.map((sub) => {
              const isActive = sub.id === activeSubjectId;
              return (
                <button
                  key={sub.id}
                  role="option"
                  aria-selected={isActive}
                  onClick={() => {
                    onSelect(sub.id);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? 'bg-accent text-accent-foreground font-medium'
                      : 'text-foreground hover:bg-muted/60'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 shadow-xs"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-medium text-foreground truncate">
                      {sub.name}
                    </span>
                    {sub.amharicName && (
                      <span className="block text-[10px] text-muted-foreground font-ethiopic truncate">
                        {sub.amharicName}
                      </span>
                    )}
                  </span>
                  {sub.code && (
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {sub.code}
                    </span>
                  )}
                  {isActive && <Check className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

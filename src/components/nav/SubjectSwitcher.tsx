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
 * The active subject, moved out of the removed sidebar and into the header.
 *
 * This is a popover rather than a native <select> on purpose. The subject is
 * persistent context that drives every view, and each one carries a colour, an
 * Amharic name and a course code that a native option list flattens into a
 * single run of text. It is also the highest-traffic control in the header, so
 * it shows the current subject inline rather than hiding it behind a label.
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

  // Dismiss on outside click and on Escape, the two things a popover must do.
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
        className="btn-kinetic flex items-center gap-2 pl-2.5 pr-2 py-1.5 bg-[#FAF8F5] hover:bg-white border-2 border-slate-900 rounded-xl shadow-neo-sm max-w-[15rem]"
      >
        <span
          className="w-3 h-3 rounded-full border border-slate-900 shrink-0"
          style={{ backgroundColor: currentSubject?.color || '#3B82F6' }}
        />
        <span className="text-xs font-black text-slate-950 truncate">
          {currentSubject?.name || 'General Studies'}
        </span>
        {currentSubject?.code && (
          <span className="hidden sm:inline text-[10px] px-1.5 py-0.5 bg-slate-900 text-white font-mono font-bold rounded shrink-0">
            {currentSubject.code}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-slate-900 stroke-[2.5] shrink-0" aria-hidden="true" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Subjects"
          className="absolute left-0 top-full mt-2 w-72 bg-white border-3 border-slate-900 rounded-2xl shadow-neo-lg z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b-2 border-slate-900 bg-[#FAF8F5]">
            <span className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider text-slate-800">
              <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
              Active subject
            </span>
            <button
              onClick={(e) => {
                setOpen(false);
                onAddSubject(e);
              }}
              className="btn-kinetic px-2 py-1 bg-cyan-300 hover:bg-cyan-200 text-slate-950 rounded-lg border-2 border-slate-900 flex items-center gap-1 text-[10px] font-black shadow-neo-xs"
            >
              <Plus className="w-3 h-3 stroke-[2.5]" aria-hidden="true" /> New
            </button>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5">
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
                  className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl border-2 text-left ${
                    isActive
                      ? 'bg-[#67E8F9] border-slate-900'
                      : 'border-transparent hover:bg-slate-100'
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-slate-900 shrink-0"
                    style={{ backgroundColor: sub.color }}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block text-xs font-black text-slate-950 truncate">
                      {sub.name}
                    </span>
                    {sub.amharicName && (
                      <span className="block text-[10px] font-bold text-slate-600 font-ethiopic truncate">
                        {sub.amharicName}
                      </span>
                    )}
                  </span>
                  {sub.code && (
                    <span className="text-[9px] font-mono font-bold text-slate-600 shrink-0">
                      {sub.code}
                    </span>
                  )}
                  {isActive && <Check className="w-3.5 h-3.5 text-slate-900 shrink-0" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

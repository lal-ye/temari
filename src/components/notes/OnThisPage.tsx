import React, { useState } from 'react';
import { Popover } from '@base-ui/react/popover';
import { List } from 'lucide-react';
import type { NoteHeading } from './useReadingPlace';
import { Button } from '../ui/button';

interface OnThisPageProps {
  headings: NoteHeading[];
  /** Jump to a heading. The caller saves the departure point first. */
  onJump: (headingId: string) => void;
}

/**
 * "On this page" — a compact outline of the current Note as a popover from
 * the action bar. Deliberately not a permanent column (ADR-0006): an outline
 * answers "where can I go?", which is an occasional question; the reading
 * place hook answers "where was I?", which is the frequent one.
 *
 * Base UI Popover: Escape and outside press dismiss; `modal={false}` so the
 * page keeps scrolling beneath it. Items are plain buttons so the list is
 * keyboard-reachable without arrow-key semantics it does not need.
 */
export const OnThisPage: React.FC<OnThisPageProps> = ({ headings, onJump }) => {
  const [open, setOpen] = useState(false);
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <Popover.Root open={open} onOpenChange={setOpen} modal={false}>
      <Popover.Trigger
        render={<Button variant="outline" size="sm" className="gap-1.5" title="On this page" />}
      >
        <List className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">On this page</span>
        <span className="sr-only sm:hidden">On this page</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={6} className="isolate z-50 outline-none">
          <Popover.Popup className="w-72 max-w-[calc(100vw-2rem)] max-h-(--available-height) overflow-y-auto rounded-xl bg-popover text-popover-foreground p-1.5 shadow-md ring-1 ring-foreground/10 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 duration-100">
            <Popover.Title className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              On this page
            </Popover.Title>
            <nav aria-label="Note outline">
              <ol className="space-y-0.5">
                {headings.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setOpen(false);
                        onJump(h.id);
                      }}
                      className={`w-full text-left rounded-lg px-2 py-1.5 text-xs leading-snug hover:bg-muted outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                        h.level === minLevel ? 'font-semibold text-foreground' : 'text-foreground/85'
                      }`}
                      style={{ paddingLeft: `${8 + (h.level - minLevel) * 12}px` }}
                    >
                      {h.text || 'Untitled section'}
                    </button>
                  </li>
                ))}
              </ol>
            </nav>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
};

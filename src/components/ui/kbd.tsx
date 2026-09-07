import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Keyboard shortcut affordance in the editorial design language. One shared
 * element so every ⌘K / 1–5 / Esc hint looks identical and sits on the same
 * control-height scale as Button/Badge, instead of a hand-rolled inline
 * <kbd> per call site.
 */
export function Kbd({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5',
        'rounded-md border border-border bg-background shadow-2xs',
        'font-mono text-[10px] font-medium leading-none text-muted-foreground',
        'whitespace-nowrap select-none',
        className
      )}
    >
      {children}
    </kbd>
  );
}

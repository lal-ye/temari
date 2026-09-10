import React from 'react';
import type { LucideIcon } from 'lucide-react';
import { AsciiSurface } from '../landing/AsciiSurface';
import { FIGURE } from '../diagrams/figureTokens';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  /** One sentence on what this screen will hold and how to fill it. */
  description: string;
  /** The primary way out of the empty state. */
  action?: React.ReactNode;
  className?: string;
}

/**
 * The "nothing here yet" state, shared by Notes, Quizzes, Exams and the
 * Planner.
 *
 * Every screen had its own copy of this panel, which drifted in padding, icon
 * size and tone. An empty state is the first thing a new learner sees on each
 * screen, so it is worth designing once: say what belongs here, then give them
 * the single action that creates it.
 *
 * Audit phase 8: an empty screen should feel *idle*, not *broken* — a small
 * ASCII surface breathes behind the copy. It speaks the figure language, not
 * the landing's display language (ADR-0011): figureTokens paper/accent/ink,
 * resting in the REST band the contrast model solves. Under
 * prefers-reduced-motion the hook renders one still frame.
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div
    className={`relative overflow-hidden bg-card border border-border/80 rounded-2xl shadow-xs ${className}`}
  >
    <AsciiSurface
      composition="panel"
      surface={FIGURE.paper}
      accent={FIGURE.accent}
      deep={FIGURE.ink}
      restInk={FIGURE.muted}
      fps={10}
      targetCellPx={10}
    />
    <div className="relative p-10 text-center">
      <Icon className="w-10 h-10 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1.5 mb-5">{description}</p>
      {action}
    </div>
  </div>
);

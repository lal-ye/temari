import React from 'react';
import type { LucideIcon } from 'lucide-react';

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
 */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = '',
}) => (
  <div
    className={`bg-card border border-border/80 rounded-2xl p-10 text-center shadow-xs ${className}`}
  >
    <Icon className="w-10 h-10 mx-auto text-muted-foreground mb-3" aria-hidden="true" />
    <h3 className="text-base font-semibold text-foreground">{title}</h3>
    <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-1.5 mb-5">{description}</p>
    {action}
  </div>
);

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
    className={`bg-white border-3 border-slate-900 rounded-2xl p-12 text-center shadow-neo ${className}`}
  >
    <Icon className="w-12 h-12 mx-auto text-slate-400 mb-3" aria-hidden="true" />
    <h3 className="text-base font-black text-slate-900">{title}</h3>
    <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto mt-1 mb-5">{description}</p>
    {action}
  </div>
);

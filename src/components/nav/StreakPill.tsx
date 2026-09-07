import React from 'react';
import { Flame } from 'lucide-react';
import type { StudyStreak } from '../../utils/analytics';

interface StreakPillProps {
  streak: StudyStreak;
  message: string;
}

/**
 * The study streak header pill.
 * Clean, subtle academic ochre accent with honest metrics derived from attempts.
 */
export const StreakPill: React.FC<StreakPillProps> = ({ streak, message }) => {
  const label =
    streak.days > 0 ? `${streak.days}-day streak` : 'No streak yet';

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 bg-amber-500/10 border border-amber-500/25 rounded-lg text-amber-900 dark:text-amber-200 shadow-xs"
      title={`${label}. ${message}`}
    >
      <Flame
        className={`w-3.5 h-3.5 shrink-0 ${
          streak.days > 0 ? 'text-amber-600 dark:text-amber-400 fill-amber-500/40' : 'text-muted-foreground'
        }`}
        aria-hidden="true"
      />
      <span className="text-xs font-semibold tabular-nums text-foreground">
        {streak.days > 0 ? streak.days : '0'}
      </span>
      <span className="sr-only">{`${label}. ${message}`}</span>
      <span
        className="text-[10px] font-medium text-muted-foreground tabular-nums border-l border-amber-500/30 pl-1.5"
        aria-hidden="true"
      >
        {streak.daysThisWeek}/7
      </span>
    </div>
  );
};

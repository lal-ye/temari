import React from 'react';
import { Flame } from 'lucide-react';
import type { StudyStreak } from '../../utils/analytics';

interface StreakPillProps {
  streak: StudyStreak;
  message: string;
}

/**
 * The study streak, condensed from the removed sidebar's full-width card into
 * a header pill.
 *
 * The sidebar version had room for a progress bar and a sentence. Here only
 * the two numbers stay visible; the sentence moves into the tooltip and the
 * accessible name, so the honest messaging survives the move rather than being
 * dropped for space. Numbers are still computed from real Attempts.
 */
export const StreakPill: React.FC<StreakPillProps> = ({ streak, message }) => {
  const label =
    streak.days > 0 ? `${streak.days}-day streak` : 'No streak yet';

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 pl-2 pr-2.5 py-1.5 bg-[#FEF08A] border-2 border-slate-900 rounded-xl shadow-neo-sm"
      title={`${label}. ${message}`}
    >
      <Flame
        className={`w-3.5 h-3.5 shrink-0 ${
          streak.days > 0 ? 'text-amber-600 fill-amber-600' : 'text-slate-400'
        }`}
        aria-hidden="true"
      />
      <span className="text-[11px] font-black text-slate-950 tabular-nums">
        {streak.days > 0 ? streak.days : '0'}
      </span>
      <span className="sr-only">{`${label}. ${message}`}</span>
      <span
        className="text-[10px] font-bold text-slate-700 tabular-nums border-l-2 border-slate-900/20 pl-1.5"
        aria-hidden="true"
      >
        {streak.daysThisWeek}/7
      </span>
    </div>
  );
};

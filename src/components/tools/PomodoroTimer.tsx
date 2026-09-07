import React from 'react';
import { Play, Pause, RotateCcw, Flame, X, Coffee, Brain } from 'lucide-react';
import { useSettings } from '../../hooks/useStudyStore';
import { usePomodoro } from '../../hooks/usePomodoro';
import { Button } from '../ui/button';

interface PomodoroTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Accent per timer mode, used for both the segmented control and the progress fill. */
const MODE_ACCENT = {
  work: {
    active: 'text-amber-700 dark:text-amber-400',
    fill: 'bg-amber-500',
  },
  break: {
    active: 'text-emerald-700 dark:text-emerald-400',
    fill: 'bg-emerald-500',
  },
  longBreak: {
    active: 'text-sky-700 dark:text-sky-400',
    fill: 'bg-sky-500',
  },
} as const;

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ isOpen, onClose }) => {
  const settings = useSettings();
  const {
    mode,
    isRunning,
    sessionsCompleted,
    progressPercent,
    formattedTime,
    toggleTimer,
    resetTimer,
    setMode,
  } = usePomodoro(settings);

  if (!isOpen) return null;

  const accent = MODE_ACCENT[mode];

  return (
    <div className="fixed bottom-6 right-6 z-40 w-84 bg-card border border-border rounded-2xl p-5 shadow-lg animate-in slide-in-from-bottom-5 duration-150">
      <div className="flex items-center justify-between pb-3 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg">
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider leading-tight flex items-center gap-1">
              <span className="font-ethiopic font-semibold normal-case text-sm text-amber-600 dark:text-amber-400">ተማሪ</span> Focus Timer
            </h4>
            <span className="text-[10px] font-medium text-muted-foreground">
              Streak: <span className="font-mono tabular-nums">{sessionsCompleted}</span> sessions
            </span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg border border-border transition-colors"
          aria-label="Close focus timer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center gap-1 my-4 p-1 bg-muted/60 border border-border rounded-xl">
        {(
          [
            ['work', <Brain key="i" className="w-3.5 h-3.5" />, 'Focus'],
            ['break', <Coffee key="i" className="w-3.5 h-3.5" />, 'Short'],
            ['longBreak', <Coffee key="i" className="w-3.5 h-3.5" />, 'Long'],
          ] as const
        ).map(([value, icon, label]) => {
          const isActive = mode === value;
          return (
            <button
              key={value}
              onClick={() => setMode(value)}
              aria-pressed={isActive}
              className={`flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-medium rounded-lg transition-colors outline-hidden focus-visible:ring-2 focus-visible:ring-ring ${
                isActive
                  ? `bg-card border border-border shadow-2xs font-semibold ${MODE_ACCENT[value].active}`
                  : 'border border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {icon} {label}
            </button>
          );
        })}
      </div>

      <div className="my-4 text-center">
        <div className="relative inline-flex items-center justify-center p-3 bg-muted/40 border border-border rounded-2xl w-full">
          <div
            className="text-4xl font-bold text-foreground font-mono tracking-tight tabular-nums"
            role="timer"
            aria-live="off"
          >
            {formattedTime}
          </div>
        </div>
        <div className="w-full bg-muted h-2.5 rounded-full mt-3 overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${accent.fill}`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-2 pt-1">
        <Button onClick={toggleTimer} className="flex-1 h-9">
          {isRunning ? <Pause className="size-4 fill-current" /> : <Play className="size-4 fill-current" />}
          {isRunning ? 'Pause' : 'Start Focus'}
        </Button>

        <Button variant="outline" size="icon-lg" onClick={resetTimer} title="Reset timer" aria-label="Reset timer">
          <RotateCcw className="size-4" />
        </Button>
      </div>
    </div>
  );
};

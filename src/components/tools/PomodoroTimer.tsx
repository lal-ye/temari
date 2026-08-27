import React from 'react';
import { Play, Pause, RotateCcw, Flame, X, Coffee, Brain } from 'lucide-react';
import { StorageService } from '../../services/storage';
import { usePomodoro } from '../../hooks/usePomodoro';

interface PomodoroTimerProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({ isOpen, onClose }) => {
  const settings = StorageService.getSettings();
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

  return (
    <div className="fixed bottom-6 right-6 z-40 w-84 bg-white border-3 border-slate-900 rounded-2xl p-5 shadow-neo-xl animate-in slide-in-from-bottom-5 duration-150">
      <div className="flex items-center justify-between pb-3 border-b-2 border-slate-900">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-yellow-300 border-2 border-slate-900 text-slate-950 rounded-xl shadow-neo-sm">
            <Flame className="w-4 h-4 fill-current" />
          </div>
          <div>
            <h4 className="text-xs font-black text-slate-950 uppercase tracking-wider leading-tight">
              ተማሪ Focus Timer
            </h4>
            <span className="text-[10px] font-bold text-slate-600">Streak: {sessionsCompleted} sessions</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-700 hover:text-slate-950 rounded-lg hover:bg-slate-100 border border-transparent hover:border-slate-900 transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex justify-center gap-1.5 my-4 p-1.5 bg-slate-100 border-2 border-slate-900 rounded-xl">
        <button
          onClick={() => setMode('work')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
            mode === 'work'
              ? 'bg-yellow-300 text-slate-950 border-2 border-slate-900 shadow-neo-sm'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Brain className="w-3.5 h-3.5" /> Focus
        </button>
        <button
          onClick={() => setMode('break')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
            mode === 'break'
              ? 'bg-emerald-300 text-slate-950 border-2 border-slate-900 shadow-neo-sm'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" /> Short
        </button>
        <button
          onClick={() => setMode('longBreak')}
          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-black rounded-lg transition-all ${
            mode === 'longBreak'
              ? 'bg-cyan-300 text-slate-950 border-2 border-slate-900 shadow-neo-sm'
              : 'text-slate-600 hover:text-slate-950'
          }`}
        >
          <Coffee className="w-3.5 h-3.5" /> Long
        </button>
      </div>

      <div className="my-4 text-center">
        <div className="relative inline-flex items-center justify-center p-3 bg-[#FAF8F5] border-2 border-slate-900 rounded-2xl w-full shadow-neo-sm">
          <div className="text-4xl font-black text-slate-950 font-mono tracking-tight">{formattedTime}</div>
        </div>
        <div className="w-full bg-slate-200 h-2.5 rounded-full mt-3 overflow-hidden border-2 border-slate-900">
          <div
            className={`h-full transition-all duration-500 ${
              mode === 'work' ? 'bg-yellow-400' : mode === 'break' ? 'bg-emerald-400' : 'bg-cyan-400'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-center gap-3 pt-1">
        <button
          onClick={toggleTimer}
          className={`flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black border-2 border-slate-900 shadow-neo transition-all active:translate-y-0.5 ${
            isRunning
              ? 'bg-rose-300 text-slate-950 hover:bg-rose-200'
              : 'bg-yellow-300 text-slate-950 hover:bg-yellow-200'
          }`}
        >
          {isRunning ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current" />}
          {isRunning ? 'Pause' : 'Start Focus'}
        </button>

        <button
          onClick={resetTimer}
          className="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl border-2 border-slate-900 text-slate-900 shadow-neo-sm transition-all active:translate-y-0.5"
          title="Reset timer"
          aria-label="Reset timer"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};


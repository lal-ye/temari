import { useState, useEffect, useRef, useCallback } from 'react';
import { UserSettings } from '../types';

export type PomodoroMode = 'work' | 'break' | 'longBreak';

export interface UsePomodoroReturn {
  mode: PomodoroMode;
  timeLeft: number;
  isRunning: boolean;
  sessionsCompleted: number;
  progressPercent: number;
  formattedTime: string;
  startTimer: () => void;
  pauseTimer: () => void;
  toggleTimer: () => void;
  resetTimer: () => void;
  setMode: (mode: PomodoroMode) => void;
}

/**
 * Deep hook for Pomodoro timer management with Web Audio chime synthesis.
 */
export function usePomodoro(settings: UserSettings): UsePomodoroReturn {
  const [mode, setModeState] = useState<PomodoroMode>('work');
  const [timeLeft, setTimeLeft] = useState<number>(settings.pomodoroWorkMinutes * 60);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [sessionsCompleted, setSessionsCompleted] = useState<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getDurationForMode = useCallback(
    (targetMode: PomodoroMode): number => {
      if (targetMode === 'work') return settings.pomodoroWorkMinutes * 60;
      if (targetMode === 'break') return settings.pomodoroBreakMinutes * 60;
      return settings.pomodoroLongBreakMinutes * 60;
    },
    [settings.pomodoroWorkMinutes, settings.pomodoroBreakMinutes, settings.pomodoroLongBreakMinutes]
  );

  const playChime = useCallback(() => {
    if (!settings.soundEnabled) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.3); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.8);
    } catch {
      // Ignore audio failure in restricted environments
    }
  }, [settings.soundEnabled]);

  const setMode = useCallback(
    (newMode: PomodoroMode) => {
      setModeState(newMode);
      setTimeLeft(getDurationForMode(newMode));
      setIsRunning(false);
    },
    [getDurationForMode]
  );

  useEffect(() => {
    setTimeLeft(getDurationForMode(mode));
  }, [mode, getDurationForMode]);

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            playChime();
            if (mode === 'work') {
              setSessionsCompleted((s) => {
                const nextCount = s + 1;
                setModeState(nextCount > 0 && nextCount % 4 === 0 ? 'longBreak' : 'break');
                return nextCount;
              });
            } else {
              setModeState('work');
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, mode, playChime]);

  const startTimer = useCallback(() => setIsRunning(true), []);
  const pauseTimer = useCallback(() => setIsRunning(false), []);
  const toggleTimer = useCallback(() => setIsRunning((prev) => !prev), []);
  const resetTimer = useCallback(() => {
    setIsRunning(false);
    setTimeLeft(getDurationForMode(mode));
  }, [getDurationForMode, mode]);

  const minutes = Math.floor(timeLeft / 60);
  const seconds = timeLeft % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const totalTime = getDurationForMode(mode);
  const progressPercent = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return {
    mode,
    timeLeft,
    isRunning,
    sessionsCompleted,
    progressPercent,
    formattedTime,
    startTimer,
    pauseTimer,
    toggleTimer,
    resetTimer,
    setMode,
  };
}

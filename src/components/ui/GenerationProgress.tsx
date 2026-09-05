import React, { useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '../../utils/viewTransition';

export type GenerationKind = 'notes' | 'quiz' | 'exam' | 'explanation' | 'grading';

/** Stage labels per generation kind. Order is the order they are entered. */
const STAGES: Record<GenerationKind, string[]> = {
  notes: ['Reading material', 'Structuring sections', 'Writing the note'],
  quiz: ['Reading material', 'Picking testable ideas', 'Writing flashcards'],
  exam: ['Reading material', 'Balancing question types', 'Writing questions'],
  explanation: ['Reading the term', 'Finding a plain-language angle'],
  grading: ['Reading answers', 'Scoring against the key', 'Writing feedback'],
};

/**
 * How long each stage is *displayed* before advancing to the next. These are
 * presentation pacing, not measurements — the AI port gives us no progress
 * events, so claiming a percentage would be a lie. The last stage stays put
 * until the promise settles, so a slow Provider never shows "done" early.
 */
const STAGE_MS = 2200;

interface GenerationProgressProps {
  kind: GenerationKind;
  /** Shown under the stages; use it to name the Subject or Material. */
  detail?: string;
  className?: string;
}

/**
 * The waiting state for a Generation.
 *
 * Generation is the app's most novel moment and one of its slowest, so it earns
 * real feedback rather than a bare spinner: what is happening now, what is
 * still to come, and how long it has taken. Elapsed time is the honest signal
 * when no progress events exist — it tells the learner the request is alive and
 * lets them judge whether to keep waiting.
 *
 * This is an occasional interaction, so it sits in the "standard animation"
 * tier of the motion budget (DEVELOPING.md).
 */
export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  kind,
  detail,
  className = '',
}) => {
  const stages = STAGES[kind];
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    startedAt.current = Date.now();
    const tick = window.setInterval(() => {
      const elapsed = Date.now() - startedAt.current;
      setElapsedMs(elapsed);
      // Hold on the final stage; never claim completion we cannot observe.
      setStageIndex(Math.min(Math.floor(elapsed / STAGE_MS), stages.length - 1));
    }, 100);
    return () => window.clearInterval(tick);
  }, [stages.length]);

  const seconds = (elapsedMs / 1000).toFixed(1);
  const reduced = prefersReducedMotion();

  return (
    <div
      className={`bg-[#FAF8F5] border-2 border-slate-900 rounded-xl p-4 shadow-neo-sm ${className}`}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="badge-chip text-slate-900">Generating</span>
        <span
          className="text-[11px] font-mono font-bold text-slate-600 tabular-nums"
          aria-label={`${seconds} seconds elapsed`}
        >
          {seconds}s
        </span>
      </div>

      <ol className="space-y-1.5">
        {stages.map((stage, i) => {
          const done = i < stageIndex;
          const active = i === stageIndex;
          return (
            <li key={stage} className="flex items-center gap-2.5">
              <span
                className={`w-2.5 h-2.5 rounded-full border-2 border-slate-900 shrink-0 ${
                  done ? 'bg-emerald-400' : active ? 'bg-yellow-300' : 'bg-white'
                } ${active && !reduced ? 'generation-stage-pulse' : ''}`}
                aria-hidden="true"
              />
              <span
                className={`text-xs font-bold ${
                  done ? 'text-slate-500' : active ? 'text-slate-950' : 'text-slate-400'
                }`}
              >
                {stage}
                {active && <span className="generation-ellipsis" aria-hidden="true" />}
              </span>
            </li>
          );
        })}
      </ol>

      {detail && (
        <p className="mt-3 pt-2.5 border-t border-slate-200 text-[11px] font-bold text-slate-600">
          {detail}
        </p>
      )}
    </div>
  );
};

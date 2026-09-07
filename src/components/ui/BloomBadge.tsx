import React from 'react';
import { BloomLevel } from '../../types';
import { BLOOM_LABELS } from '../../services/examBlueprint';

/**
 * Cognitive-level badge.
 *
 * One pill, three screens (exam taking, results, analytics), so the colour a
 * learner associates with "Analyze" never changes between them. Unlevelled
 * items — attempts recorded before cognitive levels existed — render a muted
 * "—" rather than a guessed level, because a wrong level quietly corrupts how
 * the learner reads their own mastery.
 */

const TONE: Record<BloomLevel | 'unlevelled', string> = {
  remember: 'bg-muted/70 text-muted-foreground border-border',
  understand: 'bg-sky-500/10 text-sky-700 dark:text-sky-400 border-sky-500/20',
  apply: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  analyze: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  evaluate: 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20',
  create: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  unlevelled: 'bg-muted/50 text-muted-foreground border-border',
};

interface BloomBadgeProps {
  level?: BloomLevel;
  /** Compact form for tight rows (analytics grid, palette). */
  size?: 'sm' | 'md';
  /** Show the full level name instead of the short badge label. */
  verbose?: boolean;
  className?: string;
}

export const BloomBadge: React.FC<BloomBadgeProps> = ({
  level,
  size = 'sm',
  verbose = false,
  className = '',
}) => {
  const key: BloomLevel | 'unlevelled' = level && TONE[level] ? level : 'unlevelled';
  const label = level ? (verbose ? level : BLOOM_LABELS[level]) : 'Unlevelled';

  return (
    <span
      title={level ? `Bloom level: ${BLOOM_LABELS[level]}` : 'No cognitive level recorded'}
      className={`inline-flex items-center rounded-md border font-semibold uppercase tracking-wider whitespace-nowrap ${
        TONE[key]
      } ${size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[11px]'} ${className}`}
    >
      {label}
    </span>
  );
};

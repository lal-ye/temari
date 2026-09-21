import React, { useId, useMemo, useState } from 'react';
import type { BloomLevel } from '../../types';
import { BLOOM_LEVELS } from '../../types';
import type { TopicLevelStat } from '../../utils/analytics';
import { buildBloomMatrix } from '../../utils/bloomHeat';
import { Layers } from 'lucide-react';

const LABELS: Record<BloomLevel, string> = {
  remember: 'Remember', understand: 'Understand', apply: 'Apply',
  analyze: 'Analyze', evaluate: 'Evaluate', create: 'Create',
};

/** Accuracy and sample size, not a claim of mastery. No hover required. */
export const BloomHeatmap: React.FC<{ stats: TopicLevelStat[] }> = ({ stats }) => {
  const matrix = useMemo(() => buildBloomMatrix(stats), [stats]);
  const [selection, setSelection] = useState<{ topic: string; level: BloomLevel } | null>(null);
  const headingId = useId();
  const helpId = useId();
  const detailId = useId();
  const selectedCell = matrix.rows.flat().find(cell =>
    cell.topic === selection?.topic && cell.level === selection?.level);
  if (matrix.topics.length === 0) return null;

  return (
    <section aria-labelledby={headingId} className="min-w-0 bg-card border border-border/80 rounded-2xl p-4 sm:p-6 shadow-xs">
      <h3 id={headingId} className="text-sm font-semibold text-foreground flex items-start gap-2">
        <Layers className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        Accuracy by Topic &amp; Cognitive Level
      </h3>
      <p id={helpId} className="text-xs text-muted-foreground mt-2 leading-relaxed">
        Percentage of answers correct · — = no answers. Darker cells mean higher accuracy.
        Tap a percentage for details. Scroll sideways to see all levels.
      </p>
      <div role="region" aria-label="Topic accuracy table" aria-describedby={helpId} tabIndex={0}
        className="mt-4 max-w-full overflow-x-auto rounded-lg focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
        <table className="w-full min-w-[48rem] table-fixed border-separate border-spacing-0 text-xs">
          <caption className="sr-only">Accuracy and answer counts for up to six topics with the most recorded answers, by cognitive level.</caption>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 w-40 bg-card border-b border-border p-3 text-left font-medium text-muted-foreground">Topic</th>
              {BLOOM_LEVELS.map(level => (
                <th key={level} scope="col" className="border-b border-border px-2 py-3 text-center font-medium text-foreground">
                  {LABELS[level]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.rows.map(row => (
              <tr key={row[0].topic}>
                <th scope="row" className="sticky left-0 z-10 bg-card border-b border-border/50 p-3 text-left font-medium text-foreground break-words leading-relaxed">
                  {row[0].topic}
                </th>
                {row.map(cell => {
                  const active = selectedCell === cell;
                  return (
                    <td key={cell.level} className="border-b border-border/50 p-1.5 text-center align-middle">
                      {cell.accuracy === null ? (
                        <span aria-label={`${cell.topic}, ${LABELS[cell.level]}: no answers`} className="text-muted-foreground">—</span>
                      ) : (
                        <button type="button"
                          aria-label={`${cell.topic}, ${LABELS[cell.level]}: ${cell.accuracy}% accuracy, ${cell.attempts} ${cell.attempts === 1 ? 'answer' : 'answers'}`}
                          aria-expanded={active} aria-controls={detailId}
                          onClick={() => setSelection(active ? null : { topic: cell.topic, level: cell.level })}
                          style={{ backgroundColor: `rgb(217 119 6 / ${0.04 + cell.accuracy / 100 * 0.2})` }}
                          className="w-full min-h-11 rounded-md px-1 py-2 text-foreground hover:ring-1 hover:ring-ring focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2">
                          <span className="block font-semibold tabular-nums">{cell.accuracy}%</span>
                          <span className="block mt-1 text-[0.65rem] text-muted-foreground tabular-nums">
                            {cell.attempts} {cell.attempts === 1 ? 'answer' : 'answers'}
                          </span>
                        </button>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div id={detailId} role="status" aria-live="polite" aria-atomic="true">
        {selectedCell && selectedCell.accuracy !== null && (
          <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-relaxed text-foreground break-words">
            <strong>{selectedCell.topic}</strong> · {LABELS[selectedCell.level]}: {selectedCell.accuracy}% accuracy
            {' '}across {selectedCell.attempts} recorded {selectedCell.attempts === 1 ? 'answer' : 'answers'}.
          </p>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
        Showing up to six most-answered topics. A small number of answers is not proof of mastery.
      </p>
    </section>
  );
};

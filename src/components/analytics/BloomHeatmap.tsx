import React, { useMemo } from 'react';
import { BLOOM_LEVELS, type BloomLevel } from '../../types';
import type { TopicLevelStat } from '../../utils/analytics';
import { buildBloomMatrix, glyphForAccuracy } from '../../utils/bloomHeat';
import { BLOOM_TINTS } from '../diagrams/figureTokens';
import { Layers } from 'lucide-react';

/** Column captions; the full level name rides in the title attribute. */
const SHORT: Record<BloomLevel, string> = {
  remember: 'REM',
  understand: 'UND',
  apply: 'APP',
  analyze: 'ANA',
  evaluate: 'EVA',
  create: 'CRE',
};

/**
 * The Bloom mastery matrix as an ASCII density figure (audit phase 8):
 * cell glyph = accuracy, cell tint = cognitive level, `·` = no attempts yet.
 *
 * It renders the topic × level axis the bar charts flatten away, and it is a
 * figure in ADR-0010's sense — text on paper, no charting runtime. The maths
 * live in `utils/bloomHeat.ts` (node-tested); the tints in figureTokens.
 */
export const BloomHeatmap: React.FC<{ stats: TopicLevelStat[] }> = ({ stats }) => {
  const matrix = useMemo(() => buildBloomMatrix(stats), [stats]);
  if (matrix.topics.length === 0) return null;

  return (
    <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-xs">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Layers className="w-4 h-4 text-amber-600 dark:text-amber-400" aria-hidden="true" />
        Bloom Mastery Matrix
      </h3>
      <p className="text-xs text-muted-foreground mt-0.5">
        Glyph density = accuracy · tint = cognitive level · · = no attempts
      </p>

      <table className="mt-4 border-separate border-spacing-y-1 font-mono text-sm leading-none">
        <caption className="sr-only">
          Accuracy per topic and cognitive level, densest glyph means highest accuracy.
        </caption>
        <thead>
          <tr>
            <th scope="col" className="pr-3 text-left text-[0.6rem] font-sans font-medium text-muted-foreground uppercase tracking-wider">
              Topic
            </th>
            {BLOOM_LEVELS.map((level) => (
              <th
                key={level}
                scope="col"
                title={level}
                className="px-1 text-[0.6rem] font-sans font-medium uppercase tracking-wider"
                style={{ color: BLOOM_TINTS[level] }}
              >
                {SHORT[level]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row[0].topic}>
              <th
                scope="row"
                className="pr-3 text-left text-xs font-sans font-medium text-muted-foreground max-w-[10rem] truncate"
                title={row[0].topic}
              >
                {row[0].topic}
              </th>
              {row.map((cell) => (
                <td key={cell.level} className="px-1 text-center">
                  <span
                    title={
                      cell.accuracy === null
                        ? `${cell.topic} · ${cell.level}: no attempts yet`
                        : `${cell.topic} · ${cell.level}: ${cell.accuracy}% (${cell.attempts} answers)`
                    }
                    style={cell.accuracy === null ? undefined : { color: BLOOM_TINTS[cell.level] }}
                    className={cell.accuracy === null ? 'text-muted-foreground/50' : undefined}
                  >
                    {cell.accuracy === null ? '·' : glyphForAccuracy(cell.accuracy)}
                  </span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

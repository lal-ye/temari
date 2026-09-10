import { BLOOM_LEVELS, type BloomLevel } from '../types';
import { glyphFor } from '../components/landing/asciiFieldMath';
import type { TopicLevelStat } from './analytics';

/**
 * Pure maths for the Bloom mastery heatmap figure (audit phase 8).
 *
 * The dashboard's `topicLevelStats` is the topic × cognitive-level axis the
 * app was missing; this turns it into a matrix the view renders as an ASCII
 * density figure — cell glyph = accuracy, cell tint = cognitive level
 * (BLOOM_TINTS in figureTokens). A figure in ADR-0010's sense: no charting
 * runtime, just text.
 */

/** Sparsest-to-densest heat ramp; monospace-safe ASCII only. */
export const HEAT_RAMP = '.,:;i+*#%@';

/** Key separator: a byte no topic name can contain. */
const SEP = '\u0000';

export interface BloomCell {
  topic: string;
  level: BloomLevel;
  /** null when the learner has no attempts at this topic × level. */
  accuracy: number | null;
  attempts: number;
}

export interface BloomMatrix {
  topics: string[];
  /** One row per topic, cells in BLOOM_LEVELS order. */
  rows: BloomCell[][];
}

/** Cell glyph: accuracy 0–100 mapped onto the heat ramp. */
export function glyphForAccuracy(accuracy: number): string {
  return glyphFor(accuracy / 100, HEAT_RAMP);
}

/**
 * Rank topics by total attempts (busiest first) and keep `maxTopics`, then
 * lay out every (topic × level) cell in BLOOM_LEVELS order. Legacy
 * `unlevelled` stats are ignored — they have no column to sit in.
 */
export function buildBloomMatrix(stats: TopicLevelStat[], maxTopics = 6): BloomMatrix {
  const levelled = stats.filter((s) => s.level !== 'unlevelled');

  const attemptsByTopic = new Map<string, number>();
  for (const s of levelled) {
    attemptsByTopic.set(s.topic, (attemptsByTopic.get(s.topic) ?? 0) + s.total);
  }

  const topics = [...attemptsByTopic.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, maxTopics)
    .map(([topic]) => topic);

  const byKey = new Map<string, TopicLevelStat>();
  for (const s of levelled) byKey.set(s.topic + SEP + s.level, s);

  const rows = topics.map((topic) =>
    BLOOM_LEVELS.map((level) => {
      const s = byKey.get(topic + SEP + level);
      return {
        topic,
        level,
        accuracy: s ? s.accuracy : null,
        attempts: s ? s.total : 0,
      } satisfies BloomCell;
    })
  );

  return { topics, rows };
}

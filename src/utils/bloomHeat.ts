import { BLOOM_LEVELS, type BloomLevel } from '../types';
import type { TopicLevelStat } from './analytics';

/** Build the topic × cognitive-level matrix; presentation lives in BloomHeatmap. */

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

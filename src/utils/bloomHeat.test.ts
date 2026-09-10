import { describe, it, expect } from 'vitest';
import { BLOOM_LEVELS } from '../types';
import type { TopicLevelStat } from './analytics';
import { HEAT_RAMP, buildBloomMatrix, glyphForAccuracy } from './bloomHeat';

const stat = (
  topic: string,
  level: TopicLevelStat['level'],
  correct: number,
  total: number
): TopicLevelStat => ({
  topic,
  level,
  correct,
  total,
  accuracy: Math.round((correct / total) * 100),
});

describe('glyphForAccuracy', () => {
  it('maps the extremes of the ramp', () => {
    expect(glyphForAccuracy(0)).toBe(HEAT_RAMP[0]);
    expect(glyphForAccuracy(100)).toBe(HEAT_RAMP[HEAT_RAMP.length - 1]);
  });

  it('is monotone: better accuracy never yields a sparser glyph', () => {
    let last = -1;
    for (let a = 0; a <= 100; a += 5) {
      const idx = HEAT_RAMP.indexOf(glyphForAccuracy(a));
      expect(idx).toBeGreaterThanOrEqual(last);
      last = idx;
    }
  });
});

describe('buildBloomMatrix', () => {
  const stats = [
    stat('Glycolysis', 'remember', 9, 10),
    stat('Glycolysis', 'apply', 4, 10),
    stat('Krebs cycle', 'remember', 5, 10),
    stat('ETC', 'analyze', 2, 10),
    // Legacy attempts carry no level; they have no column to sit in.
    stat('Krebs cycle', 'unlevelled', 7, 10),
  ];

  it('lays out every kept topic as one row of BLOOM_LEVELS cells, in order', () => {
    const m = buildBloomMatrix(stats);
    expect(m.topics).toHaveLength(3);
    for (const row of m.rows) {
      expect(row.map((c) => c.level)).toEqual([...BLOOM_LEVELS]);
    }
  });

  it('marks unattempted topic × level cells null', () => {
    const m = buildBloomMatrix(stats);
    const glycolysis = m.rows[m.topics.indexOf('Glycolysis')];
    expect(glycolysis[0]).toMatchObject({ level: 'remember', accuracy: 90 });
    expect(glycolysis[1]).toMatchObject({ level: 'understand', accuracy: null });
  });

  it('keeps the busiest topics when more exist than maxTopics', () => {
    const m = buildBloomMatrix(stats, 2);
    // Glycolysis (20 attempts) is first; Krebs cycle and ETC tie at 10 and the
    // deterministic tie-break is alphabetical ('ETC' < 'Krebs cycle').
    expect(m.topics).toEqual(['Glycolysis', 'ETC']);
  });

  it('ignores unlevelled stats in ranking and cells', () => {
    const only = buildBloomMatrix([stat('Solo', 'unlevelled', 5, 5)]);
    expect(only.topics).toHaveLength(0);
    expect(only.rows).toHaveLength(0);
  });
});

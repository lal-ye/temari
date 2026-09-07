import { describe, expect, it } from 'vitest';
import {
  buildBloomPlan,
  buildExamBlueprint,
  DEDUPE_THRESHOLD,
  dedupeQuestions,
  distributionOf,
  enforceDistribution,
  levelRank,
  orderExamQuestions,
  previouslySeenStems,
  shuffleExamOptions,
  stemSimilarity,
  COGNITIVE_MIXES,
} from './examBlueprint';
import { BloomLevel, CognitiveMixId, ExamQuestion, StoredAttempt } from '../types';

/**
 * Interface tests for the Exam-Blueprint module. These assert the guarantees
 * feature screens rely on — the quota sums, coverage is not silently dropped,
 * ordering is ascending with topics interleaved, and shuffling cannot break
 * grading — not the allocation arithmetic itself.
 */

function q(
  id: string,
  over: Partial<ExamQuestion> = {}
): ExamQuestion {
  return {
    id,
    question: `Question ${id}`,
    type: 'multiple_choice',
    options: ['Alpha', 'Beta', 'Gamma', 'Delta'],
    correctAnswer: 'Alpha',
    topic: 'General',
    ...over,
  };
}

const MIX_IDS = Object.keys(COGNITIVE_MIXES) as CognitiveMixId[];

describe('buildBloomPlan', () => {
  it('allocates exactly the number of questions asked for', () => {
    // The invariant everything else depends on: naive rounding drifts, so a
    // 15-question exam must not come back with 14 or 16 questions planned.
    MIX_IDS.forEach((mix) => {
      for (let count = 1; count <= 40; count += 1) {
        const sum = buildBloomPlan(count, mix).reduce((acc, slot) => acc + slot.count, 0);
        expect(sum, `${mix} @ ${count}`).toBe(count);
      }
    });
  });

  it('gives every weighted level at least one question when affordable', () => {
    // 15 * (1/16) floors to 0, so without the coverage floor a 15-question
    // balanced exam would silently contain no Create items at all.
    const plan = buildBloomPlan(15, 'balanced');
    const byLevel = Object.fromEntries(plan.map((s) => [s.level, s.count]));

    expect(byLevel.create).toBe(1);
    Object.keys(COGNITIVE_MIXES.balanced.weights).forEach((level) => {
      expect(byLevel[level], level).toBeGreaterThanOrEqual(1);
    });
  });

  it('omits levels the mix does not use', () => {
    const plan = buildBloomPlan(20, 'recall');
    const levels = plan.map((s) => s.level);
    expect(levels).not.toContain('analyze');
    expect(levels).not.toContain('evaluate');
    expect(levels).not.toContain('create');
  });

  it('returns levels in ascending cognitive order', () => {
    const ranks = buildBloomPlan(15, 'balanced').map((s) => levelRank(s.level));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
  });

  it('carries directive verbs so the prompt can name them', () => {
    const plan = buildBloomPlan(10, 'deep');
    plan.forEach((slot) => expect(slot.verb.length).toBeGreaterThan(0));
  });

  it('returns an empty plan for zero questions', () => {
    expect(buildBloomPlan(0, 'balanced')).toEqual([]);
  });

  it('survives a hand-built mix with every weight at zero', () => {
    // A degenerate mix would divide by zero; it falls back to balanced instead.
    const plan = buildBloomPlan(6, 'no-such-mix' as CognitiveMixId);
    expect(plan.reduce((acc, s) => acc + s.count, 0)).toBe(6);
  });
});

describe('enforceDistribution', () => {
  it('repairs a set that drifted from the quota without losing questions', () => {
    // The provider was asked for 1 create and 3 apply, and delivered 4 apply
    // and no create. The learner still gets the count they asked for.
    const plan = buildBloomPlan(4, 'balanced');
    const generated = [
      q('a', { bloomLevel: 'apply' }),
      q('b', { bloomLevel: 'apply' }),
      q('c', { bloomLevel: 'apply' }),
      q('d', { bloomLevel: 'apply' }),
      q('e', { bloomLevel: 'remember' }),
      q('f', { bloomLevel: 'understand' }),
      q('g', { bloomLevel: 'analyze' }),
    ];

    const repaired = enforceDistribution(generated, plan);

    expect(repaired).toHaveLength(4);
    // No question is counted twice.
    expect(new Set(repaired.map((r) => r.id)).size).toBe(4);
  });

  it('keeps unlevelled questions as filler rather than discarding them', () => {
    const plan = buildBloomPlan(3, 'recall');
    const generated = [q('x'), q('y'), q('z')]; // no bloomLevel at all

    const repaired = enforceDistribution(generated, plan);
    expect(repaired).toHaveLength(3);
  });

  it('returns the input unchanged when there is no plan', () => {
    const generated = [q('a'), q('b')];
    expect(enforceDistribution(generated, [])).toEqual(generated);
  });
});

describe('orderExamQuestions', () => {
  const questions = [
    q('1', { topic: 'Glycolysis', bloomLevel: 'remember' }),
    q('2', { topic: 'Glycolysis', bloomLevel: 'remember' }),
    q('3', { topic: 'Krebs Cycle', bloomLevel: 'remember' }),
    q('4', { topic: 'Glycolysis', bloomLevel: 'create' }),
    q('5', { topic: 'Krebs Cycle', bloomLevel: 'apply' }),
  ];

  it('orders cognitive level ascending, for progressive difficulty', () => {
    const ranks = orderExamQuestions(questions).map((x) => levelRank(x.bloomLevel));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    expect(ranks[ranks.length - 1]).toBe(levelRank('create'));
  });

  it('interleaves topics inside a level instead of blocking them', () => {
    const ordered = orderExamQuestions(questions);
    // The three Remember questions must alternate topics, not run Glycolysis,
    // Glycolysis, Krebs — blocked practice measurably hurts retention.
    const rememberTopics = ordered
      .filter((x) => x.bloomLevel === 'remember')
      .map((x) => x.topic);
    expect(rememberTopics).toEqual(['Glycolysis', 'Krebs Cycle', 'Glycolysis']);
  });

  it('treats unlevelled questions as the lowest level', () => {
    const ordered = orderExamQuestions([
      q('hi', { bloomLevel: 'evaluate' }),
      q('lo'),
    ]);
    expect(ordered.map((x) => x.id)).toEqual(['lo', 'hi']);
  });

  it('is deterministic and lossless', () => {
    const ordered = orderExamQuestions(questions);
    expect(ordered).toHaveLength(questions.length);
    expect(orderExamQuestions(questions)).toEqual(ordered);
  });
});

describe('shuffleExamOptions', () => {
  const mcq = (id: string, correct: string) =>
    q(id, { options: ['Alpha', 'Beta', 'Gamma', 'Delta'], correctAnswer: correct });

  it('never loses or alters the correct answer', () => {
    const shuffled = shuffleExamOptions([mcq('1', 'Gamma')], 42);
    expect(shuffled[0].options).toHaveLength(4);
    expect([...shuffled[0].options!].sort()).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma']);
    expect(shuffled[0].correctAnswer).toBe('Gamma');
  });

  it('moves the correct answer off a fixed position', () => {
    // Models cluster the correct answer at A/B, which becomes a cue that
    // survives retakes. Across an exam the position must actually vary.
    const questions = Array.from({ length: 24 }, (_, i) => mcq(`q${i}`, 'Beta'));
    const positions = new Set(
      shuffleExamOptions(questions, 7).map((x) => x.options!.indexOf(x.correctAnswer))
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it('is reproducible for a given seed', () => {
    const questions = Array.from({ length: 8 }, (_, i) => mcq(`q${i}`, 'Alpha'));
    expect(shuffleExamOptions(questions, 99)).toEqual(shuffleExamOptions(questions, 99));
  });

  it('leaves a question whose key is not among its options untouched', () => {
    // Scrambling one we cannot re-key would silently break grading.
    const broken = q('b', { options: ['Alpha', 'Beta'], correctAnswer: 'Not listed' });
    expect(shuffleExamOptions([broken], 1)[0]).toEqual(broken);
  });

  it('ignores true/false and short answer', () => {
    const tf = q('t', { type: 'true_false', options: ['true', 'false'], correctAnswer: 'true' });
    const sa = q('s', { type: 'short_answer', options: undefined, correctAnswer: 'Free text' });
    expect(shuffleExamOptions([tf, sa], 3)).toEqual([tf, sa]);
  });
});

describe('dedupeQuestions', () => {
  it('measures a reworded stem as near-identical', () => {
    expect(
      stemSimilarity(
        'Which enzyme catalyses the conversion of glucose to glucose-6-phosphate?',
        'Which enzyme catalyses the conversion of glucose into glucose-6-phosphate?'
      )
    ).toBeGreaterThanOrEqual(DEDUPE_THRESHOLD);
  });

  it('measures unrelated stems as dissimilar', () => {
    expect(stemSimilarity('Define glycolysis.', 'Compare mitosis with meiosis.')).toBeLessThan(0.3);
  });

  it('keeps a same-topic question that asks something different', () => {
    // One content word swapped for a different one is a different question, not
    // a rewording. Dropping these would silently bias the exam, so the
    // threshold is set above them rather than below them.
    expect(
      stemSimilarity(
        'Which enzyme catalyses the conversion of glucose to pyruvate?',
        'Which enzyme inhibits the conversion of glucose to pyruvate?'
      )
    ).toBeLessThan(DEDUPE_THRESHOLD);

    const { kept } = dedupeQuestions([
      q('1', { question: 'Which enzyme catalyses the conversion of glucose to pyruvate?' }),
      q('2', { question: 'Which enzyme inhibits the conversion of glucose to pyruvate?' }),
    ]);
    expect(kept).toHaveLength(2);
  });

  it('drops the later of two near-duplicate questions', () => {
    const { kept, dropped } = dedupeQuestions([
      q('1', { question: 'Which enzyme catalyses the conversion of glucose to pyruvate?' }),
      q('2', { question: 'Which enzyme catalyses the conversion of glucose into pyruvate?' }),
      q('3', { question: 'Compare the Krebs cycle with the electron transport chain.' }),
    ]);

    expect(kept.map((k) => k.id)).toEqual(['1', '3']);
    expect(dropped).toBe(1);
  });

  it('drops questions the learner has already answered', () => {
    const { kept } = dedupeQuestions(
      [q('1', { question: 'Which enzyme catalyses the conversion of glucose to pyruvate?' })],
      { against: ['Which enzyme catalyses the conversion of glucose to pyruvate?'] }
    );
    expect(kept).toHaveLength(0);
  });

  it('skips questions with no stem at all', () => {
    const { kept } = dedupeQuestions([q('1', { question: '   ' }), q('2')]);
    expect(kept.map((k) => k.id)).toEqual(['2']);
  });
});

describe('previouslySeenStems', () => {
  it('collects stems from every stored exam, ignoring attempts with none', () => {
    const attempts: StoredAttempt[] = [
      {
        id: 'a1',
        subjectId: 's1',
        subjectName: 'Bio',
        name: 'Mock 1',
        type: 'Exam',
        date: '2026-09-01',
        overallScore: 80,
        totalQuestions: 2,
        correctQuestions: 2,
        examQuestions: [q('1', { question: 'Define glycolysis.' }), q('2', { question: 'Define the Krebs cycle.' })],
      },
      {
        id: 'a2',
        subjectId: 's1',
        subjectName: 'Bio',
        name: 'Mock 2',
        type: 'Exam',
        date: '2026-09-02',
        overallScore: 60,
        totalQuestions: 0,
        correctQuestions: 0,
      },
    ];

    expect(previouslySeenStems(attempts)).toEqual(['Define glycolysis.', 'Define the Krebs cycle.']);
  });
});

describe('buildExamBlueprint', () => {
  it('dedupes, enforces the quota, orders and shuffles in one pass', () => {
    const plan = buildBloomPlan(6, 'balanced');
    const generated: ExamQuestion[] = [
      q('1', {
        topic: 'Glycolysis',
        bloomLevel: 'remember',
        question: 'Which enzyme catalyses the conversion of glucose to pyruvate?',
      }),
      // Rewording of q1, not a second question about it.
      q('2', {
        topic: 'Glycolysis',
        bloomLevel: 'remember',
        question: 'Which enzyme catalyses the conversion of glucose into pyruvate?',
      }),
      q('3', { topic: 'Krebs Cycle', bloomLevel: 'understand', question: 'Summarise the Krebs cycle.' }),
      q('4', { topic: 'Glycolysis', bloomLevel: 'apply', question: 'Calculate the net ATP from glycolysis.' }),
      q('5', { topic: 'Krebs Cycle', bloomLevel: 'analyze', question: 'Compare the Krebs cycle to glycolysis.' }),
      q('6', { topic: 'ETC', bloomLevel: 'evaluate', question: 'Justify why the ETC yields the most ATP.' }),
      q('7', { topic: 'ETC', bloomLevel: 'create', question: 'Design an experiment isolating the ETC.' }),
    ];

    const blueprint = buildExamBlueprint({ generated, plan, seed: 5 });

    expect(blueprint.droppedDuplicates).toBe(1);
    expect(blueprint.questions).toHaveLength(6);

    // Ascending cognitive level.
    const ranks = blueprint.questions.map((x) => levelRank(x.bloomLevel));
    expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);

    // Every question still gradeable: the key survives shuffling.
    blueprint.questions.forEach((item) => {
      if (item.type === 'multiple_choice' && item.options) {
        expect(item.options).toContain(item.correctAnswer);
      }
    });

    // The delivered distribution is reported for the results screen.
    expect(blueprint.distribution.reduce((acc, s) => acc + s.count, 0)).toBe(6);
  });

  it('accepts whatever came back when no plan is supplied', () => {
    const generated = [q('1', { bloomLevel: 'analyze' }), q('2', { bloomLevel: 'remember' })];
    const blueprint = buildExamBlueprint({ generated });
    expect(blueprint.questions).toHaveLength(2);
  });
});

describe('distributionOf', () => {
  it('counts declared levels and ignores unlevelled questions', () => {
    const dist = distributionOf([
      q('1', { bloomLevel: 'apply' }),
      q('2', { bloomLevel: 'apply' }),
      q('3', { bloomLevel: 'create' as BloomLevel }),
      q('4'),
    ]);
    expect(dist).toEqual([
      { level: 'apply', verb: expect.any(String), count: 2 },
      { level: 'create', verb: expect.any(String), count: 1 },
    ]);
  });
});

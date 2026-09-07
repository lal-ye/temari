import { describe, expect, it } from 'vitest';
import {
  computeAnalyticsSummary,
  computeReviewQueue,
  computeStudyStreak,
  dueForReview,
  escalatedLevel,
  REVIEW_INTERVALS_DAYS,
} from './analytics';
import type { StoredAttempt } from '../types';

/** Minimal Attempt; only `date` matters to the streak. */
function attemptOn(date: Date): StoredAttempt {
  return {
    id: `a-${date.toISOString()}`,
    subjectId: 'subj-1',
    subjectName: 'Cell Biology',
    name: 'Drill',
    type: 'Quiz',
    date: date.toISOString(),
    overallScore: 80,
    totalQuestions: 10,
    correctQuestions: 8,
  };
}

const NOW = new Date('2026-09-05T14:00:00');

function daysBefore(n: number): Date {
  const d = new Date(NOW);
  d.setDate(d.getDate() - n);
  return d;
}

describe('computeStudyStreak', () => {
  it('reports no streak without attempts', () => {
    expect(computeStudyStreak([], NOW)).toEqual({
      days: 0,
      daysThisWeek: 0,
      studiedToday: false,
    });
  });

  it('counts consecutive days ending today', () => {
    const attempts = [0, 1, 2].map((n) => attemptOn(daysBefore(n)));
    const streak = computeStudyStreak(attempts, NOW);
    expect(streak.days).toBe(3);
    expect(streak.studiedToday).toBe(true);
  });

  it('keeps the streak alive when today has no attempt yet', () => {
    // Studied yesterday and the day before, nothing today. The day is not over,
    // so the streak must not be reported as broken.
    const attempts = [1, 2].map((n) => attemptOn(daysBefore(n)));
    const streak = computeStudyStreak(attempts, NOW);
    expect(streak.days).toBe(2);
    expect(streak.studiedToday).toBe(false);
  });

  it('breaks the streak across a skipped day', () => {
    const attempts = [0, 1, 3, 4].map((n) => attemptOn(daysBefore(n)));
    expect(computeStudyStreak(attempts, NOW).days).toBe(2);
  });

  it('counts a day once however many attempts it holds', () => {
    const today = daysBefore(0);
    const later = new Date(today);
    later.setHours(later.getHours() + 3);
    const streak = computeStudyStreak([attemptOn(today), attemptOn(later)], NOW);
    expect(streak.days).toBe(1);
    expect(streak.daysThisWeek).toBe(1);
  });

  it('caps the weekly count at the last seven days', () => {
    const attempts = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((n) => attemptOn(daysBefore(n)));
    expect(computeStudyStreak(attempts, NOW).daysThisWeek).toBe(7);
  });

  it('ignores attempts with an unparseable date', () => {
    const broken = { ...attemptOn(daysBefore(0)), date: 'not-a-date' };
    expect(computeStudyStreak([broken], NOW).days).toBe(0);
  });
});

// --- Cognitive-level mastery and spaced resurfacing --------------------------

type Level = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';

/** An Exam attempt whose results carry the cognitive level they were judged at. */
function examWith(
  date: string,
  results: Array<{ topic: string; level?: Level; isCorrect: boolean }>
): StoredAttempt {
  const correct = results.filter((r) => r.isCorrect).length;
  return {
    id: `a-${date}-${Math.random().toString(36).slice(2, 7)}`,
    subjectId: 'subj-1',
    subjectName: 'Cell Biology',
    name: `Mock ${date}`,
    type: 'Exam',
    date,
    overallScore: Math.round((correct / results.length) * 100),
    totalQuestions: results.length,
    correctQuestions: correct,
    examResults: results.map((r, i) => ({
      question: `Q${i}`,
      type: 'multiple_choice' as const,
      correctAnswer: 'Alpha',
      userAnswer: r.isCorrect ? 'Alpha' : 'Beta',
      isCorrect: r.isCorrect,
      topic: r.topic,
      bloomLevel: r.level,
    })),
  };
}

describe('topic x cognitive-level mastery', () => {
  const attempts = [
    examWith('2026-09-01', [
      { topic: 'Glycolysis', level: 'remember', isCorrect: true },
      { topic: 'Glycolysis', level: 'remember', isCorrect: true },
      { topic: 'Glycolysis', level: 'apply', isCorrect: false },
      { topic: 'Glycolysis', level: 'apply', isCorrect: false },
    ]),
  ];

  it('separates recall mastery from application mastery on the same topic', () => {
    // The whole point of the second axis: this learner is strong at
    // Glycolysis-Remember and weak at Glycolysis-Apply, which topic accuracy
    // alone reports as one middling 50%.
    const { analytics } = computeAnalyticsSummary(attempts);

    const cell = (level: Level) =>
      analytics.topicLevelStats.find((c) => c.topic === 'Glycolysis' && c.level === level);

    expect(cell('remember')?.accuracy).toBe(100);
    expect(cell('apply')?.accuracy).toBe(0);
    expect(analytics.topicStats.find((t) => t.topic === 'Glycolysis')?.accuracy).toBe(50);
  });

  it('aggregates accuracy per cognitive level across topics', () => {
    const { analytics } = computeAnalyticsSummary([
      examWith('2026-09-01', [
        { topic: 'A', level: 'remember', isCorrect: true },
        { topic: 'B', level: 'remember', isCorrect: false },
        { topic: 'A', level: 'create', isCorrect: false },
      ]),
    ]);

    expect(analytics.levelStats).toEqual([
      { level: 'remember', correct: 1, total: 2, accuracy: 50 },
      { level: 'create', correct: 0, total: 1, accuracy: 0 },
    ]);
  });

  it('returns levels in ascending cognitive order', () => {
    const { analytics } = computeAnalyticsSummary([
      examWith('2026-09-01', [
        { topic: 'A', level: 'create', isCorrect: true },
        { topic: 'A', level: 'remember', isCorrect: true },
        { topic: 'A', level: 'analyze', isCorrect: true },
      ]),
    ]);
    expect(analytics.levelStats.map((s) => s.level)).toEqual(['remember', 'analyze', 'create']);
  });

  it('buckets unlevelled legacy results instead of dropping them', () => {
    const { analytics } = computeAnalyticsSummary([
      examWith('2026-09-01', [{ topic: 'Old Topic', isCorrect: false }]),
    ]);

    const cell = analytics.topicLevelStats.find((c) => c.topic === 'Old Topic');
    expect(cell?.level).toBe('unlevelled');
    // An unlevelled result is not evidence about any Bloom level.
    expect(analytics.levelStats).toEqual([]);
    // But it is still a topic the learner got wrong.
    expect(analytics.weakTopics.map((t) => t.topic)).toContain('Old Topic');
  });

  it('lists weak cells below the mastery threshold, weakest first', () => {
    const { analytics } = computeAnalyticsSummary([
      examWith('2026-09-01', [
        { topic: 'A', level: 'apply', isCorrect: false },
        { topic: 'A', level: 'apply', isCorrect: false },
        { topic: 'B', level: 'analyze', isCorrect: false },
        { topic: 'B', level: 'analyze', isCorrect: true },
        { topic: 'C', level: 'remember', isCorrect: true },
        { topic: 'C', level: 'remember', isCorrect: true },
      ]),
    ]);

    expect(analytics.weakTopicLevels.map((c) => `${c.topic}:${c.level}`)).toEqual([
      'A:apply',
      'B:analyze',
    ]);
  });

  it('returns empty axes when there are no attempts', () => {
    const { analytics } = computeAnalyticsSummary([]);
    expect(analytics.levelStats).toEqual([]);
    expect(analytics.topicLevelStats).toEqual([]);
    expect(analytics.weakTopicLevels).toEqual([]);
  });
});

describe('computeReviewQueue', () => {
  it('schedules a cell whose most recent answer was wrong', () => {
    const queue = computeReviewQueue(
      [examWith('2026-09-01T09:00:00Z', [{ topic: 'Glycolysis', level: 'apply', isCorrect: false }])],
      new Date('2026-09-01T09:00:00Z')
    );

    expect(queue).toHaveLength(1);
    expect(queue[0].topic).toBe('Glycolysis');
    expect(queue[0].level).toBe('apply');
    expect(queue[0].lapseStreak).toBe(1);
    expect(queue[0].intervalDays).toBe(REVIEW_INTERVALS_DAYS[0]);
    expect(queue[0].dueAt).toBe('2026-09-02T09:00:00.000Z');
  });

  it('does not queue a cell the learner has since corrected', () => {
    const queue = computeReviewQueue([
      examWith('2026-09-01T09:00:00Z', [{ topic: 'Glycolysis', level: 'apply', isCorrect: false }]),
      examWith('2026-09-03T09:00:00Z', [{ topic: 'Glycolysis', level: 'apply', isCorrect: true }]),
    ]);
    expect(queue).toHaveLength(0);
  });

  it('stretches the interval as the lapse streak grows', () => {
    const miss = (day: number) =>
      examWith(`2026-09-0${day}T09:00:00Z`, [{ topic: 'Krebs', level: 'analyze', isCorrect: false }]);

    const queue = computeReviewQueue([miss(1), miss(2), miss(3)]);
    expect(queue).toHaveLength(1);
    expect(queue[0].lapseStreak).toBe(3);
    expect(queue[0].intervalDays).toBe(REVIEW_INTERVALS_DAYS[2]);
  });

  it('caps the interval at the last step of the schedule', () => {
    const misses = [1, 2, 3, 4, 5, 6].map((d) =>
      examWith(`2026-09-0${d}T09:00:00Z`, [{ topic: 'Krebs', level: 'analyze', isCorrect: false }])
    );
    const queue = computeReviewQueue(misses);
    expect(queue[0].lapseStreak).toBe(6);
    expect(queue[0].intervalDays).toBe(REVIEW_INTERVALS_DAYS[REVIEW_INTERVALS_DAYS.length - 1]);
  });

  it('orders the queue most overdue first', () => {
    const queue = computeReviewQueue([
      examWith('2026-09-05T09:00:00Z', [{ topic: 'Recent', level: 'apply', isCorrect: false }]),
      examWith('2026-09-01T09:00:00Z', [{ topic: 'Old', level: 'apply', isCorrect: false }]),
    ]);
    expect(queue.map((i) => i.topic)).toEqual(['Old', 'Recent']);
  });

  it('ignores attempts with an unparseable date', () => {
    const bad = examWith('2026-09-01', [{ topic: 'X', level: 'apply', isCorrect: false }]);
    bad.date = 'not-a-date';
    expect(computeReviewQueue([bad])).toEqual([]);
  });
});

describe('dueForReview', () => {
  const queue = [
    { topic: 'Overdue', level: 'apply' as const, dueAt: '2026-09-01T00:00:00.000Z', intervalDays: 1, lapseStreak: 1, accuracy: 0, total: 1 },
    { topic: 'Later', level: 'apply' as const, dueAt: '2026-09-10T00:00:00.000Z', intervalDays: 7, lapseStreak: 1, accuracy: 0, total: 1 },
  ];

  it('returns only items due at or before now', () => {
    expect(dueForReview(queue, new Date('2026-09-05T00:00:00Z')).map((i) => i.topic)).toEqual(['Overdue']);
    expect(dueForReview(queue, new Date('2026-09-20T00:00:00Z'))).toHaveLength(2);
    expect(dueForReview(queue, new Date('2026-08-01T00:00:00Z'))).toHaveLength(0);
  });
});

describe('escalatedLevel', () => {
  const cells = [
    { topic: 'Glycolysis', level: 'remember' as const, correct: 3, total: 3, accuracy: 100 },
    { topic: 'Glycolysis', level: 'apply' as const, correct: 1, total: 3, accuracy: 33 },
    { topic: 'Krebs', level: 'remember' as const, correct: 1, total: 1, accuracy: 100 },
    { topic: 'ETC', level: 'create' as const, correct: 2, total: 2, accuracy: 100 },
  ];

  it('steps up a topic mastered at a level', () => {
    // Two correct answers at Remember: the next exam should ask for more than
    // recall of this idea.
    expect(escalatedLevel('Glycolysis', cells)).toBe('understand');
  });

  it('does not escalate on a single answer, however perfect', () => {
    expect(escalatedLevel('Krebs', cells)).toBeUndefined();
  });

  it('does not escalate past the top of the taxonomy', () => {
    expect(escalatedLevel('ETC', cells)).toBeUndefined();
  });

  it('returns nothing for a topic with no history', () => {
    expect(escalatedLevel('Unknown', cells)).toBeUndefined();
  });
});

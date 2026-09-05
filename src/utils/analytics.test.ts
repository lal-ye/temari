import { describe, expect, it } from 'vitest';
import { computeStudyStreak } from './analytics';
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

import { StoredAttempt } from '../types';

export interface ScoreHistoryPoint {
  date: string;
  score: number;
  name: string;
  type: string;
}

export interface ScoreDistributionBucket {
  name: string;
  count: number;
}

export interface TopicAccuracyStat {
  topic: string;
  accuracy: number;
  totalTested: number;
}

export interface WeakTopicItem {
  topic: string;
  accuracy: number;
}

export interface AnalyticsSummary {
  totalAttempts: number;
  averageScore: number;
  quizzesCount: number;
  examsCount: number;
  lastActivity: string | null;
  passRate: number;
  scoreHistory: ScoreHistoryPoint[];
  topicStats: TopicAccuracyStat[];
  distribution: ScoreDistributionBucket[];
  weakTopics: WeakTopicItem[];
}

/**
 * Computes comprehensive diagnostic analytics from assessment attempts.
 * Pure function with zero DOM / React dependencies.
 */
export function computeAnalyticsSummary(
  attempts: StoredAttempt[],
  selectedSubjectId: string = 'ALL'
): { filteredAttempts: StoredAttempt[]; analytics: AnalyticsSummary } {
  const filteredAttempts =
    selectedSubjectId === 'ALL'
      ? attempts
      : attempts.filter((a) => a.subjectId === selectedSubjectId);

  const total = filteredAttempts.length;

  if (total === 0) {
    return {
      filteredAttempts,
      analytics: {
        totalAttempts: 0,
        averageScore: 0,
        quizzesCount: 0,
        examsCount: 0,
        lastActivity: null,
        passRate: 0,
        scoreHistory: [],
        topicStats: [],
        distribution: [
          { name: '0-59%', count: 0 },
          { name: '60-69%', count: 0 },
          { name: '70-79%', count: 0 },
          { name: '80-89%', count: 0 },
          { name: '90-100%', count: 0 },
        ],
        weakTopics: [],
      },
    };
  }

  let quizzesCount = 0;
  let examsCount = 0;
  let sumScore = 0;
  let passedCount = 0;

  // Score distribution buckets
  const distribution: ScoreDistributionBucket[] = [
    { name: '0-59%', count: 0 },
    { name: '60-69%', count: 0 },
    { name: '70-79%', count: 0 },
    { name: '80-89%', count: 0 },
    { name: '90-100%', count: 0 },
  ];

  // Topic performance aggregation from detailed results
  const topicMap = new Map<string, { correct: number; total: number }>();

  // Single-pass iteration to aggregate counts, scores, distribution, and topic performance
  filteredAttempts.forEach((a) => {
    if (a.type === 'Quiz') quizzesCount++;
    else if (a.type === 'Exam') examsCount++;

    sumScore += a.overallScore;

    if (a.overallScore >= 70) passedCount++;

    if (a.overallScore < 60) distribution[0].count++;
    else if (a.overallScore < 70) distribution[1].count++;
    else if (a.overallScore < 80) distribution[2].count++;
    else if (a.overallScore < 90) distribution[3].count++;
    else distribution[4].count++;

    a.examResults?.forEach((r) => {
      const t = r.topic || 'General';
      const cur = topicMap.get(t) || { correct: 0, total: 0 };
      cur.total++;
      if (r.isCorrect) cur.correct++;
      topicMap.set(t, cur);
    });
  });

  const averageScore = Math.round(sumScore / total);
  const passRate = Math.round((passedCount / total) * 100);

  // Chronological score history
  const scoreHistory: ScoreHistoryPoint[] = [...filteredAttempts]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .map((a) => ({
      date: new Date(a.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      score: a.overallScore,
      name: a.name,
      type: a.type,
    }));

  const topicStats: TopicAccuracyStat[] = Array.from(topicMap.entries()).map(([topic, stat]) => ({
    topic,
    accuracy: Math.round((stat.correct / stat.total) * 100),
    totalTested: stat.total,
  }));

  const weakTopics: WeakTopicItem[] = topicStats
    .filter((t) => t.accuracy < 70)
    .map((t) => ({ topic: t.topic, accuracy: t.accuracy }));

  return {
    filteredAttempts,
    analytics: {
      totalAttempts: total,
      averageScore,
        quizzesCount,
        examsCount,
      lastActivity: filteredAttempts[0]?.date || null,
      passRate,
      scoreHistory,
      topicStats,
      distribution,
      weakTopics,
    },
  };
}

export interface StudyStreak {
  /** Consecutive days up to and including today (or yesterday) with an Attempt. */
  days: number;
  /** Distinct days studied in the last 7, capped at 7. */
  daysThisWeek: number;
  /** Whether an Attempt was recorded today. */
  studiedToday: boolean;
}

/** Local calendar day key, so streaks follow the learner's midnight, not UTC. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Computes the study streak from real Attempts.
 *
 * A streak counts back from today; studying yesterday but not yet today keeps
 * the streak alive, because the day is not over. Two Attempts on one day count
 * once - the unit is the day, not the Attempt.
 */
export function computeStudyStreak(
  attempts: StoredAttempt[],
  now: Date = new Date()
): StudyStreak {
  const studied = new Set(
    attempts
      .map((a) => new Date(a.date))
      .filter((d) => !Number.isNaN(d.getTime()))
      .map(dayKey)
  );

  const dayAt = (offset: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    return d;
  };

  const studiedToday = studied.has(dayKey(now));

  // Yesterday still counts: today is not over yet.
  let days = 0;
  for (let offset = studiedToday ? 0 : 1; ; offset += 1) {
    if (!studied.has(dayKey(dayAt(offset)))) break;
    days += 1;
    if (days > 3650) break; // guard against pathological data
  }

  let daysThisWeek = 0;
  for (let offset = 0; offset < 7; offset += 1) {
    if (studied.has(dayKey(dayAt(offset)))) daysThisWeek += 1;
  }

  return { days, daysThisWeek, studiedToday };
}

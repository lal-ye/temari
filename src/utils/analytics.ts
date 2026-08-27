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

  const quizzes = filteredAttempts.filter((a) => a.type === 'Quiz');
  const exams = filteredAttempts.filter((a) => a.type === 'Exam');
  const sumScore = filteredAttempts.reduce((acc, a) => acc + a.overallScore, 0);
  const averageScore = Math.round(sumScore / total);
  const passedCount = filteredAttempts.filter((a) => a.overallScore >= 70).length;
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

  // Score distribution buckets
  const distribution: ScoreDistributionBucket[] = [
    { name: '0-59%', count: 0 },
    { name: '60-69%', count: 0 },
    { name: '70-79%', count: 0 },
    { name: '80-89%', count: 0 },
    { name: '90-100%', count: 0 },
  ];

  filteredAttempts.forEach((a) => {
    if (a.overallScore < 60) distribution[0].count++;
    else if (a.overallScore < 70) distribution[1].count++;
    else if (a.overallScore < 80) distribution[2].count++;
    else if (a.overallScore < 90) distribution[3].count++;
    else distribution[4].count++;
  });

  // Topic performance aggregation from detailed results
  const topicMap = new Map<string, { correct: number; total: number }>();
  filteredAttempts.forEach((att) => {
    att.examResults?.forEach((r) => {
      const t = r.topic || 'General';
      const cur = topicMap.get(t) || { correct: 0, total: 0 };
      cur.total++;
      if (r.isCorrect) cur.correct++;
      topicMap.set(t, cur);
    });
  });

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
      quizzesCount: quizzes.length,
      examsCount: exams.length,
      lastActivity: filteredAttempts[0]?.date || null,
      passRate,
      scoreHistory,
      topicStats,
      distribution,
      weakTopics,
    },
  };
}

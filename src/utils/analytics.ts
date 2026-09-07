import { BLOOM_LEVELS, BloomLevel, StoredAttempt } from '../types';

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

/**
 * One cell of the mastery grid: how the learner does on one topic at one
 * cognitive level. This is the second axis topic accuracy was missing - being
 * strong at "Glycolysis · Recall" says nothing about "Glycolysis · Apply".
 */
export interface TopicLevelStat {
  topic: string;
  /** Level as recorded on the result; legacy attempts have none. */
  level: BloomLevel | 'unlevelled';
  correct: number;
  total: number;
  accuracy: number;
}

export interface LevelStat {
  level: BloomLevel;
  correct: number;
  total: number;
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
  /** Mastery per cognitive level, lowest to highest. Empty levels are omitted. */
  levelStats: LevelStat[];
  /** Mastery per (topic × level) cell, the axis the dashboard was missing. */
  topicLevelStats: TopicLevelStat[];
  /** Cells below the mastery threshold, ordered weakest first. */
  weakTopicLevels: TopicLevelStat[];
}

/** Accuracy at or above which a topic (or topic x level cell) counts as mastered. */
export const MASTERY_THRESHOLD = 70;

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
        levelStats: [],
        topicLevelStats: [],
        weakTopicLevels: [],
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
  // The same aggregation, one axis finer: topic x cognitive level.
  const cellMap = new Map<string, { topic: string; level: BloomLevel | 'unlevelled'; correct: number; total: number }>();
  const levelMap = new Map<BloomLevel, { correct: number; total: number }>();

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

      // Level comes from the result, not from a lookup against the stored
      // questions: grading is the only place the answer was actually judged.
      const level: BloomLevel | 'unlevelled' =
        r.bloomLevel && BLOOM_LEVELS.includes(r.bloomLevel) ? r.bloomLevel : 'unlevelled';

      const key = `${t}::${level}`;
      const cell = cellMap.get(key) || { topic: t, level, correct: 0, total: 0 };
      cell.total++;
      if (r.isCorrect) cell.correct++;
      cellMap.set(key, cell);

      if (level !== 'unlevelled') {
        const lvl = levelMap.get(level) || { correct: 0, total: 0 };
        lvl.total++;
        if (r.isCorrect) lvl.correct++;
        levelMap.set(level, lvl);
      }
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

  const levelStats: LevelStat[] = BLOOM_LEVELS.filter((l) => levelMap.has(l)).map((level) => {
    const stat = levelMap.get(level) as { correct: number; total: number };
    return {
      level,
      correct: stat.correct,
      total: stat.total,
      accuracy: Math.round((stat.correct / stat.total) * 100),
    };
  });

  const topicLevelStats: TopicLevelStat[] = Array.from(cellMap.values()).map((cell) => ({
    ...cell,
    accuracy: Math.round((cell.correct / cell.total) * 100),
  }));

  const weakTopicLevels = topicLevelStats
    .filter((cell) => cell.accuracy < MASTERY_THRESHOLD)
    .sort((a, b) => a.accuracy - b.accuracy);

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
      levelStats,
      topicLevelStats,
      weakTopicLevels,
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

// --- Spaced resurfacing ------------------------------------------------------

/** Expanding review intervals, in days, indexed by the learner's lapse streak. */
export const REVIEW_INTERVALS_DAYS = [1, 3, 7, 14] as const;

export interface ReviewItem {
  topic: string;
  level: BloomLevel | 'unlevelled';
  /** ISO timestamp at which this cell becomes due for review. */
  dueAt: string;
  intervalDays: number;
  /** How many answers in a row were wrong, ending with the most recent one. */
  lapseStreak: number;
  accuracy: number;
  total: number;
}

/**
 * Build the spaced-review queue from graded attempts.
 *
 * A cell enters the queue when its most recent answer was wrong — an item the
 * learner has since corrected is consolidating, not overdue. The interval grows
 * with the length of the current failure streak (1/3/7/14 days), so a topic
 * that keeps slipping comes back sooner than one missed once.
 *
 * Resurfacing is scheduled per (topic × level) cell, not per question: a fresh
 * variant of the same idea tests the idea, whereas repeating the identical
 * question just tests whether the answer string was memorised.
 */
export function computeReviewQueue(
  attempts: StoredAttempt[],
  now: Date = new Date()
): ReviewItem[] {
  // Flatten every graded answer with its timestamp, oldest first, so a lapse
  // streak is computed in the order the learner actually encountered it.
  type Answer = {
    topic: string;
    level: BloomLevel | 'unlevelled';
    isCorrect: boolean;
    at: number;
  };

  const answers: Answer[] = [];
  attempts.forEach((a) => {
    const at = new Date(a.date).getTime();
    if (Number.isNaN(at)) return;
    a.examResults?.forEach((r) => {
      const level: BloomLevel | 'unlevelled' =
        r.bloomLevel && BLOOM_LEVELS.includes(r.bloomLevel) ? r.bloomLevel : 'unlevelled';
      answers.push({ topic: r.topic || 'General', level, isCorrect: r.isCorrect, at });
    });
  });

  answers.sort((x, y) => x.at - y.at);

  const cells = new Map<
    string,
    { topic: string; level: BloomLevel | 'unlevelled'; correct: number; total: number; streak: number; lastCorrect: boolean; lastAt: number }
  >();

  answers.forEach((ans) => {
    const key = `${ans.topic}::${ans.level}`;
    const cell =
      cells.get(key) ||
      { topic: ans.topic, level: ans.level, correct: 0, total: 0, streak: 0, lastCorrect: true, lastAt: ans.at };

    cell.total += 1;
    if (ans.isCorrect) {
      cell.correct += 1;
      cell.streak = 0;
      cell.lastCorrect = true;
    } else {
      cell.streak += 1;
      cell.lastCorrect = false;
    }
    cell.lastAt = ans.at;
    cells.set(key, cell);
  });

  const queue: ReviewItem[] = [];
  cells.forEach((cell) => {
    if (cell.lastCorrect || cell.streak === 0) return;

    const intervalDays =
      REVIEW_INTERVALS_DAYS[Math.min(cell.streak - 1, REVIEW_INTERVALS_DAYS.length - 1)];
    const dueAt = new Date(cell.lastAt + intervalDays * 24 * 60 * 60 * 1000);

    queue.push({
      topic: cell.topic,
      level: cell.level,
      dueAt: dueAt.toISOString(),
      intervalDays,
      lapseStreak: cell.streak,
      accuracy: Math.round((cell.correct / cell.total) * 100),
      total: cell.total,
    });
  });

  // Most overdue first, then the longest lapse streak.
  return queue.sort(
    (a, b) =>
      new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime() ||
      b.lapseStreak - a.lapseStreak
  );
}

/** Which queued cells are due as of `now` (or already overdue). */
export function dueForReview(queue: ReviewItem[], now: Date = new Date()): ReviewItem[] {
  return queue.filter((item) => new Date(item.dueAt).getTime() <= now.getTime());
}

/**
 * The level a topic is ready to be tested at next.
 *
 * A topic escalates once it has been answered at least twice at a level with
 * accuracy at or above the mastery threshold: the next exam should ask for
 * more than recall of that idea. Returns undefined when nothing is mastered
 * yet, or when the topic already sits at the top of the taxonomy.
 */
export function escalatedLevel(
  topic: string,
  topicLevelStats: TopicLevelStat[]
): BloomLevel | undefined {
  const mastered = topicLevelStats
    .filter(
      (cell) =>
        cell.topic === topic &&
        cell.level !== 'unlevelled' &&
        cell.total >= 2 &&
        cell.accuracy >= MASTERY_THRESHOLD
    )
    .map((cell) => cell.level as BloomLevel);

  if (mastered.length === 0) return undefined;

  const highest = mastered.reduce((best, l) =>
    BLOOM_LEVELS.indexOf(l) > BLOOM_LEVELS.indexOf(best) ? l : best
  );
  const next = BLOOM_LEVELS[BLOOM_LEVELS.indexOf(highest) + 1];
  return next;
}

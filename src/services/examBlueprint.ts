import {
  BLOOM_LEVELS,
  BloomLevel,
  BloomSlot,
  CognitiveMixId,
  ExamQuestion,
  StoredAttempt,
} from '../types';

/**
 * Exam-Blueprint module (docs/adr/0008)
 * -------------------------------------
 * Pure planning and repair of generated exam questions. Nothing here talks to
 * a Provider; it decides *what to ask for* and then *fixes what came back*.
 *
 * Four responsibilities, all pure and all tested through this file's exports:
 *
 *   1. buildBloomPlan      — turn a question count + cognitive mix into an exact
 *                            per-level quota (largest-remainder allocation, so
 *                            the quota always sums to the requested count).
 *   2. enforceDistribution — repair a generated set that drifted from the quota,
 *                            because models routinely miss their target level.
 *   3. orderExamQuestions  — level ascending (progressive difficulty) with
 *                            topics interleaved inside each level, rather than
 *                            blocked topic-by-topic.
 *   4. dedupeQuestions     — drop near-duplicate stems, within the exam and
 *                            against what the learner has already been asked.
 *
 * `buildExamBlueprint` is the single entry point: dedupe → enforce → order →
 * shuffle options. Feature screens call that, not the parts.
 */

// --- Cognitive mixes ---------------------------------------------------------

export interface CognitiveMix {
  id: CognitiveMixId;
  label: string;
  description: string;
  /** Relative weight per Bloom level. Levels at 0 are simply not used. */
  weights: Record<BloomLevel, number>;
}

/**
 * The four named distributions. Weights are relative, not percentages; they
 * are normalised by buildBloomPlan against the requested question count.
 *
 * `recall` is the only mix the offline adapter can honestly serve, because
 * sentence extraction cannot produce analysis or synthesis items.
 */
export const COGNITIVE_MIXES: Record<CognitiveMixId, CognitiveMix> = {
  recall: {
    id: 'recall',
    label: 'Quick recall drill',
    description: 'Definitions and direct facts. Fast, high-confidence practice.',
    weights: { remember: 6, understand: 3, apply: 1, analyze: 0, evaluate: 0, create: 0 },
  },
  balanced: {
    id: 'balanced',
    label: 'Balanced exam',
    description: 'Even coverage from recall through analysis. The default.',
    weights: { remember: 3, understand: 3, apply: 4, analyze: 3, evaluate: 2, create: 1 },
  },
  simulation: {
    id: 'simulation',
    label: 'Exam simulation',
    description: 'Weighted toward application and analysis, as final exams are.',
    weights: { remember: 2, understand: 2, apply: 5, analyze: 4, evaluate: 2, create: 1 },
  },
  deep: {
    id: 'deep',
    label: 'Deep understanding',
    description: 'Mostly higher-order: justification, critique and design.',
    weights: { remember: 1, understand: 2, apply: 2, analyze: 4, evaluate: 3, create: 2 },
  },
};

/** Level-appropriate directive verbs, embedded in the generation prompt. */
export const BLOOM_VERBS: Record<BloomLevel, string> = {
  remember: 'define, list, recall, name, identify',
  understand: 'summarize, explain, classify, interpret, describe',
  apply: 'calculate, use, demonstrate, apply, solve',
  analyze: 'compare, contrast, differentiate, examine, break down',
  evaluate: 'justify, critique, assess, defend, judge',
  create: 'design, construct, propose, formulate, compose',
};

/** Human label for a level, for badges. Keep short — these render in pills. */
export const BLOOM_LABELS: Record<BloomLevel, string> = {
  remember: 'Recall',
  understand: 'Understand',
  apply: 'Apply',
  analyze: 'Analyze',
  evaluate: 'Evaluate',
  create: 'Create',
};

// --- Planning ----------------------------------------------------------------

/**
 * Allocate `questionCount` questions across Bloom levels for `mix`.
 *
 * Two guarantees callers rely on:
 *   - the returned counts sum exactly to `questionCount` (largest-remainder
 *     allocation, never naive rounding, which drifts);
 *   - every level with non-zero weight gets at least one question, whenever
 *     there are enough questions to cover them. A 15-question exam must not
 *     come back with zero Create items because 15 * 1/16 floored to 0.
 *
 * Levels are returned in ascending order and zero-count levels are omitted.
 */
export function buildBloomPlan(
  questionCount: number,
  mix: CognitiveMixId = 'balanced'
): BloomSlot[] {
  const total = Math.max(0, Math.floor(questionCount));
  if (total === 0) return [];

  let weights = COGNITIVE_MIXES[mix]?.weights ?? COGNITIVE_MIXES.balanced.weights;
  let levels = BLOOM_LEVELS.filter((l) => weights[l] > 0);

  // A hand-built mix with every weight at zero has no plan; fall back rather
  // than dividing by zero.
  if (levels.length === 0) {
    weights = COGNITIVE_MIXES.balanced.weights;
    levels = BLOOM_LEVELS.filter((l) => weights[l] > 0);
  }

  const counts = new Map<BloomLevel, number>(BLOOM_LEVELS.map((l) => [l, 0]));

  // 1. Coverage floor: one question per weighted level, if affordable.
  let budget = total;
  if (budget >= levels.length) {
    levels.forEach((l) => counts.set(l, 1));
    budget -= levels.length;
  }

  // 2. Distribute the remainder in proportion to the weights.
  const weightSum = levels.reduce((sum, l) => sum + weights[l], 0);
  const raw = levels.map((l) => (budget * weights[l]) / weightSum);
  const floors = raw.map((n) => Math.floor(n));
  let assigned = floors.reduce((a, b) => a + b, 0);
  floors.forEach((n, i) => counts.set(levels[i], (counts.get(levels[i]) ?? 0) + n));

  // 3. Largest remainder: hand out the units flooring dropped. Ties break to
  //    the heavier weight, then to the earlier level, so the result is stable.
  const byRemainder = levels
    .map((level, i) => ({ level, frac: raw[i] - floors[i], weight: weights[level], i }))
    .sort((a, b) => b.frac - a.frac || b.weight - a.weight || a.i - b.i);

  for (let k = 0; assigned < budget; k += 1, assigned += 1) {
    const level = byRemainder[k % byRemainder.length].level;
    counts.set(level, (counts.get(level) ?? 0) + 1);
  }

  return BLOOM_LEVELS.filter((l) => (counts.get(l) ?? 0) > 0).map((level) => ({
    level,
    verb: BLOOM_VERBS[level],
    count: counts.get(level) as number,
  }));
}

/** Actual per-level counts of a generated set — what the model really returned. */
export function distributionOf(questions: ExamQuestion[]): BloomSlot[] {
  const counts = new Map<BloomLevel, number>();
  questions.forEach((q) => {
    if (!q.bloomLevel) return;
    counts.set(q.bloomLevel, (counts.get(q.bloomLevel) ?? 0) + 1);
  });
  return BLOOM_LEVELS.filter((l) => (counts.get(l) ?? 0) > 0).map((level) => ({
    level,
    verb: BLOOM_VERBS[level],
    count: counts.get(level) as number,
  }));
}

/**
 * Repair a generated set so it matches `plan` as closely as the input allows.
 *
 * Providers drift: asked for 2 Create items they often return 0 and 4 extra
 * Apply items instead. Rather than rejecting the whole generation, take the
 * quota per level, then top up from whatever is left over so the learner still
 * gets the number of questions they asked for. Questions with no declared
 * level are kept as filler, never counted toward a level's quota.
 */
export function enforceDistribution(questions: ExamQuestion[], plan: BloomSlot[]): ExamQuestion[] {
  if (plan.length === 0) return questions;

  const byLevel = new Map<BloomLevel, ExamQuestion[]>();
  const unlevelled: ExamQuestion[] = [];
  questions.forEach((q) => {
    if (!q.bloomLevel) {
      unlevelled.push(q);
      return;
    }
    const bucket = byLevel.get(q.bloomLevel);
    if (bucket) bucket.push(q);
    else byLevel.set(q.bloomLevel, [q]);
  });

  const chosen: ExamQuestion[] = [];
  const used = new Set<ExamQuestion>();
  const targetTotal = plan.reduce((sum, slot) => sum + slot.count, 0);

  plan.forEach((slot) => {
    const bucket = byLevel.get(slot.level) ?? [];
    for (const q of bucket) {
      if (chosen.filter((c) => c.bloomLevel === slot.level).length >= slot.count) break;
      if (used.has(q)) continue;
      chosen.push(q);
      used.add(q);
    }
  });

  // Top up from the surplus (over-quota levels first, then unlevelled filler),
  // preserving the provider's own ordering so related items stay adjacent.
  const leftovers = questions.filter((q) => !used.has(q));
  for (const q of leftovers) {
    if (chosen.length >= targetTotal) break;
    chosen.push(q);
    used.add(q);
  }
  for (const q of unlevelled) {
    if (chosen.length >= targetTotal) break;
    if (used.has(q)) continue;
    chosen.push(q);
    used.add(q);
  }

  return chosen;
}

// --- Ordering ----------------------------------------------------------------

/** Ascending index of a level; unlevelled questions sort as the lowest level. */
export function levelRank(level?: BloomLevel): number {
  if (!level) return 0;
  const idx = BLOOM_LEVELS.indexOf(level);
  return idx === -1 ? 0 : idx;
}

/**
 * Order an exam for the learner: cognitive level ascending, topics interleaved
 * inside each level.
 *
 * Ascending level gives early wins before the synthesis questions, which is
 * worth more than a flat order. Interleaving is layered on top by round-robin
 * numbering topics in first-appearance order, so a subject never blocks —
 * blocked practice measurably hurts long-term retention compared with mixed.
 */
export function orderExamQuestions(questions: ExamQuestion[]): ExamQuestion[] {
  const rotation = new Map<string, number>();

  const decorated = questions.map((q, i) => {
    const topic = q.topic || 'General';
    const turn = rotation.get(topic) ?? 0;
    rotation.set(topic, turn + 1);
    return { q, i, rank: levelRank(q.bloomLevel), turn };
  });

  return decorated
    .sort((a, b) => a.rank - b.rank || a.turn - b.turn || a.i - b.i)
    .map((d) => d.q);
}

// --- Option shuffling --------------------------------------------------------

/** Deterministic 32-bit PRNG, so shuffling is reproducible in tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Randomise multiple-choice option order.
 *
 * Models place the correct answer at position A or B far more often than
 * chance, so position becomes a cue that survives retakes. Shuffling is safe
 * because grading compares the answer *string*, not the option index.
 *
 * A question whose `correctAnswer` is not literally one of its options is left
 * untouched — scrambling one we cannot re-key would silently break grading.
 */
export function shuffleExamOptions(questions: ExamQuestion[], seed = 0x5eed): ExamQuestion[] {
  const rand = mulberry32(seed);

  return questions.map((q) => {
    if (q.type !== 'multiple_choice' || !q.options || q.options.length < 2) return q;
    if (!q.options.some((o) => o === q.correctAnswer)) return q;

    const next = [...q.options];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rand() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    return { ...q, options: next };
  });
}

// --- Deduplication -----------------------------------------------------------

const STOPWORDS = new Set([
  'the', 'and', 'for', 'that', 'this', 'with', 'from', 'which', 'what', 'when',
  'where', 'who', 'how', 'why', 'are', 'was', 'were', 'has', 'have', 'had',
  'not', 'but', 'all', 'any', 'can', 'does', 'did', 'will', 'would', 'should',
  'following', 'best', 'true', 'false', 'answer', 'question',
]);

/** Lowercased, punctuation-free content tokens, for lexical comparison. */
function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

/**
 * Lexical similarity of two question stems, as Jaccard over content tokens.
 *
 * Deliberate deviation from an embedding-cosine threshold: this app has no
 * embedding endpoint, and calling one per question pair to dedupe a 15-item
 * exam is not a trade worth making. Jaccard runs at zero latency and zero cost.
 *
 * Measured limits, which set the default threshold below. On sample stems:
 *
 *   obvious rewordings        0.80 – 1.00   ("...glucose to..." / "...glucose into...")
 *   same topic, different ask  0.33 – 0.67   ("...catalyses..." / "...inhibits...")
 *
 * The ranges are close, and no lexical metric closes that gap — a bag of tokens
 * cannot tell a reworded duplicate from a question where one content word was
 * swapped for its opposite. So the threshold is deliberately conservative:
 * dropping a genuinely different question biases the exam the learner takes,
 * while keeping a near-duplicate costs only a little repetitiveness. This pass
 * is a safety net behind the prompt's own "do not repeat" instruction, and a
 * safety net should be precise rather than aggressive.
 *
 * Containment (|A∩B| / min) was tried and rejected: "What is ATP?" scores 1.0
 * against "What is ATP synthase?", which are nothing alike.
 */
export function stemSimilarity(a: string, b: string): number {
  const left = tokenSet(a);
  const right = tokenSet(b);
  if (left.size === 0 || right.size === 0) return 0;

  let shared = 0;
  left.forEach((t) => {
    if (right.has(t)) shared += 1;
  });
  return shared / (left.size + right.size - shared);
}

export interface DedupeResult {
  kept: ExamQuestion[];
  dropped: number;
}

/**
 * Default dedupe threshold. Above the highest same-topic-different-question
 * pair measured (0.67), below the lowest obvious rewording (0.80). See
 * stemSimilarity for the evidence.
 */
export const DEDUPE_THRESHOLD = 0.8;

/**
 * Drop near-duplicate stems.
 *
 * Greedy and order-preserving: the first occurrence wins. `against` carries
 * stems from earlier attempts, so a retake tests transfer instead of a
 * memorised answer string.
 */
export function dedupeQuestions(
  questions: ExamQuestion[],
  opts: { threshold?: number; against?: string[] } = {}
): DedupeResult {
  const threshold = opts.threshold ?? DEDUPE_THRESHOLD;
  const kept: ExamQuestion[] = [];
  const keptTokens: Set<string>[] = [];

  const overlaps = (text: string): boolean => {
    for (const q of kept) {
      if (stemSimilarity(q.question, text) >= threshold) return true;
    }
    return false;
  };

  const matchesPrior = (text: string): boolean =>
    (opts.against ?? []).some((prior) => stemSimilarity(prior, text) >= threshold);

  for (const q of questions) {
    const stem = q.question ?? '';
    if (!stem.trim()) continue;
    if (overlaps(stem) || matchesPrior(stem)) continue;
    kept.push(q);
    keptTokens.push(tokenSet(stem));
  }

  return { kept, dropped: questions.length - kept.length };
}

/** Stems the learner has already answered, newest attempt last. */
export function previouslySeenStems(attempts: StoredAttempt[]): string[] {
  return attempts
    .flatMap((a) => a.examQuestions ?? [])
    .map((q) => q.question)
    .filter((stem): stem is string => typeof stem === 'string' && stem.trim().length > 0);
}

// --- The entry point ---------------------------------------------------------

export interface ExamBlueprintInput {
  /** Questions as the Provider (or offline adapter) returned them. */
  generated: ExamQuestion[];
  /** Quota the generation asked for; empty to accept whatever came back. */
  plan?: BloomSlot[];
  /** Stems from previous attempts, to keep a retake from repeating itself. */
  avoidStems?: string[];
  /** Seed for option shuffling; vary per exam so retakes look different. */
  seed?: number;
}

export interface ExamBlueprint {
  questions: ExamQuestion[];
  /** Questions discarded as near-duplicates of an earlier stem. */
  droppedDuplicates: number;
  /** Per-level counts actually delivered, for the results screen. */
  distribution: BloomSlot[];
}

/**
 * Turn a raw generated set into the exam the learner takes: dedupe against
 * itself and their history, repair the cognitive distribution, order for
 * progressive difficulty with interleaved topics, and shuffle MCQ options.
 */
export function buildExamBlueprint(input: ExamBlueprintInput): ExamBlueprint {
  const { kept, dropped } = dedupeQuestions(input.generated, { against: input.avoidStems });
  const enforced = input.plan && input.plan.length > 0 ? enforceDistribution(kept, input.plan) : kept;
  const ordered = orderExamQuestions(enforced);
  const questions = shuffleExamOptions(ordered, input.seed ?? 0x5eed);

  return { questions, droppedDuplicates: dropped, distribution: distributionOf(questions) };
}

// --- Retakes -----------------------------------------------------------------

/** The time-limit choices offered in the Generate form, in minutes. */
export const TIME_LIMIT_OPTIONS = [10, 15, 25, 45] as const;

/**
 * The time limit for retaking an Attempt. Attempts do not store the limit
 * they were sat under, so it is reconstructed: the smallest offered limit
 * that is at least as long as the original sitting (a learner who used 22
 * minutes of a 25-minute exam gets 25 again, not 15). Falls back to the
 * form default when the sitting length is unknown.
 */
export function retakeTimeLimit(attempt: Pick<StoredAttempt, 'timeSpentSeconds'>): number {
  const spent = attempt.timeSpentSeconds;
  if (spent === undefined || !Number.isFinite(spent) || spent <= 0) return 15;
  const minutes = spent / 60;
  return TIME_LIMIT_OPTIONS.find((m) => m >= minutes) ?? TIME_LIMIT_OPTIONS[TIME_LIMIT_OPTIONS.length - 1];
}

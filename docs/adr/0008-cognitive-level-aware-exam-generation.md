# ADR-0008: Cognitive-level-aware exam generation

- Status: Accepted
- Date: 2026-09-07

## Context

Mock exam generation specified *formats* — multiple choice, true/false, short
answer — and nothing else. The prompt was "write N questions about this
material", the material was whichever notes the learner selected concatenated
into one string, and the only recorded property of an answer was `topic`.

Three consequences were visible in the output:

1. **Format was standing in for cognition.** An MCQ can be pure recall or deep
   analysis, so "mix question types" left the cognitive demand of an exam
   entirely to chance. In practice short prompts over-produce recall items.
2. **Coverage followed the material's own emphasis.** One prompt over a whole
   concatenated notes library over-samples whichever topic appears first or
   most often. There was no plan for what should be assessed.
3. **Analytics had one axis.** `computeAnalyticsSummary` reported accuracy per
   topic. A learner strong at recalling glycolysis and unable to apply it read
   as one middling number, and nothing in the app could tell them otherwise.

The design follows the evaluation framework in *From Memorization to Creation*
(arXiv:2606.18257), which measures LLM-generated educational questions against
Bloom's Taxonomy and finds that naming the target knowledge unit and cognitive
level in the prompt raises the share of higher-order output and lowers
repetition, while unguided generation clusters at recall and drifts above or
below the level it was asked for.

## Decision

### Cognitive level is a first-class field, not an emergent property

`ExamQuestion` and `ExamResult` carry `bloomLevel` over the six revised levels
(`BLOOM_LEVELS` in `src/types.ts`). Both fields are optional so attempts
persisted earlier still parse; readers treat `undefined` as *unlevelled* and
never guess a level, because a wrong level silently corrupts mastery history.

The client computes the quota; the server owns the words that ask for it.
`buildBloomPlan(count, mix)` returns `BloomSlot[]`, which travels in the request
body and is rendered into the prompt by `renderBloomPlan`. Keeping them on
opposite sides of one request is what stops the plan and the prompt drifting
apart. Four named mixes (`recall`, `balanced`, `simulation`, `deep`) are the
learner-facing vocabulary; their weights live in the Exam-Blueprint module.

Allocation is largest-remainder with a coverage floor. Naive rounding drifts —
15 × 1/16 floors to 0, so a 15-question balanced exam would contain no Create
items at all. The floor guarantees every weighted level appears when there are
enough questions to cover them, and the counts always sum to the request.

### Two stages: name the ideas, then write against them

`extractKnowledgeUnits` is a new op on the `AiGenerator` port with both
adapters, behind a new `/api/ai/extract-knowledge-units` route. Stage 2
receives the units and is told to write against them and to set
`knowledgeUnitId`. The client skips stage 1 below ~1200 characters of material
or fewer than 8 questions, where there is nothing to over-sample and the extra
round trip is pure latency.

The offline adapter extracts structurally — Markdown headings, then declarative
sentences — and **labels every offline question `remember`**. Sentence
extraction cannot produce analysis or synthesis, and claiming otherwise would
make the mastery dashboard lie about what was practised.

### Generation output is repaired, not trusted

`buildExamBlueprint` is the single entry point feature screens call:

1. **Dedupe** — drop near-duplicate stems, within the exam and against stems
   from earlier attempts, so a retake tests transfer rather than a memorised
   answer string.
2. **Enforce the distribution** — providers miss their target level; take the
   quota per level, then top up from the surplus so the learner still gets the
   count they asked for.
3. **Order** — level ascending for progressive difficulty, with topics
   interleaved inside each level rather than blocked.
4. **Shuffle MCQ options** — models cluster the correct answer at A/B, and
   position is a cue that survives retakes. Safe because grading compares the
   answer string, not an index. A question whose `correctAnswer` is not among
   its options is left untouched rather than silently broken.

### Mastery gains a second axis, and misses get scheduled

`computeAnalyticsSummary` returns `levelStats`, `topicLevelStats` and
`weakTopicLevels` alongside the existing per-topic figures. `computeReviewQueue`
schedules a (topic × level) cell when its most recent answer was wrong, at
expanding intervals (1/3/7/14 days) keyed to the current lapse streak.
`escalatedLevel` reports topics mastered at a level and ready for the next.

Resurfacing is scheduled per cell, not per question: a fresh variant of the
same idea tests the idea, whereas repeating the identical question tests
whether the answer string was memorised.

### Short answers are graded against a rubric

`ExamQuestion.rubric` (2–4 checkable points) is emitted at generation time, the
grader scores against it point by point and returns `rubricEarned`, and the
offline grader does the same by distinctive-word overlap. Rubric grading is
more consistent than free semantic comparison and makes partial credit
legible to the learner.

## Consequences

- The exam a learner takes is a request the model can be held to, and the
  repair pass means drift costs quality, not correctness: the count, the level
  ordering and the answer key all survive a sloppy generation.
- Analytics can now distinguish "strong at recall, weak at application", which
  is the difference between a descriptive and a prescriptive dashboard.
- Deduplication is lexical (Jaccard over content tokens), **not** embedding
  cosine. This app has no embedding endpoint, and one call per question pair to
  dedupe a 15-item exam is not a trade worth making. The measured consequence
  is documented on `stemSimilarity`: obvious rewordings score 0.80–1.00 while
  same-topic-different-question pairs reach 0.67, so the default threshold is
  0.8 — above the hard negatives, below the clear rewordings. Containment
  (`|A∩B| / min`) was tried and rejected: "What is ATP?" scores 1.0 against
  "What is ATP synthase?". A safety net behind the prompt's own "do not repeat"
  instruction should be precise rather than aggressive.
- Stage 1 is an extra Provider round trip on every substantial exam. It is
  skipped for short material, and the progress UI names which stage is running
  so the wait is attributable.

## Deferred

Recorded so these are choices, not omissions:

- **Verification loop.** A judge pass per item (is the answer supported by the
  material, does it match its claimed level, are the distractors defensible)
  with 1–2 capped retries. The distribution-repair pass is the cheap half of
  this; the judge is the expensive half and needs per-provider cost telemetry
  first.
- **Adaptive generation.** `escalatedLevel` is computed and surfaced as "ready
  to move up a level", but it does not yet feed the next exam's plan. Wiring it
  changes what a learner is asked for without them choosing it, so it needs an
  explicit opt-in in the UI first.
- **Structured outputs.** Passing a real JSON schema where a provider supports
  it (OpenAI structured outputs, Gemini `responseSchema`) instead of relying on
  `parseStructuredJson`. Cross-provider, so it belongs in
  `server/aiProvider.ts`, not in these routes.
- **Item psychometrics.** Per-question discrimination, suppressing items every
  learner gets right or wrong. Needs the attempt volume to be meaningful.
- **Pre-question confidence rating.** Sure/unsure per item; high-confidence
  errors are the strongest resurfacing signal. A taking-view change, orthogonal
  to this one.

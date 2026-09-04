# ADR-0001: Consolidate study data into a deep Study-Store module

- Status: Accepted
- Date: 2026-09-04

## Context

The study hub grew three overlapping seams for one concept (the Subject
aggregate): direct `StorageService` calls, a wide `useStudyData` mirror hook,
and per-screen private collections seeded once from storage. Symptoms included
stale lists after switching subjects, a failing `tsc` (dead
`return cachedSettings`), duplicated attempt-persistence paths for quizzes vs
exams, and a burst of overlapping memoization merges (PRs #2–#8) chasing
reference stability that the duplicated state made impossible.

## Decision

Introduce one deep module — `StudyStore` — owning persistence, reactive state,
subject scoping, cascading deletes, and cross-tab sync:

- Public interface: subject-scoped data + small domain ops
  (`selectSubject`, `addSubject`, `deleteSubject`, note/quiz/task CRUD,
  `recordAttempt` (single op for Quiz and Exam), settings, export/import/reset).
- Persistence sits behind an internal `StorageAdapter` seam with two adapters
  (localStorage for the app, in-memory for tests); the seam is private to the
  module and not part of its public interface.
- The active subject lives in the store; screens subscribe to subject-scoped
  slices (`useNotes`, `useQuizzes`, `useAttempts`, …) instead of receiving
  `currentSubject` props. Analytics/Planner filters use a guarded follow
  (`null` = follow active subject; explicit selection = override).
- Consumers were migrated and the old `StorageService` / `useStudyData`
  modules deleted (no external consumers exist).

## Consequences

- One seam to change for freshness, subject scoping, and persistence behaviour.
- Collection references are stable unless data changes, restoring the
  memoization the earlier perf merges were chasing.
- The store's interface is the test surface: `src/services/studyStore.test.ts`
  covers scoping, cascade deletes, notifications, backups (Vitest).
- `recordAttempt` is the only way assessments enter history; exam auto-submit
  now grades current answers (stale-closure bug fixed).

## Notes for future reviews

Do not re-suggest splitting persistence back into a public service with a
per-screen state copy, or re-adding `currentSubject` prop drilling — this ADR
records why both were removed. A single storage adapter is deliberately kept
internal (one adapter = hypothetical seam).

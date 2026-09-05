# ADR-0002: Serve study generation through one AI port with HTTP and offline adapters

- Status: Accepted
- Date: 2026-09-04

## Context

AI generation (notes, quizzes, exams, grading, term explanations) lived in a
shallow `AIService`: callers had to know credential resolution, server
endpoints, error mapping, and the fact that any failure silently swapped in
local heuristic generators. The heuristics were not a hypothetical path — the
Netlify deployment is client-only (no Express server), so on that target every
generation *is* offline — yet offline output was indistinguishable from real
Provider output.

## Decision

One deep module — `src/services/ai` — owns generation. Its port
(`AiGenerator`) exposes the five generation ops, and every result is wrapped
in `GenerationResult<T>` whose `source` is `'model' | 'offline'`, so UIs can
(notes, quizzes, exams and the term-explanation modal now do) mark offline
drafts.

- Two real adapters sit at an internal seam (`GenerationAdapter`):
  `http.ts` (transport to `/api/ai/*`) and `offline.ts` (the former client
  heuristics, moved verbatim).
- Fallback policy lives in exactly one place: any server failure (network,
  HTTP, malformed payload) falls back to offline; user aborts propagate.
- Credentials are resolved inside the module from an injected settings source
  (`createAiGenerator({ getSettings })`); callers never pass keys per call.
- Server-only operations with no offline counterpart (`testConnection`,
  `fetchLiveModels`, `extractPdfText`) deliberately stay OUT of the port —
  one adapter = hypothetical seam. They live in `src/services/aiConnection.ts`
  and fail with explicit errors when the server is unreachable.
- `AIService` was deleted and all seven call sites migrated. The interface is
  the test surface: `src/services/ai/aiGenerator.test.ts`.

## Consequences

- Offline content is always attributable; silent quality degradation ends.
- Adding an AI capability means one op on the port + both adapters + tests at
  the interface.
- Do not re-inline fallback logic into components, or move credentials into
  call sites — this ADR records why both were removed.

## Notes for future reviews

Server-side per-provider execution internals (`executeGemini`,
`executeAnthropic`, `fetchLiveProviderModels` env fallbacks) still hold some
provider literals; folding them fully behind per-provider adapters is
deferred work — not a license to duplicate catalog facts in new code.

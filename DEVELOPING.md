# Developing Temari

The rules that keep this codebase navigable. The domain language lives in
[CONTEXT.md](./CONTEXT.md); architectural decisions and their reasons live in
[docs/adr/](./docs/adr/). Read those before changing anything structural.

## Module map

This is the map. Each row's rules and rationale live in the ADR it names — do
not restate them here.

| Path | Role | Where the rules live |
|---|---|---|
| `src/services/studyStore.ts` | **Study-Store module** — all study data: persistence, reactive state, subject scoping, cascade deletes, cross-tab sync | [ADR-0001](./docs/adr/0001-study-store-deep-module.md) |
| `src/hooks/useStudyStore.ts` | Slice hooks over the store | Thin glue only; stable collection references. |
| `src/services/ai/` | **AI-Generation module** — notes, quizzes, exams, grading, term explanations | [ADR-0002](./docs/adr/0002-ai-generation-port.md) |
| `src/services/examBlueprint.ts` | **Exam-Blueprint module** — pure planning and repair of exam questions: Bloom quota, distribution, ordering, dedupe, shuffling | [ADR-0008](./docs/adr/0008-cognitive-level-aware-exam-generation.md) |
| `src/services/aiConnection.ts` | Server-only AI ops: connection test, live model discovery, PDF extraction | [ADR-0002](./docs/adr/0002-ai-generation-port.md) |
| `shared/aiCatalog.ts` | Provider identity + transport facts, shared by client and server | [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md) |
| `src/components/tools/modelPresentation.ts` | Client-only presentation of the provider catalog | [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md) |
| `src/types.ts` | Domain model + `UserSettings` | Nouns: [CONTEXT.md](./CONTEXT.md) |
| `src/utils/analytics.ts` | Assessment analytics: topic accuracy, Bloom mastery, review queue, streak | Pure functions. |
| `src/components/ui/*` | Shared primitives: `Modal` (+ `useModalOrigin`), `GenerationProgress`, `EmptyState`, `Skeleton`, `CommandPalette`, `SourceMaterialSelector`, `BloomBadge`, toast/confirm/`Kbd` | [ADR-0010](./docs/adr/0010-editorial-design-system.md) |
| `src/Root.tsx` | Entry: `/app` mounts the study shell, everything else the landing page | [ADR-0009](./docs/adr/0009-landing-page-route-split.md) |
| `src/components/landing/*` | Public landing page + the `AsciiSurface` canvas field (`asciiFieldMath.ts`, `surfaceContrast.ts`) | [ADR-0011](./docs/adr/0011-landing-display-variant.md), [ADR-0009](./docs/adr/0009-landing-page-route-split.md) |
| `src/components/nav/*` | App chrome: `HubTabs` / `HubBottomBar` (shared sliding indicator), `SubjectSwitcher`, `StreakPill` | [ADR-0006](./docs/adr/0006-sidebar-removal.md) |
| `src/components/*` | Feature screens | [ADR-0001](./docs/adr/0001-study-store-deep-module.md) / [ADR-0002](./docs/adr/0002-ai-generation-port.md): no fetch, credential or fallback logic in components. |
| `server/app.ts`, `server.ts` | Shared Express API (`/api/ai/*`) + standalone startup/static serving | [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md); routes own prompts. |
| `server/aiProvider.ts` | Provider-agnostic execution dispatcher + JSON parsing | [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md) |

## Ground rules

1. **The interface is the test surface.** Tests for a module go through its
   public interface (`studyStore.test.ts`, `aiGenerator.test.ts`), assert on
   observable behaviour, and survive internal refactors. When a deepened
   module lands, its predecessors' unit tests are deleted, not layered.
2. **Accept dependencies, don't create them.** Modules take a settings source
   or an adapter; only app singletons (`ai`, `aiConnection`, `studyStore`)
   hardwire production wiring.
3. **One adapter = hypothetical seam.** Don't introduce a port unless two
   adapters are justified (typically production + offline/test).
4. **Catalog facts live in one place.** Provider ids, default models, base
   URLs, env key names → `shared/aiCatalog.ts` only (ADR-0003).
5. **Offline content must be identifiable.** Anything produced by the offline
   adapter surfaces `source: 'offline'` — UIs must show it (CONTEXT.md:
   Offline generation).
6. **ADR-0001 stands.** No per-screen state copies of store data, no
   `currentSubject` prop drilling, no public persistence service.

## Motion budget

Animation is spent, not sprinkled: the tier an interaction falls into decides
whether it may animate at all — the rule is frequency, not taste. The tiers and
the reasoning behind them are
[ADR-0005](./docs/adr/0005-motion-budget-and-spatial-consistency.md). Durations
and easings exist only as CSS custom properties in `src/index.css`; components
reference `var(--dur-*)` and never literal milliseconds.

The rules that follow, enforced in code:

1. **Keyboard paths skip transitions.** `runViewTransition(update, { origin })`
   takes `'pointer' | 'keyboard'`; the keyboard origin applies the update
   synchronously. Any new shortcut must pass its origin through.
2. **Do not style bare element selectors with transitions.** Transitions attach
   to opt-in classes (`.btn-kinetic`), never `button`, so the highest-frequency
   element in the app stays free by default.
3. **Hover highlights are instant.** A fading highlight trails the cursor and
   reads as lag.
4. **Every new animation gets a `prefers-reduced-motion: reduce` override in the
   same commit.** Non-negotiable; the block at the bottom of `index.css` is the
   single place for it.
5. **No animation library.** ADR-0004 chose the platform. FLIP + WAAPI + CSS
   variables cover what we need; if something genuinely can't be built without a
   library, write an ADR first.

## How to add a feature

Example: "generate a mindmap from Material".

1. **Domain first**: extend the glossary in `CONTEXT.md` if the feature
   introduces a term; add/extend domain types in `src/types.ts`.
2. **Store**: if it persists, add one op to `StudyStore` (subject-scoped,
   stable references, cascade-aware) + interface tests via the in-memory
   adapter.
3. **AI**: if it generates, add one op to `AiGenerator` + both adapters
   (`http.ts` endpoint call, `offline.ts` heuristic) + tests, and a server
   route in `server.ts` if the model must run server-side. Surface
   `GenerationResult.source` in the UI.
4. **Server**: add a thin route; reuse `executeAiRequest` +
   `parseStructuredJson`; provider facts from the catalog only.
5. **UI**: one component under `src/components/<feature>/`; slice hooks from
   `useStudyStore`; attribution for offline drafts.
6. **Verify**: `npm run lint` (tsc), `npm test` (vitest), `npm run build`.

## Testing

Three layers, cheapest first. All run under one `npm test`.

1. **Pure logic (node).** The default, and the reason ground rule 1 exists:
   extract the decision into a function and test that. `flashcardGesture.ts`,
   `segmentTerm.ts`, `readingPlace.ts`, `examBlueprint.ts`, `studyStore.ts`.
   Extracting a reducer is still the right move even now that jsdom exists —
   a pure function says *why* a gesture committed, a DOM test can only say
   *that* it did.
2. **Source guards (node).** `designSystem.test.ts`, `keyboardOwnership.test.ts`,
   `glossary.test.ts` read a component or the stylesheet and assert on the
   contract: retired tokens stay retired, dialogs are Base UI, canonical nouns
   reach the learner. Use these for "this decision must not silently regress"
   where a rendered assertion would be slower and no more precise.
3. **DOM behaviour (jsdom).** Opt in per file with `// @vitest-environment jsdom`
   plus `@testing-library/react`; the suite stays on node otherwise. Reserved
   for bugs that only exist when the real component is driven — stale closures
   across a state update, focus moving between surfaces, an event that arrives
   from behind a dialog. `FlashcardView.test.tsx` is the worked example: rating
   the last Flashcard used to be dropped from the recorded Attempt, which no
   amount of reading the component would have shown.

Do not reach for layer 3 when layer 1 can express the rule.

## Commands

```bash
npm run dev      # tsx server.ts (Express + Vite middleware, port 3000)
npm run lint     # tsc --noEmit
npm test         # vitest run
npm run build    # vite build + esbuild server bundle → dist/
npm run start    # node dist/server.cjs (production)
```

Note: the Netlify deployment is client-only — `/api/ai/*` is unreachable
there and the AI module's offline adapter serves generation. Test-connection
and PDF extraction fail explicitly by design.

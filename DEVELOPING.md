# Developing Temari

The rules that keep this codebase navigable. The domain language lives in
[CONTEXT.md](./CONTEXT.md); architectural decisions and their reasons live in
[docs/adr/](./docs/adr/). Read those before changing anything structural.

## Module map

| Path | Role | Notes |
|---|---|---|
| `src/services/studyStore.ts` | **Study-Store module** — all study data: persistence, reactive state, subject scoping, cascade deletes, cross-tab sync | Deep module (ADR-0001). Persistence behind an internal `StorageAdapter` seam (localStorage + in-memory adapters). Do not split it back up. |
| `src/hooks/useStudyStore.ts` | React glue over the store (slice hooks) | Thin by design; stable collection references. |
| `src/services/ai/` | **AI-Generation module** — notes/quiz/exam generation, exam grading, term explanations | Deep module (ADR-0002). Port = `AiGenerator`; adapters = HTTP + offline; fallback policy in one place; results always attributable via `GenerationResult<T>`. |
| `src/services/aiConnection.ts` | Server-only AI ops: connection test, live model discovery, PDF extraction | No offline adapter on purpose (one adapter = hypothetical seam, ADR-0002). |
| `shared/aiCatalog.ts` | Single source of truth for provider identity + transport facts | Shared by client AND server (ADR-0003). |
| `src/components/tools/modelPresentation.ts` | Client-only presentation of the provider catalog | Badge colours, copy, curated model lists. Never restate catalog facts. |
| `src/types.ts` | Domain model + `UserSettings` | `Subject`, `StoredNote`, `StoredQuiz` (a Quiz = flashcard deck), `StoredAttempt`, `StudyTask`. |
| `src/components/ui/*` | Shared UI primitives | `Modal` (+ `useModalOrigin` for morph origins), `GenerationProgress`, `EmptyState`, `Skeleton`, `CommandPalette`, `SourceMaterialSelector`. Reach for these before hand-rolling a panel. |
| `src/components/nav/*` | App chrome navigation | `HubTabs` / `HubBottomBar` (desktop header tabs and the mobile bottom bar, sharing the sliding indicator), `SubjectSwitcher`, `StreakPill`. All live in the header; there is no sidebar (ADR-0006). |
| `src/components/*` | Feature screens | Consume the store + `ai` + `aiConnection`. No fetch calls, no credential logic, no fallback logic in components. |
| `server.ts` | Express API (`/api/ai/*`) + static serving | Thin transport over `server/aiProvider.ts`; routes own prompts. |
| `server/aiProvider.ts` | Provider-agnostic execution dispatcher + JSON parsing | Transport mechanism per provider; facts from the shared catalog. |

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

Animation is spent, not sprinkled. The tier a interaction falls into decides
whether it may animate at all — the rule is frequency, not taste. Durations and
easings live as CSS custom properties in `src/index.css`; components reference
`var(--dur-*)` and never literal milliseconds.

| Frequency | Examples in Temari | Animation |
|---|---|---|
| 100+/day, **any keyboard-initiated action** | Tab keys 1–5, Escape, future shortcuts | **None, ever.** |
| Tens/day | Hub tab hover, header control colour | Instant state change; press depress only |
| Occasional | Modals, drawers, tab clicks, toasts | Standard — `--dur-panel` / `--dur-layout` |
| Rare / first-run | Ghost-hand swipe hint, celebration | May exceed the budget; this is the novelty spend |

Rules that follow from it:

1. **Keyboard paths skip transitions.** `runViewTransition(update, { origin })`
   takes `'pointer' | 'keyboard'`; the keyboard origin applies the update
   synchronously. Any new shortcut must pass its origin through.
2. **Do not style bare element selectors with transitions.** Transitions attach
   to opt-in classes (`.btn-kinetic`, `.btn-neo`), never `button`, so the
   highest-frequency element in the app stays free by default.
3. **Hover highlights are instant.** A fading highlight trails the cursor and
   reads as lag.
4. **Every new animation gets a `prefers-reduced-motion: reduce` override in the
   same commit.** Non-negotiable; the block at the bottom of `index.css` is the
   single place for it.
5. **No animation library.** ADR-0004 chose the platform. FLIP + WAAPI + CSS
   variables cover what we need; if something genuinely can't be built without a
   library, write an ADR first.

The full rationale and the remaining workstreams are in
[docs/ui-plan-spatial-consistency.md](./docs/ui-plan-spatial-consistency.md).

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

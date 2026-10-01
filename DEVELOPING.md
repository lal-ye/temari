# Developing Temari

The rules that keep this codebase navigable. The domain language lives in
[CONTEXT.md](./CONTEXT.md); architectural decisions and their reasons live in
[docs/adr/](./docs/adr/). Read those before changing anything structural.

The standalone web app is retired ([ADR-0014](./docs/adr/0014-expo-web-and-android.md)).
The product is two packages and one Expo app. This file was rewritten on
2026-10-01; the previous module map described deleted web-era code.

## Module map

Each row's rules and rationale live in the ADR or record it names — do not
restate them here.

| Path | Role | Where the rules live |
|---|---|---|
| `packages/core/src/types.ts` | Domain model + `UserSettings` | Nouns: [CONTEXT.md](./CONTEXT.md) |
| `packages/core/src/portable.ts` | **temari-portable v1** — validate/parse/create/serialize + legacy v1 backup migration | [`docs/mobile/PORTABLE-EXPORT.md`](./docs/mobile/PORTABLE-EXPORT.md) |
| `packages/core/src/ai/` | **AI-Generation port** — contracts, HTTP + offline adapters, error diagnosis | [ADR-0002](./docs/adr/0002-ai-generation-port.md) |
| `packages/core/src/aiCatalog.ts` | Provider identity + transport facts | [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md) |
| `packages/reader-core/` | **Shared reader** — `NoteContent`/`NoteReader`, DOM↔native bridge, sanitize/CSP, diagrams, markdown, selection, session guards | [M2 records](./docs/mobile/M2-READER-SPIKE.md) |
| `apps/mobile/` | **The Expo app** — routes, native screens, the one `'use dom'` seam | [ADR-0014](./docs/adr/0014-expo-web-and-android.md) |
| `scripts/*.mjs` | Gates: reader boundary/export, core boundary, mobile import guard | root `package.json` |

## Ground rules

1. **The interface is the test surface.** Tests for a module go through its
   public interface, assert on observable behaviour, and survive internal
   refactors. When a deepened module lands, its predecessors' unit tests are
   deleted, not layered.
2. **Accept dependencies, don't create them.** Modules take a settings source
   or an adapter; only app singletons hardwire production wiring.
3. **One adapter = hypothetical seam.** Don't introduce a port unless two
   adapters are justified (typically production + in-memory test).
4. **Catalog facts live in one place.** Provider ids, default models, base
   URLs, env key names → `packages/core/src/aiCatalog.ts` only (ADR-0003).
5. **Offline content must be identifiable.** Anything produced by the offline
   adapter surfaces `source: 'offline'` — UIs must show it (CONTEXT.md:
   Offline generation).
6. **ADR-0001 stands where it applies.** The web store is deleted; its
   principles carry into every new persistence seam: one write path for
   Attempts, no per-screen state copies, no prop drilling of the Active
   Subject.

## Motion budget

Animation is spent, not sprinkled: the tier an interaction falls into decides
whether it may animate at all — the rule is frequency, not taste. The tiers and
the reasoning live in [ADR-0005](./docs/adr/0005-motion-budget-and-spatial-consistency.md);
[ADR-0014](./docs/adr/0014-expo-web-and-android.md) keeps the craft rules
alive on mobile. Durations and easings exist only as CSS custom properties in
the reader's stylesheet (`packages/reader-core/reader.css`); native screens
reference tokens, never literal milliseconds, and every animation ships its
reduced-motion handling in the same commit.

## How to add a feature

Example: "add a Drill rating control".

1. **Domain first**: extend the glossary in `CONTEXT.md` if the feature
   introduces a term; add/extend domain types in `packages/core`.
2. **Persistence**: if it persists, add one op to the repository, interface
   tests via the in-memory backend.
3. **AI**: if it generates, add one op to the AI port + both adapters
   (`http`, `offline`) + tests. Surface `GenerationResult.source` in the UI.
4. **Reading**: if it renders inside a Note, extend `packages/reader-core` —
   never a screen-local renderer copy.
5. **UI**: one route/screen under `apps/mobile/app`. Reach shared code
   through the `@/*` tsconfig alias — `check-mobile-imports` flags any
   specifier starting `../..`.
6. **Verify**: `bun run typecheck:all`, `NODE_ENV=test bun run test`;
   integration: `bun run check:mobile`.

## Testing

Three layers, cheapest first.

1. **Pure logic (node).** The default. The drill machine, repository
   coordinator, portable parser and session guards live in `packages/`
   precisely so the phone is not the test surface.
2. **Source guards (node).** `check-reader-boundary`/`check-reader-export`,
   the core boundary (no `node:`/DOM globals in packages/core),
   `check-mobile-imports`, CSP tests — use these for "this decision must not
   silently regress".
3. **Device (phone).** `apps/mobile` is **not** vitest-collected. Screens stay
   thin wiring over `@temari/core` + `@temari/reader-core`, verified by
   typecheck + the export gate + the current milestone plan's phone
   checklist. reader-core still uses jsdom per-file for DOM-behaviour pins;
   do not reach for it when layer 1 can express the rule.

Device-test corpora live in `fixtures/mobile/` — credential-free by rule.

## Commands

```bash
bun run check:reader          # reader-core boundary + Node SSR smoke
NODE_ENV=test bun run test     # vitest — collects packages/** only
bun run typecheck:all          # root + core + reader + mobile
bun run check:mobile:imports   # no ../../ specifiers in apps/mobile
bun run check:mobile           # typecheck:mobile + CI=1 expo export + reader export check
```

Run `expo`/`eas` from `apps/mobile` (see
[`docs/mobile/EAS-BUILD.md`](./docs/mobile/EAS-BUILD.md)). Native
dependencies land rarely and in one slice, to minimise development builds.

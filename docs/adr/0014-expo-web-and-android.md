# ADR-0014: One Expo app for web and Android; the standalone web app retires

- Status: Accepted
- Date: 2026-09-30
- Plan: [docs/archive/WEB-RETIREMENT-PLAN.md](../archive/WEB-RETIREMENT-PLAN.md) (shipped 2026-09-30)
- Supersedes: [ADR-0004](./0004-native-css-view-transitions.md),
  [ADR-0005](./0005-motion-budget-and-spatial-consistency.md),
  [ADR-0006](./0006-sidebar-removal.md),
  [ADR-0009](./0009-landing-page-route-split.md),
  [ADR-0010](./0010-editorial-design-system.md),
  [ADR-0011](./0011-landing-display-variant.md),
  [ADR-0012](./0012-netlify-byok-functions.md),
  [ADR-0013](./0013-render-single-service.md) — their status lines flip to
  `Superseded by ADR-0014` in place when the deletion lands; the files do not move.

## Context

Through 2026-09-12 the product was a Vite/React app in `src/` with an Express
API, deployed to Render ([ADR-0013](./0013-render-single-service.md)) with a
Netlify alternative ([ADR-0012](./0012-netlify-byok-functions.md)). The mobile
prototype then proved the successor: one Expo app (`apps/mobile`, SDK 57,
React Native 0.86 new architecture) serving both platforms, with the reader
rendered by `'use dom'` + `expo/dom` — not a WebView — fonts embedded offline
(24 WOFF2 in the exported Android bundle), and a typed DOM↔native bridge with
an absolute-HTTPS link policy (checkpoint B; gate matrix green 2026-09-28).

Meanwhile the gate matrix still certifies the old tree almost exclusively: 25
of 34 test files and the entire `build:render` gate cover the abandoned app,
and the forward shell is reached by exactly one gate (`typecheck:mobile`)
([WEB-RETIREMENT-PLAN §1](../archive/WEB-RETIREMENT-PLAN.md)). Certifying a corpse
while shipping its successor is the state this ADR closes.

## Decision

1. **The Expo app is the product** — one codebase serving web and Android.
2. **The standalone web app, its server and its deployment surface are
   deleted**, in the retirement plan's ordering: promote the sealed
   `reader-core` package and absorb the AI port into `packages/core` *before*
   deleting anything; re-gate and delete in one atomic PR; no history rewrite
   (one `git revert` from undo). The live Render/Netlify services are killed by
   hand — nothing in the repo can do that.
3. **The gate matrix certifies the forward product**: `check:reader`,
   `NODE_ENV=test bun run test`, `typecheck:all`, and `check:mobile` =
   `typecheck:mobile` + `CI=1 bunx expo export --platform android` +
   `check:reader:export` — the real Hermes bundle, not a placeholder test.
4. **Which editorial rules survive `expo start --web`** — recorded here so the
   next person neither rebuilds nor discards them arbitrarily. Craft rules
   carry over; DOM-platform mechanisms do not:

| Rule | From | Survives? |
|---|---|---|
| Motion budgeted by frequency; keyboard-initiated actions never animate | [ADR-0005](./0005-motion-budget-and-spatial-consistency.md) §1 | **Yes, as written** — a craft rule, platform-free |
| Motion says where a thing came from (morph from its trigger; one travelling indicator) | ADR-0005 §2 | **Principle yes, mechanism no** — View Transitions/FLIP are DOM tools; the native equivalent is shared-element transition |
| Gestures track the input and commit by cost of being wrong; velocity alongside distance | ADR-0005 §3 | **Yes** — applies to the RN gesture layer unchanged |
| Every new animation ships a reduced-motion override | ADR-0005 | **Yes** — via the OS reduce-motion accessibility setting |
| Surface ramp: hairline border + surface tint + whisper shadow, L0–L3 | [ADR-0010](./0010-editorial-design-system.md) §1 | **Yes** — the visual language carries; tokens are re-expressed natively |
| Playfair Display headings, Geist Variable body, tabular figures, Abyssinica SIL first-class | ADR-0010 §2 | **Yes** — the reader already embeds exactly these faces (`check:reader:export` asserts the inventory) |
| One accent (Academic Amber) + the ~10%-tint sibling recipe | ADR-0010 §3 | **Yes** |
| Diagrams keep their own figure grammar (hairline editorial SVG, no Mermaid) | ADR-0010 §4 | **Yes, literally** — `FigureRenderer` lives in `reader-core` and survives the retirement |
| Controls are primitives, never hand-rolled | ADR-0010 §5 | **Rule yes, components no** — `src/components/ui/*` dies with the web app |
| Print is the editorial system on paper | ADR-0010 §6 | **No** — the browser print pipeline dies with the web app |
| CSS View Transitions for tab navigation | [ADR-0004](./0004-native-css-view-transitions.md) | **No** — a DOM-platform API |
| Header-only chrome, no sidebar | [ADR-0006](./0006-sidebar-removal.md) | **No** — it decided the web shell's chrome; the native shell composes its own |
| Landing at `/`, study shell at `/app`; the ASCII-hero display variant | [ADR-0009](./0009-landing-page-route-split.md), [ADR-0011](./0011-landing-display-variant.md) | **No** — landing dies with the web app; rebuild deliberately if Expo web ever ships publicly |
| Netlify functions / one Render service | ADR-0012, ADR-0013 | **No** — there is no server in the product |

## Consequences

- The suite falls from 34 files / 466 tests to ~10 **by design** — the deleted
  files certified a deleted product. `reader-core` is promoted with its seal
  intact (`check:reader` follows it); the AI port, the Provider catalog and the
  domain types move into `packages/core` under a **Node-free / Hermes-safe**
  criterion; the transport (`server/aiProvider.ts`) is deleted — M4 exhumes it
  from history if the BYOK architecture turns out to need a server.
- End shape: two packages + one app — `packages/core`, `packages/reader-core`,
  `apps/mobile`.
- The superseded ADRs stay in place, superseded — not deleted, not relocated.
- Deletion commit: `35d33295e177317a9e434168d0c338205372da6f` (PR B — the web tree dies here; everything before it is one `git log` away).
- Physical-device evidence remains the standard: the checkpoint-B phone
  checklist gates the retirement's start, and is re-run after the promotion PR
  because that PR moves exactly the paths the evidence certifies.

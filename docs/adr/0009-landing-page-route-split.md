# ADR-0009: Landing page at `/`, study shell at `/app`, no router

- Status: Accepted
- Date: 2026-09-07
- Plan (historical): [docs/archive/ui-plan-landing-page.md](../archive/ui-plan-landing-page.md)

## Context

Temari booted straight into the study shell with seeded demo Subjects. A
visitor arriving from a link had to infer what the product was from inside
it. A landing page fixes that, but it raises two structural questions the
plan had to settle: how two screens share one SPA with no router, and how to
get the reference hero effect (performative-ui's `AsciiHero`) without taking
on a component library.

## Decision

### 1. Path split with `pushState`, not a router

`src/main.tsx` renders `src/Root.tsx`. `Root` holds one piece of state, the
pathname, updated by `popstate` and by its own `navigate()`. `/app` and
anything beneath it mounts `App`; every other path mounts `LandingPage`.

There are two screens. A router earns its dependency when there are routes to
declare, nested layouts, loaders or link components; with a single boolean it
would be 40 lines of our code replaced by a package and a new mental model.
`App.tsx` keeps its tab state exactly as it was: the hubs are not routes and
this ADR does not make them routes.

`App` is `lazy()`. The landing entry chunk carries React, lucide icons, the
canvas hook and the page; the store, the AI module, recharts and KaTeX arrive
on the CTA click. Verified in the production build: the `/` chunk is ~70 kB
gzipped and contains none of the study code.

Both deploy targets already fall back to `index.html` for unknown paths
(`netlify.toml`, `public/_redirects`, `server.ts`), so `/app` needs no
configuration.

### 2. Port the hero hook, do not install the package

`performative-ui` is MIT-licensed. Its `useAsciiField` hook is ~200 lines. We
ported it to `src/components/landing/` instead of adding the dependency,
because:

- The package is a whole parody component library with its own stylesheet;
  we want one hook.
- The original never stops: no `prefers-reduced-motion` path, no pause when
  the tab is hidden or the element scrolled away, and a `window` mousemove
  listener for the page's lifetime. All three conflict with the motion budget
  (ADR-0005) and needed owning the code to fix.
- The cell metrics had to be re-measured after `document.fonts.ready` so the
  grid matches JetBrains Mono rather than the fallback face.

The arithmetic is split into `asciiFieldMath.ts` (pure, unit-tested in node)
and the hook is the DOM glue. Attribution is in both file headers and on the
page footer.

### 3. The landing page never imports study code

`LandingPage.tsx` imports the shared Provider catalog and the domain type
constants (`BLOOM_LEVELS`), both of which are dependency-free, and nothing
else from the app. Opening `/` creates no localStorage key. The Bloom badge
tones are restated on the page rather than imported from `BloomBadge`, which
would pull in the Exam-Blueprint module; the comment there names the coupling.

## Alternatives considered

**Show the landing page only on first visit, then redirect to the shell.**
Rejected for now. A redirect that depends on storage state is surprising
(clear your data, get a different page), and it makes the landing page
un-bookmarkable for anyone who has used the app. Listed as a follow-up in the
plan if there is a reason to revisit.

**A separate `landing.html` via Vite multi-page.** Rejected. It isolates the
bundle, but duplicates the font and CSS setup and turns "Open Temari" into a
full page load. The lazy chunk achieves the isolation without either cost.

**`react-router`.** Rejected as above: one boolean does not justify it. If a
third top-level screen ever appears, revisit this ADR rather than adding a
fourth branch to `Root`.

## Consequences

- Deep links into the app are `/app`; `/` is the marketing surface. Anything
  that previously pointed at `/` expecting the shell must point at `/app`.
- The landing page is a client-rendered React tree, so crawlers without JS
  see the `index.html` meta tags and nothing else. Acceptable for a
  self-hosted study tool; an Open Graph image is the follow-up that matters.
- `Root` is the second place (after `App`) that knows about the browser
  history. It is the only place that calls `pushState`.
- Adding a section to the landing page must not add a study import. The
  guardrail is the chunk check in the plan's definition of done.

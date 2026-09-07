# UI Plan — Landing Page

Status: WS-1 through WS-6 shipped · Date: 2026-09-07 · Branch: `arena/01a07d18-temari`

This plan adds a public landing page to Temari. Today the app boots straight
into the study shell (`src/App.tsx`) with seeded demo Subjects; a visitor who
follows a link has no idea what Temari is before they are inside it. The page
answers that in one screen, then gets out of the way.

The visual reference is the `AsciiHero` component from
[performative-ui](https://vorpus.github.io/performativeUI/#/components/ascii-hero):
a canvas-rendered procedural ASCII field that reacts to the cursor, used at
low opacity as a hero background with a cursor spotlight. We port the idea,
not the package (see §2).

Decisions confirmed with the owner before writing this plan:

| Question | Decision |
|---|---|
| Where does the page live? | `/` is the landing page, `/app` is the study shell. |
| Hero treatment | ASCII ramp painted with Temari's accent palette, cursor spotlight, dim at rest. |
| Calls to action | "Open Temari" (primary) and the GitHub repository (secondary). No accounts exist, so there is nothing else to link to. |
| Scope of this session | Plan, ASCII hero, full page, route split, docs. |

---

## 1. What the reference actually does

Read from the source (`src/hooks/useAsciiField.ts`, MIT):

| Mechanism | Detail | What we keep |
|---|---|---|
| Grid | A `<canvas>` sized to its host via `ResizeObserver`; cells are `measureText("M")` wide and `fontSize * 1.15` tall. | Same. Cell metrics come from the real font so the grid never drifts from the glyphs. |
| Base field | Seeded once per resize: diagonal stripes plus a radial falloff from the centre. | Same shape. It is what makes the field read as a single object rather than static. |
| Motion | A slow sine wave (`0.15 * sin(x, t) * cos(y, t)`) breathes through the field every frame; frames are throttled to `frameMs` (50ms). | Same, but throttled to 60ms and paused when the page is hidden or the hero is off-screen. |
| Cursor | Tracked on `window` so overlays do not swallow it. A Gaussian bump plus a ring at `rippleRadius` changes *which* glyph a cell shows; a wider Gaussian raises the *alpha* toward `spotlightOpacity`. | Same two-part response. Ripple changes the glyph, spotlight changes the alpha. |
| Colour | Per-cell palette index from `(x * 0.1 + y * 0.07 + t * 0.12) % palette.length`. | Same formula, Temari palette. |
| Reduced motion | None. | Added. Under `prefers-reduced-motion: reduce` the field renders one static frame and the cursor does nothing. |
| Touch | None; the field is inert on phones. | Accepted, but the resting opacity is raised on coarse pointers so the hero is not a blank card on mobile. |

## 2. Why port instead of `npm install performative-ui`

- The package ships a whole parody component library (30 KB) and its own
  stylesheet for one 200-line hook. DEVELOPING.md's rule is "no animation
  library" (ADR-0004); a canvas hook is not an animation library, but pulling
  in the package for it is the same trade the ADR refused.
- The hook has no reduced-motion path, no visibility pause, and a `window`
  listener that keeps running under any overlay. All three need fixing for
  Temari's motion budget, which means owning the code.
- MIT licence permits it. The port is attributed in the file header.

## 3. Current state audit

| Area | Today | Consequence for this work |
|---|---|---|
| Routing | None. `App.tsx` is a five-tab SPA with no router; tabs are React state. | Introduce the smallest possible route split: `/app` renders `App`, everything else renders `Landing`. `history.pushState` + `popstate`, no router dependency. |
| Entry | `main.tsx` renders `<App />` directly. | `main.tsx` renders a `Root` that picks by `location.pathname`. `App` is `lazy()` so a landing visit does not download recharts, KaTeX, the store or the AI module. |
| Deploy fallbacks | `netlify.toml` and `public/_redirects` send `/*` to `index.html`; Express does the same in production (`server.ts` `app.get('*')`). | `/app` works on every deploy target with no config change. |
| Seed data | The store seeds demo Subjects on first run. | The landing page must not touch the store: opening it must not create localStorage keys. `App` stays the only place that imports `studyStore`. |
| Brand | Ethiopic wordmark (`ተ` tile + "Temari" in Playfair), warm paper `#FAF8F5`, ink `#0F172A`, hard 1px borders, offset `shadow-neo-*`. | The page uses the same tokens and classes. No new palette. |
| Fonts | Abyssinica SIL self-hosted for Ethiopic; JetBrains Mono from Google Fonts for code. | The canvas field must measure cells *after* JetBrains Mono loads (`document.fonts.ready`), or the grid is computed for the fallback font and reflows. |
| Motion budget | Tiered by frequency (DEVELOPING.md). Rare / first-run may exceed the budget. | A landing hero is seen once per visitor: it sits squarely in the novelty tier and may animate continuously, provided it stops under reduced motion and when not visible. |
| Copy rules | `docs/ui-audit-taste-skill.md`: no fabricated numbers, no decorative status dots, no em-dashes in rendered strings, one middle dot per line. | The page shows no invented stats ("10k learners"), no fake testimonials, no logo wall. Every claim maps to a shipped feature. |
| Glossary | CONTEXT.md fixes the vocabulary: Subject, Material, Note, Quiz, Drill, Exam, Attempt, Cognitive Level, Provider, BYOK, Offline generation. | Landing copy uses these words. It says "Exam", not "test"; "Material", not "document". |

## 4. Workstreams

### WS-1 — Route split ✅ shipped

`src/main.tsx` renders `src/Root.tsx`, which owns one piece of state: the
pathname. `/app` (and anything under it) mounts the study shell; every other
path mounts the landing page. `Root` listens to `popstate` so the browser
back button works between the two, and exposes `navigate(path)` to the landing
CTA. There is no third route, so there is no router.

Files: `src/Root.tsx` (new), `src/main.tsx` (edited), `src/App.tsx` (unchanged
except that it no longer needs to be the entry).

The `App` import is `lazy()`: the landing page's JS is the hero hook, the page
component and React. Everything study-related loads on the CTA click, behind
a `Suspense` fallback that reuses the existing header skeleton so the
transition does not flash white.

### WS-2 — `AsciiField` primitive ✅ shipped

`src/components/landing/useAsciiField.ts` and `AsciiField.tsx`. A port of the
reference hook with these changes:

1. **Reduced motion**: renders one frame at `t = 0` and returns. No `mousemove`
   listener is attached. The static field still shows the stripes-plus-radial
   shape, so the hero is not empty.
2. **Visibility**: an `IntersectionObserver` on the host and `visibilitychange`
   on the document pause the loop when the hero is scrolled away or the tab is
   hidden. The reference burns a frame every 50ms forever.
3. **Font readiness**: `document.fonts.ready` triggers one re-measure so the
   cell size matches JetBrains Mono, not the fallback.
4. **Pointer type**: on `(pointer: coarse)` the resting opacity is raised
   (there is no cursor to earn the spotlight with).
5. **Palette**: `['#0D9488', '#F59E0B', '#E11D48', '#FDE047']`, the four
   accent colours already used by `shadow-neo-teal`, `-amber`, `-rose` and the
   focus ring on dark surfaces. Default glyph colour without a palette is the
   ink `#0F172A`.

The pure parts (field seeding, cell value, palette index) live in
`asciiFieldMath.ts` and are unit-tested in node without a canvas; the hook is
the DOM glue over them.

### WS-3 — Page sections ✅ shipped

One component per section under `src/components/landing/`, composed in
`LandingPage.tsx`. Order and content, top to bottom:

| Section | Content | Why it is there |
|---|---|---|
| Nav | `ተ` tile + "Temari" wordmark, GitHub link, "Open Temari" button. | Same brand block as the app header, so the transition to the app is continuous. |
| Hero | Field behind, on top: the Ethiopic word ተማሪ as a display glyph, the one-line promise, one paragraph, two CTAs. | The reference's "hero background" example. Dim at rest; the cursor is what lights it up. |
| The loop | Material → Notes → Quiz → Exam → Analytics, as a five-step row using the real hub icons. | This is the product. Five nouns from the glossary, in the order a learner meets them. |
| Cognitive levels | The six Bloom levels using the same `BloomBadge` tones as the app, with one sentence on why a question's format says nothing about its level. | The one thing that distinguishes Temari's Exams from a quiz generator (ADR-0008). |
| Bring your own key | The Provider list from `shared/aiCatalog.ts` (the catalog is the single source of truth; the page reads it rather than restating it), plus the offline-generation promise. | Answers the two questions a developer asks first: which models, and what happens with no key. |
| Footer | Repository link, licence note for the ported hook, "Open Temari". | Bookend. |

No pricing, no testimonials, no metrics. The page has nothing true to say in
those sections, and the taste audit's first finding was fabricated data.

Two things were cut during review for the same reason. The loop cards briefly
carried Amharic subtitles per noun; the app itself never translates its
vocabulary (only Subjects carry an Amharic title, supplied by the learner), so
a translation invented for the page would have been decoration. And the
footer said "open source", which the repository cannot back until it has a
LICENSE file; it now says "public on GitHub", which is true.

### WS-4 — Motion and accessibility ✅ shipped

- The field is `aria-hidden`; the hero's text is ordinary DOM, so screen
  readers get the headline and the buttons, not the canvas.
- Focus order: nav links, primary CTA, secondary CTA, then sections. The
  focus ring is the existing ink ring from `index.css`.
- Reduced motion: field static (WS-2); no other section animates at all. The
  section reveal is a plain layout, not a scroll-triggered fade.
- Contrast: hero text is `#0F172A` on `#FAF8F5` with the field at `0.18`
  alpha behind it. Under the spotlight (`0.85`) the field brightens locally,
  but the text sits on a solid paper-coloured plate with a 1px border, so the
  headline never competes with glyphs directly beneath it.

### WS-5 — Metadata ✅ shipped

`index.html` already carries a title, description and Open Graph tags that
describe the product; they now describe the landing page too. Added
`theme-color` for the paper background. No OG image is generated in this pass
(follow-up, §7).

### WS-6 — Docs ✅ shipped

- `README.md`: one line under "Start here" pointing at this plan, and the
  route split under "Commands".
- `DEVELOPING.md`: `src/Root.tsx` and `src/components/landing/*` added to the
  module map, with the rule that the landing page never imports the store.
- `docs/adr/0009-landing-page-route-split.md`: records the no-router decision
  and the port-not-install decision so they are not relitigated.

## 5. Sequencing

WS-2 first (the hook is the risk: canvas, fonts, resize), then WS-1 (small,
mechanical), then WS-3 with the hook already proven, then WS-4 as a pass over
the finished page, then WS-5 and WS-6.

## 6. Guardrails

1. **The landing page does not import the store, the AI module or
   `App.tsx`.** Its bundle must stay small enough that the split is worth
   having. Verified by `vite build` chunk output: the entry chunk must not
   contain recharts or KaTeX.
2. **No new dependency.** The hook is ~200 lines; the router is ~40.
3. **Every claim on the page maps to a shipped feature.** If a section needs
   a number, it is a number from the code (six Bloom levels, seven Providers),
   not a marketing figure.
4. **Motion tier**: the field is the *only* continuous animation on the page,
   and it stops when hidden, off-screen or under reduced motion.
5. **Copy follows CONTEXT.md and the taste audit**: glossary nouns, no
   em-dashes in rendered strings, one middle dot per line at most.
6. **`/app` keeps working with no deploy config change.** Checked against
   `netlify.toml`, `public/_redirects` and `server.ts`.

## 7. Follow-ups not in scope here

- An Open Graph image rendered from the hero (the reference repo does this
  with `@resvg/resvg-js` at build time; worth copying once the page settles).
- Screenshots or a short screen recording of the app in the loop section,
  replacing the icon row. The repo has raw screenshots under
  `docs/screenshots/`, but they predate the header redesign and need retaking.
- A "first-run" variant: send returning learners (any `studySmarts*` key in
  localStorage) from `/` straight to `/app`. Deliberately not done now: the
  owner chose the path split, and a redirect that depends on storage state is
  the kind of behaviour that surprises people. Revisit once there is a reason.
- Dark theme. `UserSettings.theme` exists but the app renders light only; the
  landing page follows the app.

## 8. Definition of done

- `npm run lint`, `npm test`, `npm run build` pass.
- `/` renders the landing page without creating any localStorage key.
- `/app` renders the study shell exactly as before; the five tabs, palette and
  shortcuts are untouched.
- Browser back from `/app` returns to `/` without a reload.
- The ASCII field: fills its container, re-measures on resize and font load,
  reacts to the cursor with a glyph ripple and an opacity spotlight, pauses
  when off-screen or hidden, is static under reduced motion.
- The production entry chunk for `/` excludes recharts, KaTeX and the store.
- This document, the ADR and the two developer docs are updated.

# ADR-0004: Native CSS View Transitions for tab navigation (not react@canary)

- Status: Accepted
- Date: 2026-09-05

## Context

The app is a tab-based SPA with no router; switching tabs swaps the manager
component in a single `<main>`. We wanted smooth, native-feeling transitions
between tabs (lateral navigation) plus state-change reveals (modals,
flashcards), without introducing an animation library.

React 19 stable does **not** ship the `<ViewTransition>` component — that API
only exists on `react@canary` outside Next.js. The browser-native
`document.startViewTransition` (v2 object form) is available in Chromium 125+,
Firefox 144+ and Safari 18.2+.

## Decision

Use the platform's CSS View Transitions API directly:

- `src/utils/viewTransition.ts` exposes `runViewTransition(update)` — a
  feature-detecting wrapper around `document.startViewTransition` that falls
  back to an instant swap on unsupported browsers.
- Tab switches call it around the state update. Persistent chrome (sidebar,
  header) carries stable `view-transition-name`s (`.app-sidebar`,
  `.app-header`) so only the content area (`.app-main`) cross-fades — a bare
  fade, matching the "lateral navigation → no depth" guidance.
- Modal enter/exit and flashcard reveals are plain CSS keyframe animations
  (`.modal-panel-in/out`, `.flashcard-reveal`), triggered by a keyed wrapper.
- All decorative animation is disabled under `prefers-reduced-motion`.

We deliberately did **not** upgrade to `react@canary` for `<ViewTransition>`:
canary React in a working app is a risk not justified by five tab switch
animations, and the platform API covers the same ground with graceful
degradation. `motion` was already installed but unused; it was removed rather
than adopted for the same reason.

## Consequences

- No runtime dependency for animation; unsupported browsers get an instant,
  correct swap.
- Future features (e.g. list→detail shared-element morphs) can reuse the same
  helper with `view-transition-name`s; re-evaluate `react@canary` only if
  `<ViewTransition>`'s React-tree semantics become required.
- Directional slides stay reserved for hierarchical navigation — do not add
  slides to tab switching, it falsely implies spatial depth.
- Do not replace `runViewTransition` with `window.confirm`-style blocking UI or
  add a new animation library without revisiting this ADR.
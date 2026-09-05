# UI Plan — Spatial Consistency, Fluid Morphing, and Motion Budget

Status: proposed · Date: 2026-09-05 · Branch: `arena/01a07167-temari`

This plan turns the learn-ui "Invisible details" curriculum (spatial consistency,
fluid morphing, responsive gestures, kinetic physics, frequency & novelty) into
concrete, scoped work items for Temari. It is written against the code as it
exists today (`src/App.tsx`, `src/components/ui/Modal.tsx`, `src/index.css`,
`src/utils/viewTransition.ts`).

---

## 1. What the references actually say

| Source | The rule Temari must obey |
|---|---|
| [learn-ui · Spatial consistency](https://learn-ui.com/chapters/invisible-details/spatial-consistency) | The direction an element arrives from must match where it came from. A panel that lives inside a button grows from that button. Morph, don't cut — the eye should never lose the element (object permanence). |
| [learn-ui · Responsive gestures](https://learn-ui.com/chapters/invisible-details/responsive-gestures) | Wire the continuous part of a gesture to the continuous part of the input *before* any threshold logic. Every in-flight animation must be interruptible by the gesture that started it. |
| [learn-ui · Kinetic physics](https://learn-ui.com/chapters/invisible-details/kinetic-physics) | Lightweight actions may fire mid-swipe once elements reach their logical position; destructive actions wait for release. Momentum (velocity) is a trigger alongside distance. |
| [learn-ui · Frequency & novelty](https://learn-ui.com/chapters/invisible-details/frequency-and-novelty) | 100+/day and all keyboard-initiated actions: no animation, ever. Tens/day: drastically reduced. Occasional (modals, drawers): standard. Rare/first-run: delight. Aim for 90% familiar, 10% novel. |
| [beautifului.dev](https://www.beautifului.dev/) | Primitive-level craft: one component per concern, states (loading / streaming / empty / error) are designed, not afterthoughts. Temari's AI generation flows need the same treatment. |
| [font.et](https://www.font.et/) | Ethiopic typography is a first-class design axis, not a fallback. Current stack leans on `local()` + one Google TTF; the Ethiopic face should be chosen and loaded deliberately. |
| [cathrynlavery/diagram-design](https://github.com/cathrynlavery/diagram-design) | Editorial diagrams: self-contained HTML+SVG, **no shadows**, no Mermaid slop. Temari already went native (`EditorialDiagram.tsx`); keep it aligned with that grammar. |

The important tension for Temari: the codebase currently animates *a lot*
(`index.css` has button spring transitions applied globally to every `button`,
deck stagger, ghost hands, pulse rings). Frequency-and-novelty says most of that
is a tax. **This plan removes motion in the high-frequency layer and spends it
in the low-frequency layer.** Net motion count should go *down* while perceived
quality goes up.

---

## 2. Current state audit

| Area | Today | Verdict |
|---|---|---|
| `Modal.tsx` | Unified primitive; backdrop fade 150ms + panel `translateY(12px) scale(0.97)` 180ms. Same animation for every modal regardless of origin. | Hard cut with a garnish. No spatial link to the trigger. |
| Sidebar | `fixed lg:static`, `-translate-x-full` toggle; desktop sidebar is always visible, no Zen/focus mode exists yet. | No zen mode to fix — this is *new* work, must be built grid-based from day one. |
| Nav active state | Class toggle: active item gets `bg-[#67E8F9] … translate-x-1`. Indicator teleports. | Needs a shared sliding indicator. |
| Tab switching | `runViewTransition` cross-fade, but tabs are bound to keys 1–5. | **Violation**: keyboard-initiated navigation is animated. Must be instant on keypress. |
| Buttons | Global `button { transition: transform 120ms spring }` + hover lift on `.btn-kinetic`. | Hover effects used tens of times/day should be instant. Scope the transition to `.btn-kinetic` and drop the hover *transition* (keep the state change). |
| Flashcard swipe | Good: pointer capture, live `dragOffset`, boundary damping, axis lock. Threshold-only (65px), no velocity. Both "next card" and "mark mastered" commit on release. | Closest to the curriculum already. Add velocity; let *navigation* (lightweight) fire mid-swipe, keep *rating* (records an Attempt) on release. |
| Reduced motion | Comprehensive block in `index.css`. | Strong. Every new animation must be added to it. |

---

## 3. Workstreams

### WS-1 — Motion budget (do this first)

Everything else is easier once the baseline is quiet. Ship a single motion
vocabulary as CSS custom properties in `index.css`:

```css
:root {
  --ease-out:    cubic-bezier(0, 0, 0.2, 1);
  --ease-spring: cubic-bezier(0.34, 1.3, 0.64, 1);
  --dur-instant: 0ms;    /* 100+/day, all keyboard paths */
  --dur-micro:   120ms;  /* press feedback */
  --dur-panel:   240ms;  /* modals, drawers */
  --dur-layout:  300ms;  /* grid / zen transitions */
}
```

Tasks:
1. **Never animate keyboard actions.** `handleTabChange` takes an
   `origin: 'pointer' | 'keyboard'`. Keys 1–5 pass `'keyboard'` and call the
   setter directly; clicks pass `'pointer'` and go through `runViewTransition`.
   Extend `runViewTransition(update, { skip })` rather than branching at each
   call site.
2. **Un-globalise the button transition.** Move the `button, [role=button]`
   transition block onto `.btn-kinetic` / `.btn-neo` only. Hover highlights in
   the sidebar become instant (Emil: "always one step behind" otherwise); keep
   the *press* depress, which is direct manipulation.
3. **Retire the always-on flourishes.** Ghost-hand swipe hint and the pulse ring
   stay, but gate them to first-run only (they already use localStorage for the
   hint — extend the same policy to the ring) — that is the 10% novelty budget.
4. Document the tiers in `DEVELOPING.md` so the rule survives the next feature.

Impact: 🟢 High · Effort: 🟢 Low

### WS-2 — Origin-aware modal morphing

Give `Modal` an optional `originRef?: React.RefObject<HTMLElement>`. On open,
read `getBoundingClientRect()` of the trigger, and expand the panel from that
rect to its final rect using a FLIP transform (preferred over the `clip-path`
sketch: transforms are compositor-only, `clip-path: inset(-100vh -100vw)` is
not, and FLIP keeps the border radius honest via `border-radius` interpolation).

```ts
// Modal.tsx — sketch
const from = originRef?.current?.getBoundingClientRect();
const to   = panelRef.current!.getBoundingClientRect();
if (from && !reducedMotion) {
  const dx = (from.left + from.width / 2) - (to.left + to.width / 2);
  const dy = (from.top + from.height / 2) - (to.top + to.height / 2);
  panel.animate(
    [{ transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})`, opacity: 0.6 },
     { transform: 'translate(0,0) scale(1)', opacity: 1 }],
    { duration: 240, easing: 'var(--ease-spring)', fill: 'both' }
  );
}
```

Reverse the same animation on close, so the modal returns to its card. No
origin ref supplied → today's centred fade (correct for keyboard/command-style
opens, which shouldn't animate at all).

Wire origins for the flows where the source is on screen:
- `QuizzesManager` "Generate New Quiz Deck" → the button / the source-material card.
- `ExamsManager` generate → same pattern.
- `NotesManager` generate → same pattern.
- `ApiKeySettingsModal` / Pomodoro opened from the sidebar → sidebar button rect.
- `ExplainTermModal` → the highlighted-term rect (already has coordinates from the pulse ring).

Impact: 🟡 Medium · Effort: 🟡 Medium

### WS-3 — Zen Mode via grid columns

New feature, built spatially correct from the start.

```css
.app-layout {
  display: grid;
  grid-template-columns: var(--sidebar-w, 288px) 1fr;
  transition: grid-template-columns var(--dur-layout) var(--ease-out);
}
.app-layout[data-zen='true'] { --sidebar-w: 0px; }
```

Rules:
- The sidebar is **never conditionally rendered** on desktop. It slides/clips out
  of a shrinking column so the brain keeps its location.
- Zen state persists in `UserSettings` (via `studyStore`, per ADR-0001 — no
  per-screen copies).
- Toggle: header button **and** a `Z` shortcut. Keyboard path skips the
  transition (WS-1 rule); pointer path animates.
- Mobile keeps the existing overlay drawer; zen is a `lg:` concern only.
- Add `grid-template-columns` to the reduced-motion override.

Impact: 🟡 Medium · Effort: 🟡 Medium

### WS-4 — Sliding nav indicator

Replace the per-item `bg-[#67E8F9] … translate-x-1` class toggle with one
absolutely positioned indicator inside the `<nav>`:

- `nav` becomes `position: relative`; items keep their own hover/active *colours*
  (instant), but the cyan highlight bar becomes a single element positioned with
  `transform: translateY(var(--indicator-y))` and `height: var(--indicator-h)`,
  measured from the active item's `offsetTop/offsetHeight` in a `useLayoutEffect`.
- Transition `transform 200ms var(--ease-out)` — but only when the change came
  from a pointer. Keyboard 1–5 sets the position with transitions suppressed
  (`data-animate="false"` for one frame).
- No Framer Motion. `layoutId` is not worth a dependency here; one ref array and
  a CSS variable does it, and it keeps ADR-0004's "platform first" stance.

Impact: 🟢 High (this is the most-seen element in the app) · Effort: 🟢 Low

### WS-5 — Gestures: velocity + correct commit timing

In `FlashcardView`:
1. Record `dragStartTime`; on release compute `velocity = |offset| / elapsed`.
   Commit if `|offset| > 65 || velocity > 0.4 px/ms` (tune; Sonner's 0.11 is for
   a smaller element).
2. **Lightweight vs destructive split.** Card navigation (prev/next) is cheap and
   reversible → may fire the moment the card clears the threshold *during* the
   drag, with the incoming card already tracking the finger. Rating a card
   (`markMastered` / `markNeedReview`) writes an Attempt → stays commit-on-release
   so a half-swipe can be reversed by dragging back.
3. **Interruptible settles.** The snap-back animation must be cancellable by a new
   `pointerdown`; today a fresh gesture during the CSS transition fights it. Track
   settle as a `WAAPI` animation and `.cancel()` it on `pointerdown`.
4. Mirror the same rules in the mobile sidebar drawer swipe in `App.tsx`
   (currently `-55px` distance only): add velocity, keep dismissal on release.

Impact: 🟡 Medium · Effort: 🟡 Medium

### WS-6 — Generation states as designed primitives (beautifului.dev)

Temari's AI generation is its most novel moment and currently shows a spinner.
Build three small `src/components/ui/` primitives:
- `<GenerationProgress />` — elapsed time + staged labels ("Reading material →
  Drafting cards → Checking coverage"), the shimmer/elapsed pattern from
  beautifului.dev's loading state.
- `<OfflineBadge />` — one component that renders the `source: 'offline'`
  attribution required by CONTEXT.md, instead of ad-hoc markup per screen.
- `<EmptyState />` — unify the "no notes / no quizzes / no exams" panels.

This is where the 10% novelty budget is well spent: generation happens
occasionally, not hundreds of times a day.

Impact: 🟢 High · Effort: 🟡 Medium

### WS-7 — Typography and diagram grammar

- **Ethiopic (font.et):** pick one licensed Ethiopic display face (e.g. Menbere,
  a variable font, or Loga for UI) and self-host it in `public/fonts/` with
  `font-display: swap` and a `unicode-range` subset for U+1200–137F, so Latin
  text never waits on it. Removes the current dependence on `local('Nyala')`
  which silently differs per OS.
- **Diagrams (diagram-design):** audit `EditorialDiagram.tsx` against the
  repo's grammar — no drop shadows inside diagram SVG, hairline strokes, type
  from the editorial scale. Note that Temari's neo-brutalist shadows are a *UI
  chrome* device and must stop at the diagram frame.

Impact: 🟡 Medium · Effort: 🟢 Low

---

## 4. Sequencing

| Phase | Contents | Why here |
|---|---|---|
| 1 | WS-1 (motion budget), WS-4 (nav indicator) | Cheap, highest daily-visibility, sets the vocabulary every later phase uses. |
| 2 | WS-3 (zen grid), WS-2 (modal morph) | Both depend on the motion tokens; zen touches layout so land it before modal origins are measured against it. |
| 3 | WS-5 (gestures), WS-6 (generation primitives) | Deeper component work, independently shippable. |
| 4 | WS-7 (type + diagrams) | Polish; no dependencies. |

## 5. Guardrails

1. Every new animation gets an entry in the `prefers-reduced-motion` block in
   the same commit. Non-negotiable.
2. No animation library. ADR-0004 chose the platform; FLIP + WAAPI + CSS
   variables cover all of the above. If a workstream genuinely can't be done
   without one, write an ADR first.
3. Keyboard-initiated = instant. If a new interaction has a shortcut, the
   shortcut path must skip the transition.
4. No per-screen state copies for zen mode or nav (ADR-0001).
5. Motion tokens live only in `index.css`; components reference variables, never
   literal durations.

## 6. Definition of done

- [ ] Pressing `1`–`5` swaps tabs with zero animation; clicking cross-fades.
- [ ] The nav indicator slides between items on click and jumps on keypress.
- [ ] Zen mode collapses the sidebar via `grid-template-columns`; the sidebar
      element is still mounted at 0 width and returns to the same place.
- [ ] Generate modals grow from the control that opened them and shrink back on
      close.
- [ ] A fast, short flashcard swipe advances the deck; a half-swipe rating that
      is dragged back does not record an Attempt.
- [ ] `prefers-reduced-motion: reduce` disables all of the above.
- [ ] `bun run typecheck` and `bun run test` pass.

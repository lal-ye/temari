# ADR-0005: Motion budget and spatial consistency

- Status: Accepted
- Date: 2026-09-05
- Extends: [ADR-0004](./0004-native-css-view-transitions.md)

## Context

ADR-0004 chose the platform's View Transitions API for tab navigation and left
modals and flashcards on plain CSS keyframes. What it did not decide was *when*
to animate, or what a transition should mean. The result drifted:

- Every `button` in the app carried a spring transition, including hover colour
  changes used tens of times a day.
- Tab switching animated even when triggered by the `1`–`5` shortcuts.
- Modals hard-cut into the centre of the screen regardless of what opened them.
- The nav active state teleported between items on a class toggle.
- Flashcard gestures looked only at distance, and every gesture — cheap or
  expensive — waited for release.

The learn-ui "Invisible details" chapters (spatial consistency, responsive
gestures, kinetic physics, frequency and novelty) give a consistent set of rules
for all five, so we adopt them wholesale rather than case by case.

## Decision

### 1. Animation is budgeted by interaction frequency

Durations and easings live as CSS custom properties in `src/index.css` and are
the only place a duration is written down. The tier decides whether an
interaction may animate at all:

| Frequency | Animation |
|---|---|
| 100+/day, and **every keyboard-initiated action** | None, ever |
| Tens/day (hover, list navigation) | Instant; press feedback only |
| Occasional (modals, drawers, tab clicks) | Standard |
| Rare / first-run | May exceed the budget — this is the novelty spend |

Consequences: transitions attach to opt-in classes (`.btn-kinetic`, `.btn-neo`),
never bare element selectors; hover highlights change instantly, because a
fading highlight trails the cursor; and `runViewTransition` takes an
`origin: 'pointer' | 'keyboard'`, applying the update synchronously for
keyboard.

### 2. Motion says where a thing came from

- **Modals morph from their trigger.** `Modal` accepts an `originRef` and grows
  out of that box, reversing on close. No origin → the previous centred fade,
  which is correct when there is nothing on screen to morph from.
- **Zen Mode collapses a grid column, it does not unmount the sidebar.** The
  sidebar slides out to the left under a clip and returns to the same place.
- **The nav indicator is one element that travels**, not a class that teleports.

### 3. Gestures track the input, and commit by cost

The continuous part of a gesture is wired to the continuous part of the input
before any threshold logic. Commit timing depends on the cost of being wrong:
lightweight, reversible actions (card navigation) fire during the swipe once
the element reaches its logical position; anything that records state (rating a
card, dismissing the drawer) waits for release so the gesture stays reversible.
Velocity is a trigger alongside distance.

In-flight settles are interruptible: `pointerdown` reads the live transform and
adopts it, so a gesture can take over its own animation mid-flight.

## Alternatives considered

**Framer Motion for shared-layout animation (`layoutId`).** Rejected. ADR-0004's
reasoning still holds, and the two things we needed it for are cheap without it:
the nav indicator is one absolutely positioned element driven by CSS variables,
and giving it its own `view-transition-name` gets the platform to morph it
between positions — a shared-layout animation with no library. A ~40kB
dependency for two effects is not a trade we need to make.

**`clip-path` expansion for the modal morph**, as originally sketched. Rejected
in favour of a FLIP transform: `clip-path: inset(-100vh -100vw)` is not
compositor-accelerated, does not interpolate the border radius honestly, and is
awkward to reverse exactly. FLIP gives a true reverse for the close, and the
radius is pre-divided by the scale so it lands at 16px instead of distorting.

**Keying the morph off an element ref only.** Rejected: the term explainer is
triggered by a long-press on a word, which has coordinates but no element.
`MorphOrigin` is therefore a `getBoundingClientRect()` shape, and `pointOrigin`
adapts a point.

## Consequences

- Net animation count goes *down* while perceived quality goes up; the app feels
  faster on the paths used most.
- Every new animation must add a `prefers-reduced-motion: reduce` override in the
  same commit. The block at the bottom of `index.css` is the single place for it.
- Any new keyboard shortcut must thread its origin through, or it will animate a
  path that should be instant.
- The morph reads layout at open time (`getBoundingClientRect`), which is a
  forced reflow. It happens once per modal open and is not on a hot path.

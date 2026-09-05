# UI audit against the taste-skill

Audit of Temari's interface against [`Leonxlnx/taste-skill`](https://github.com/Leonxlnx/taste-skill),
run after the spatial-consistency work in `docs/ui-plan-spatial-consistency.md`.

## Which skill governs

The repo ships several skills. Two were candidates:

- **`taste-skill`** — the original. Its own frontmatter scopes it to "landing
  pages, portfolios, and redesigns. Not dashboards, not data tables, not
  multi-step product UI." That is a precise description of what Temari *is*,
  so most of it (hero dials, landing-page section rhythm, above-the-fold
  choreography) does not apply. Its transferable parts are §9 "AI tells" and
  the content rules.
- **`redesign-skill`** — purpose-built for improving *existing* projects.
  Framework-agnostic, audit-first, explicitly "do not rewrite from scratch,
  improve what's there," and ends with a prioritised fix order. **This is the
  governing document for this pass.**

Applying the landing-page skill wholesale to a study app would have produced
exactly the generic result both skills exist to prevent.

## Findings, by severity

### 1. Fabricated data (fixed)

The sidebar streak widget was hardcoded:

```
5-Day Streak · 85% · "3 more sessions to reach weekly mastery goal"
```

Every learner saw identical numbers, including one who had never opened a
quiz. The skill calls this the "Jane Doe" tell — placeholder content shipped as
if it were real. It is the worst find in the audit, because a study app's
streak counter is a motivational promise; when it is decoration, the app is
lying about the one thing it sells.

Fixed by `computeStudyStreak()` in `src/utils/analytics.ts`, computed from
real Attempts across all subjects. Design decisions worth keeping:

- Days key off the **local** calendar date, so a streak follows the learner's
  midnight, not UTC.
- **Yesterday keeps the streak alive.** A learner who has not studied yet
  today is not told their streak is broken while the day is still running.
- A day counts once regardless of how many attempts it holds. The unit is the
  day, not the drill.
- Four honest message states, including "Every day this week. Take a rest day
  if you need one." at 7/7 — the app should not manufacture pressure it does
  not need.

Covered by 7 unit tests in `src/utils/analytics.test.ts`.

### 2. Status dots that report nothing (fixed)

A green dot labelled "Offline Ready" was rendered unconditionally. The skill
bans decorative status dots and permits them only for real semantic state. It
now reflects `navigator.onLine` and turns amber when generation would fall
back to the offline adapter (`src/hooks/useOnlineStatus.ts`).

### 3. No focus-visible styling anywhere (fixed)

`src/index.css` had zero `:focus-visible` rules. Keyboard users had only the
browser default outline, which the neo-brutalist 3px borders visually swallow.
Added an ink ring, inverted to the yellow accent on dark surfaces, scoped to
`:focus-visible` so pointer users never see it.

### 4. Em-dashes in user-visible copy (fixed)

The skill treats this as its single most-violated tell. 44 occurrences in
`src/`, but the audit distinguished **code comments** (not user-visible, left
alone) from **rendered strings**. Five strings were rewritten, four of them
variants of the same offline-banner sentence.

### 5. Stacked separator dots (fixed)

The skill caps middle dots at one per line. Worst case was the flashcard
hint bar, which used arrow glyphs as vocabulary:

```
Swipe ◄ ► to navigate • Swipe ▲ ▼ on back to rate
```

Now reads "Swipe sideways to move between cards" and "Swipe up for hard, down
for easy" — the gesture described in words.

### 6. Generic loading states (fixed)

Spinner-and-grey-box fallbacks replaced with skeletons shaped like the content
they stand in for (`src/components/ui/Skeleton.tsx`), so nothing reflows when
real content arrives. Shimmer respects `prefers-reduced-motion`.

### 7. Sidebar as the only navigation (addressed)

The skill flags "dashboard always has a left sidebar" and suggests a floating
command menu. The sidebar was **kept** — it is the discoverable path for a new
learner — and a Cmd/Ctrl+K palette added as the fast path for a returning one
(`src/components/ui/CommandPalette.tsx`).

It is deliberately unanimated. Per the motion budget in `DEVELOPING.md`, a
surface opened many times per session sits in the no-animation tier; a fade
would be a tax paid on every open, and the palette's value is that it feels
instant.

The palette is surfaced by a header control that displays its own binding,
labelled per platform. A shortcut nobody can see is not a feature.

### 8. Numeric reflow (fixed)

Live-updating figures had proportional digits, so the Pomodoro and exam
countdowns nudged their neighbours every tick. `tabular-nums` applied there
and to planner durations, plus a base rule covering `time` and `[role=timer]`.

## Checks that came back clean

- No `window.alert()` anywhere.
- No `href="#"` dead links.
- No cliché marketing verbs (`elevate`, `seamless`, `unleash`, `delve`, …).
- No exclamation marks in UI copy, no "Oops!" error states.
- Card grids already bottom-align their CTAs via `flex flex-col
  justify-between`, which the skill checks for explicitly.
- Error states exist and are inline rather than modal.

## Judgement calls, not fixed

- **`lg:grid-cols-3` in the Exams and Quizzes managers.** The skill flags
  three-equal-column rows. That rule targets landing-page feature triplets,
  where three columns is a compositional default standing in for a decision.
  These are content grids of arbitrary length that also collapse to 2 and 1.
  Changing them would be following the rule past its purpose.

## Remaining backlog

- Sentence-case the Title Case `title=` attributes ("Add New Subject" →
  "Add a subject").
- Empty states for Analytics and Planner — `EmptyState` exists but is unused
  on both.
- Gate the `.pulse-ring-indicator` first-run hint (`NoteViewer.tsx:358`) so it
  stops after the learner has seen it.
- Offline attribution in `ExamResultsView`.
- No onboarding; the novelty budget from the motion plan is still unspent.

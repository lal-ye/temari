# ADR-0010: Modern Academic Editorial design system

- Status: Accepted
- Date: 2026-09-07
- Plan: [docs/ui-plan-editorial-shell-export.md](../ui-plan-editorial-shell-export.md)
- Supersedes: the neo-brutalist prototype language (PR #15/#16 retired it)

## Context

Temari shipped its first chrome in a neo-brutalist style: hard offset shadows
(`shadow-neo-*`), 2px ink borders, bright yellow fills, `font-black`. As the
product became a dense study workspace — five hubs of notes, quizzes, exams,
analytics, planner — that language competed with the content. PR #15
("Modern Academic Editorial design system") introduced a quieter, editorial
grammar and PR #16 ("port the editorial design language to all five tabs")
drove the retired neo-brutalist tokens to **0 across `src/`** outside the
diagram SVG internals. The vocabulary was only ever described in those PR
bodies, so it could drift; the landing page (PR #18) and the README never
moved off the old language.

This ADR fixes the editorial system as the single visual language so future
work has an authoritative reference and a regression anchor.

## Decision

### 1. Surfaces, not hard shadows

Depth comes from a **hairline border + surface tint + whisper shadow**, never
an offset "neo" shadow. Nesting auto-bumps one level down a ramp (the model
Cladd uses, rebuilt in our identity):

| Level | Role | Token / class |
|---|---|---|
| L0 | page — warm paper | `--surface-page` (`#FAF8F5`) |
| L1 | recessed well — tab track, inputs, code fields | `.surface-well` / `bg-muted` |
| L2 | raised content panel — note card, manager panels, cards | `.surface-panel` (`bg-card border-border/80 rounded-2xl shadow-xs`) |
| L3 | floating — dropdown, popover, tooltip, command palette | `.surface-float` (`bg-popover border rounded-xl shadow-md`) |

The `shadow-neo-*` and `btn-neo`/`btn-kinetic` **hard-shadow utilities are
removed**; they were dead after the port (landing was the last consumer).

### 2. Typography

- **Headings** — Playfair Display (`font-editorial`), bold, tight tracking.
  Page title: `font-editorial text-2xl font-bold tracking-tight`.
- **Body** — Inter / system (`font-body` / `.note-body`).
- **Figures & code** — JetBrains Mono; **numbers are figures**:
  `font-mono tabular-nums` for timers, scores, counters, page numbers.
- **Ethiopic is first-class** (`font-ethiopic`, self-hosted Abyssinica SIL)
  for the ተማሪ wordmark and Amharic Subject titles — not a fallback.

### 3. One accent, one tint recipe

Academic Amber is the single accent (`amber-600` text / `amber-500/10`
surface tints). Sibling semantics reuse the same ~10%-tint recipe: emerald
(good/correct), rose (destructive/important), sky (informational) — every one
with a `dark:` counterpart. Eyebrow pattern: `ተማሪ` (amber) · CATEGORY ·
Subject.

### 4. Diagrams keep their own figure grammar

Note figures are **native, self-contained editorial SVG**
(`src/components/diagrams/`): hairline strokes, no shadows, no Mermaid
runtime. Only the chrome *around* them follows this ADR; the SVG internals
follow the figure grammar (WS-7 of the spatial plan).

### 5. Controls are primitives, not hand-rolled

Use the shadcn-style primitives in `src/components/ui/*` (`Button`, `Badge`,
`Card`, `Modal`, `Kbd`, toast, confirm). Never re-introduce a bespoke
neo button or chip. Feedback uses the toast region; destructive confirms use
the imperative `confirm()` dialog; shortcut hints use `Kbd`.

### 6. Print is the editorial system on paper

Notes export through the browser print pipeline (which renders KaTeX, the
SVG figures and web fonts natively) with the print stylesheet in
`index.css`: page geometry, a masthead, page numbers, forced light mode, and
break control. See the export plan for the optional Paged.js academic-typesetting
spike.

## Enforcement

- A structural design-system test renders the key screens and asserts no
  retired token (`shadow-neo`, `font-black`, `border-2 border-slate-900`,
  `bg-yellow-300`) survives and the editorial tokens are present.
- New surfaces should reach for `.surface-panel/.surface-well/.surface-float`
  (or the documented token combinations) rather than ad-hoc shadows.
- Motion still follows [ADR-0005](./0005-motion-budget-and-spatial-consistency.md):
  frequency decides animation; the surface ramp is static state, not motion.

## Consequences

- The landing page is re-skinned to this system (its neo-brutalist chrome was
  the last holdout) and the README describes the editorial language.
- Deleting the dead `shadow-neo-*`/`btn-neo` CSS removes the temptation to
  re-grow the old language.
- Borrowing Cladd's surface-ramp/sizing/imperative-hook *patterns* does not
  mean taking the package: its blue/dark identity is not ours and we already
  own a component layer.

# ADR-0011: Landing page as a documented display variant

- Status: Accepted
- Date: 2026-09-10
- Supersedes (for the landing surface): the implicit assumption in ADR-0010 that
  every surface, including `/`, uses Modern Academic Editorial verbatim
- Background (historical): [docs/archive/ui-audit-ascii-hero-and-design-tooling.md](../archive/ui-audit-ascii-hero-and-design-tooling.md) (§5 Q1, option b)

## Context

ADR-0010 fixed Modern Academic Editorial (warm paper `#FAF8F5`, ink `#0F172A`,
Academic Amber, Playfair/Inter/JetBrains, hairline borders) as the single visual
language. Commit `8b37173` then shipped the landing page as a second, louder
language ("Variation 10": `#F8F7F4` / `#111113` / `#E33E33`, Syne + Space Mono)
without touching any ADR, so the code contradicted the accepted design system
and nothing stopped further drift. The audit's options were: (a) revert the
landing to editorial; (b) document it as a marketing-only variant sharing a token
spine; (c) move the whole product to Variation 10.

We choose **(b)**. The landing is the one novelty-tier surface (ADR-0005) and a
louder display language is defensible there; the five-hub study shell is exactly
the dense workspace ADR-0010's quieter language exists for. Reverting (a) would
discard energy the owner wants; (c) would re-introduce the competition-with-content
problem ADR-0010 solved.

## Decision

### 1. The landing is a display variant, not a second design system

`/` may be louder than `/app`, but it is built from a **token spine**, not from
scattered hexes. All landing colours live in `src/index.css` under `--landing-*`
and are referenced only as `var(--landing-*)` in `src/components/landing/*`.

### 2. Tokens that may differ on the landing

`--landing-page`, `--landing-ink`, `--landing-accent`, `--landing-accent-deep`,
`--landing-accent-warm`, `--landing-charcoal`, plus the precomputed tints
(`--landing-panel`, `-rule`, `-muted`, `-dim`, `-onink`), and a display type pair
(Space Mono body / Syne display for Latin). The ASCII field's palette
(`COGNITIVE_PALETTE` in `asciiFieldMath.ts`) must stay in sync with the accent
tokens.

### 3. Tokens and rules that must remain shared

- **Ethiopic is first-class everywhere**: the wordmark uses `font-ethiopic`
  (self-hosted Abyssinica SIL), never a platform fallback (ADR-0010 §2).
- **One-accent discipline within each language**: the landing has exactly one
  accent (`--landing-accent`); semantic siblings reuse the same tint recipe.
- **Controls are primitives**: real `<button>`/`<a>` for anything clickable; no
  `div`-buttons, no inline colour/type styles (which beat hover classes).
- **The motion budget** (ADR-0005) applies unchanged: the ASCII field remains the
  page's only continuous animation and stops when hidden, off-screen or under
  reduced motion.
- **Facts come from code**: provider summary from `shared/aiCatalog`, Bloom
  identities from `BLOOM_LEVELS` (ADR-0003 / glossary).

### 4. The `/` → `/app` seam is known and acceptable

The CTA lands on the editorial shell; `Root.tsx`'s `AppLoading` mirrors the app
header, so the transition reads as "entering the app" rather than a bug. Because
the landing accent is a single variable, choosing a different accent later is a
one-line diff, and options (a)/(c) remain reachable without a rewrite.

### 5. Enforcement

`src/components/ui/landingDesignSystem.test.ts` fails the build if a landing
component contains a raw six-digit hex, an inline style object, a non-interactive
click target, a hand-typed provider/Bloom list, or a non-`font-ethiopic` wordmark.

## Consequences

- `README.md`, `DEVELOPING.md`, `index.html` and `metadata.json` no longer say
  "neo-brutalist"; the retired palette is gone from `index.html`'s `<body>`.
- Future landing boldness is a token-level change; the guard keeps it honest.
- If the group later picks (a) or (c), that is an ADR amendment plus a token
  diff — not another ungoverned rewrite.

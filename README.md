# Temari (ተማሪ)

An intelligent AI study companion in a **modern academic-editorial** style:
interactive Notes with hand-built editorial figures and diagrams (no charting
runtime), Flashcard active-recall Quizzes, timed Exams, analytics, and a
Study Planner — with graceful offline fallbacks when no AI Provider is
reachable.

## Start here

- [CONTEXT.md](./CONTEXT.md) — the project glossary. Use these terms exactly.
- [DEVELOPING.md](./DEVELOPING.md) — module map, ground rules, how to add a feature.
- [docs/adr/](./docs/adr/) — architectural decisions and why they were made:
  - [ADR-0001](./docs/adr/0001-study-store-deep-module.md) — one deep Study-Store module
  - [ADR-0002](./docs/adr/0002-ai-generation-port.md) — AI generation behind one port (HTTP + offline adapters)
  - [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md) — shared AI provider catalog
  - [ADR-0004](./docs/adr/0004-native-css-view-transitions.md) — native CSS View Transitions instead of react@canary
  - [ADR-0005](./docs/adr/0005-motion-budget-and-spatial-consistency.md) — the motion budget: frequency, not taste
  - [ADR-0006](./docs/adr/0006-sidebar-removal.md) — header-only chrome; no sidebar
  - [ADR-0007](./docs/adr/0007-source-material-resolver.md) — pure source-material resolver shared by Quiz and Exam generation
  - [ADR-0008](./docs/adr/0008-cognitive-level-aware-exam-generation.md) — Bloom cognitive-level-aware exam blueprints
  - [ADR-0009](./docs/adr/0009-landing-page-route-split.md) — landing page at `/`, study shell at `/app`, no router
  - [ADR-0010](./docs/adr/0010-editorial-design-system.md) — Modern Academic Editorial design system (surface ramp, type, accent; neo-brutalism retired)
  - [ADR-0011](./docs/adr/0011-landing-display-variant.md) — landing page as a documented display variant (token spine, guarded)
- Design plans:
  - [docs/ui-plan-truthful-interaction.md](./docs/ui-plan-truthful-interaction.md) — truthful feedback, pointer ownership, modal focus, and reading continuity (phases 1–3 implemented on the working branch; device verification owed).
  - [docs/ui-plan-editorial-shell-export.md](./docs/ui-plan-editorial-shell-export.md) — the editorial design-system canon, landing-page realignment, and note export/PDF.
  - [docs/ui-plan-spatial-consistency.md](./docs/ui-plan-spatial-consistency.md) — the motion/spatial system (shipped).
  - [docs/ui-plan-landing-page.md](./docs/ui-plan-landing-page.md) — the landing-page plan and its guardrails.

## Design language

Temari uses a **Modern Academic Editorial** system (introduced in PR #15 and
ported to all five hubs in PR #16; the neo-brutalist prototype is retired):

- **Surfaces, not hard shadows.** Warm-paper page, hairline 1px borders, and a
  whisper-soft `shadow-xs` on raised panels. Depth comes from border + a
  subtle surface tint, never an offset "neo" shadow.
- **Editorial typography.** Playfair Display headings, Inter body, JetBrains
  Mono for figures; Ethiopic (Abyssinica SIL) is a first-class axis for the
  ተማሪ wordmark and Amharic Subject titles.
- **One accent.** Academic Amber, used at a consistent ~10%-tint recipe with
  emerald / rose / sky sibling tints, all with dark-mode counterparts.
- **Numbers are figures.** `font-mono tabular-nums` for timers, scores and stats.
- **Diagrams are editorial SVG** — hairline strokes, no shadows, no Mermaid
  runtime (`src/components/diagrams/`).

The full vocabulary, its rules, and the remaining realignment work are in the
design plan above.

## Stack

React 19 + Vite + Tailwind 4 client · Express server (`server.ts`) ·
multi-provider AI (Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter,
Ollama) · localStorage persistence · Vitest.

## Routes

- `/` — the landing page (`src/components/landing/`). Static copy over a
  cursor-reactive ASCII field; imports no study code and touches no storage.
  (A documented display variant of the editorial system — ADR-0011, guarded by `landingDesignSystem.test.ts`.)
- `/app` — the study shell (`src/App.tsx`), loaded lazily on the CTA click.

## Commands

```bash
npm run dev      # dev server (Express + Vite, port 3000)
npm run lint     # typecheck (tsc --noEmit)
npm test         # unit tests (vitest)
npm run build    # production build → dist/
```

## Deployment

- **Self-hosted / Node**: `npm run build && npm run start` — full server AI.
- **Netlify** (`netlify.toml`): client-only; AI generation falls back to the
  offline adapter and is always labelled as an offline draft.

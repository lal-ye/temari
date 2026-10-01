# Temari (ተማሪ)

Temari is an AI study companion. A learner organises study content under
Subjects, generates Notes, Quizzes and Exams from raw Material, practises them,
and reviews graded Attempts in Analytics and the Planner.

- **Notes** — markdown study documents with hand-built editorial figures and
  diagrams (no charting runtime).
- **Quizzes** — flashcard decks for active recall.
- **Exams** — generated multiple-choice, true/false and short-answer papers,
  graded with partial credit.
- **Analytics & Planner** — topic accuracy, per-Bloom-level mastery, a spaced
  review queue, and study tasks.

Study data moves through a credential-free portable contract
(`packages/core`); there are no accounts. AI generation runs through seven
Providers — Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter and
Ollama/Custom — and falls back to clearly labelled offline drafts when none
is reachable. On-device persistence and learner-supplied keys arrive with the
native milestones (see `docs/ANDROID-PROTOTYPE-PLAN.md`).

## Setup

Requires Node.js 22.22.3 and Bun 1.3.9 (see `.nvmrc` and `.bun-version`).

```bash
bun install --frozen-lockfile
```

The product is one Expo app (`apps/mobile`) over two packages
(`packages/core`, `packages/reader-core`). Run it with `expo start` from
`apps/mobile`; installable previews come from the `android-preview` workflow
(see `docs/mobile/EAS-BUILD.md`). The standalone web app retired under
[ADR-0014](./docs/adr/0014-expo-web-and-android.md).

### Commands

```bash
bun run test              # unit tests (Vitest, packages only)
bun run typecheck:all     # typechecks plus the core/reader boundary seals
bun run check:mobile      # mobile typecheck + Android export + reader-export asset check
```

## Documentation

Everything else — the glossary, architecture decisions, working rules,
in-flight plans and archived history — lives in
[docs/README.md](./docs/README.md).

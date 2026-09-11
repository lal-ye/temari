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

Study data lives in the browser (localStorage); there are no accounts. AI
generation runs through seven Providers — Gemini, OpenAI, Anthropic, Groq,
DeepSeek, OpenRouter and Ollama/Custom — and falls back to clearly labelled
offline drafts when none is reachable.

## Setup

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. `/` is the landing page; `/app` is the study shell.

### AI keys (optional)

Give the server a Provider key in `.env` — `GEMINI_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY` or
`OPENROUTER_API_KEY` (the full list is in `shared/aiCatalog.ts`) — or let a
learner paste their own key in Settings (BYOK). With neither, generation falls
back to the offline adapter and is labelled as an offline draft.

### Commands

```bash
npm run dev      # Express + Vite dev server (port 3000)
npm test         # unit tests (Vitest)
npm run lint     # typecheck (tsc --noEmit)
npm run build    # production build → dist/
npm run start    # serve the build (Node)
```

## Deployment

- **Self-hosted Node** — `npm run build && npm run start`.
- **Netlify** (`netlify.toml`) — client-only: the AI module falls back to the
  offline adapter, and server-only operations (connection test, PDF extraction)
  fail explicitly by design.

## Documentation

Everything else — the glossary, architecture decisions, working rules,
in-flight plans and archived history — lives in
[docs/README.md](./docs/README.md).

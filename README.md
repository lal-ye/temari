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

Requires Node.js 22.22.3 and Bun 1.3.9 (see `.nvmrc` and `package.json`).

```bash
bun install --frozen-lockfile
bun run dev
```

Open <http://localhost:3000>. `/` is the landing page; `/app` is the study shell.

### AI keys (optional)

For local/private self-hosting, give the server a Provider key in `.env` — `GEMINI_API_KEY`, `OPENAI_API_KEY`,
`ANTHROPIC_API_KEY`, `GROQ_API_KEY`, `DEEPSEEK_API_KEY` or
`OPENROUTER_API_KEY` (the full list is in `shared/aiCatalog.ts`) — or let a
learner paste their own key in Settings (BYOK). With neither, generation falls
back to the offline adapter and is labelled as an offline draft.

### Commands

```bash
bun run dev      # Express + Vite dev server (port 3000)
bun run test     # unit tests (Vitest)
bun run lint     # typecheck (tsc --noEmit)
bun run build    # frontend → dist/; private server bundle → build/
bun run start    # serve the build (Node; NODE_ENV=production for static serving)
bun run build:render # typecheck + tests + build + deployment smoke test
```

## Deployment

- **Render (recommended)** — one Node web service serves frontend + API, BYOK-only.
  `render.yaml` targets `arena/01a09569-temari` for testing **before merging**.
  Follow the [Render deployment guide](./docs/RENDER.md). No database required.
- **Self-hosted Node** — `bun run build && NODE_ENV=production bun run start`.
  Set `TEMARI_HOSTED=true` for public BYOK-only hosting.
- **Netlify (optional alternative)** (`netlify.toml`) — frontend + Express API on Netlify Functions,
  using learner-supplied keys (BYOK). No server provider secrets required.
  Custom/Ollama endpoints require self-hosting. See the
  [step-by-step deployment guide](./docs/NETLIFY.md) for CI/CD, setup and limits.

## Documentation

Everything else — the glossary, architecture decisions, working rules,
in-flight plans and archived history — lives in
[docs/README.md](./docs/README.md).

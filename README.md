# Temari (ተማሪ)

An intelligent neo-brutalist AI study companion: interactive notes with Mermaid
mindmaps, flashcard active-recall quizzes, timed mock exams, analytics, and a
study planner — with graceful offline fallbacks when no AI Provider is
reachable.

## Start here

- [CONTEXT.md](./CONTEXT.md) — the project glossary. Use these terms exactly.
- [DEVELOPING.md](./DEVELOPING.md) — module map, ground rules, how to add a feature.
- [docs/adr/](./docs/adr/) — architectural decisions and why they were made:
  - [ADR-0001](./docs/adr/0001-study-store-deep-module.md) — one deep Study-Store module
  - [ADR-0002](./docs/adr/0002-ai-generation-port.md) — AI generation behind one port (HTTP + offline adapters)
  - [ADR-0003](./docs/adr/0003-shared-ai-provider-catalog.md) — shared AI provider catalog

## Stack

React 19 + Vite + Tailwind 4 client · Express server (`server.ts`) ·
multi-provider AI (Gemini, OpenAI, Anthropic, Groq, DeepSeek, OpenRouter,
Ollama) · localStorage persistence · Vitest.

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




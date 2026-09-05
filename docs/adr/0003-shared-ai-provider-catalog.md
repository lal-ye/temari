# ADR-0003: One shared AI provider catalog for client and server

- Status: Accepted
- Date: 2026-09-04

## Context

Provider identity facts (ids, display names, default models, base URLs,
server env key names) were duplicated in three places: the client catalog in
`src/types.ts`, a hardcoded list in `server.ts` `/api/ai/providers`, and
literals inside `server/aiProvider.ts`. They had already drifted — different
Anthropic defaults, and a `custom` default model of `llama3.2:3b` on the
client vs `llama3.2` on the server.

## Decision

`shared/aiCatalog.ts` is the single source of truth for provider identity and
transport facts, imported by both the Vite client and the esbuild-bundled
Express server. The server routes (`/api/health`, `/api/ai/providers`) and
the execution dispatcher in `server/aiProvider.ts` read from it. Presentation
metadata (badge colours, marketing copy, curated model lists, key links) is a
client concern and lives in `src/components/tools/modelPresentation.ts`,
composed on top of the catalog rather than restating it. The `custom`
provider's default model was reconciled to `llama3.2` (the server execution
value).

## Consequences

- Adding or changing a provider is a one-file edit; client/server drift
  becomes structurally difficult.
- Presentation changes never touch the server; catalog changes never touch
  JSX.
- Do not hardcode provider ids, default models, base URLs, or server env key
  names anywhere else — including new server routes and client features.

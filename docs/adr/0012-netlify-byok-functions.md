# ADR-0012: Full Netlify deployment with BYOK Functions

- Status: Accepted
- Date: 2026-09-12

## Context

The existing Netlify target shipped only the client, leaving AI and PDF
operations unavailable. The deployment owner requested full functionality
without funding a public shared provider key.

## Decision

Extract the existing routes into an Express application factory. Use the same
routes from standalone Node and a `serverless-http` Netlify function. The
function entry point hardcodes hosted mode, which requires a nonempty learner
key and rejects custom endpoints. Existing prompts and AI module contracts
remain unchanged. Provider facts remain in the shared catalog (ADR-0003).

Use GitHub Actions for checks and Netlify's Git integration for deployment.
Run checks again in Netlify's build command. Pin Node/Bun and freeze the lockfile.

## Consequences

No database or account system is introduced. Hosted requests have a smaller
body limit and are subject to platform timeouts. Custom/Ollama remains available
only for self-hosting. BYOK protects the owner's provider quota, not hosting
usage. Browser credential persistence is unchanged. See `docs/NETLIFY.md` for
limitations, release gates and operational checks.

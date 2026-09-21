# ADR-0013: Prefer one Render service and validate before merging

- Status: Accepted
- Date: 2026-09-12
- Supersedes ADR-0012's choice of primary deployment target, not its API extraction.

## Decision

Prefer one conventional Node service on Render for the simplest initial DX.
Serve Vite assets and the existing Express API from the same origin, with no
new database or authentication platform. Retain Netlify as an optional adapter.

Test `arena/01a09569-temari` with local checks and a branch-linked Render service
before merging. Auto-deploy starts on commits; Render builds run checks and
smoke-test the compiled server. Promotion to main is a separate explicit step.

Render always enables hosted BYOK restrictions. Other Node hosts can opt into
these with TEMARI_HOSTED=true. Keep the conservative hosted upload limit.
Compile backend code to build/, separate from public dist/ assets.

## Consequences

Free service cold starts affect the whole site. Runtime resource limits still
apply, but no serverless adapter is needed for the primary deployment. Browser
storage and credential persistence are unchanged. Netlify packaging is checked
on demand instead of being a required part of the primary Render build. See docs/RENDER.md.


GitHub Actions is deferred because the Arena GitHub connection lacks workflow
write permission. Preserve an inactive template outside .github/workflows for
manual activation later. Until then, use autoDeployTrigger: commit, not
checksPass. Render build failures prevent deployment, not PR merges.

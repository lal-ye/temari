# Deploy Temari to Netlify (optional alternative, full app, BYOK)

The primary workflow is now [one Render service](./RENDER.md). Netlify remains
available, but its packaging check is not part of the primary Render build.
Run `bunx --no-install netlify build --offline` before choosing this alternative.

## Architecture

Vite builds the frontend into `dist`. Netlify serves those static files and
rewrites `/api/*` to `netlify/functions/api.ts`, which wraps the shared Express
application in `server/app.ts`. `server.ts` remains the standalone development
and self-hosted entry point. API rewrites precede the SPA fallback; do not add a
second fallback in `public/_redirects`.

The function explicitly selects hosted mode: cloud-provider requests require a
learner-supplied key, even if a server provider key happens to exist. Custom
URLs and Custom/Ollama are rejected on the hosted API to avoid exposing an
arbitrary outbound-request proxy. Self-hosted mode keeps those capabilities.

## 1. Verify the branch

Use Node **22.22.3** and Bun **1.3.9** (also pinned in the optional CI template and `netlify.toml`).

```sh
bun install --frozen-lockfile
bun run build                    # self-hosted build compatibility
bunx --no-install netlify build --offline
```

The Netlify build runs TypeScript checks, all Vitest tests, the Vite build and
function packaging. No Netlify login or provider keys are needed for these
checks. Use `bun run test`, not `bun test` (the suite uses Vitest).

`bun.lock` was regenerated because the previous lockfile did not match the
manifest and used a version unsupported by the pinned Bun. Commit the updated
lockfile together with `package.json`; do not generate npm/yarn lockfiles.

## 2. Publish the preparation branch and open a pull request

For this Arena session, work stays on `arena/01a09569-temari`.
After reviewing and approving the changes, push that branch and open a PR into
`main`. Do not deploy the old `main` expecting backend functionality.

There is no active GitHub Actions workflow. Netlify's build command runs tests
and typechecking before deployment. For optional GitHub checks, see the inactive
template and activation instructions in [RENDER.md](./RENDER.md). Until enabled,
review deploy logs manually; there is no GitHub check to require for merging.

## 3. Connect Netlify to GitHub

1. In Netlify, choose **Add new project → Import an existing project**
   (the dashboard may call this “Add new site”).
2. Choose GitHub and authorize access to `lal-ye/temari`.
3. Set the production branch to **main**, base directory to the repository root.
4. Use the checked-in configuration:
   - Build: `bun run typecheck && bun run test && bun run build:client`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
5. **Do not add provider API keys**, `NETLIFY_AUTH_TOKEN`, or `VITE_*` secrets.
   BYOK needs no application environment secrets. Do not enable an AI gateway
   or shared provider credentials for this deployment.
6. Enable Deploy Previews for pull requests into the production branch.
7. If importing before the PR merges, the initial `main` deploy is still the
   old frontend-only version. Validate the PR's Deploy Preview, then merge.
   Alternatively, merge after local checks and preview validation pass and import afterward.

Netlify's Git integration handles continuous deployment. Its build command runs
typechecking and tests, so a failed check stops that deploy. This does not
automatically prevent merging a PR.

## 4. Verify the first Deploy Preview

Use only test data and a restricted, low-quota provider key on previews. A PR
can change application code; do not enter real keys on an untrusted preview.

- `/` loads the landing page.
- `/app` loads the study shell; refreshing it still works.
- `/api/health` returns JSON with `status: "ok"` and `hasServerKey: false`.
- `/api/missing` returns a JSON 404, not the landing page.
- A POST to `/api/ai/test-connection` with `{}` returns a JSON 401.
- In Settings, choose a built-in cloud provider, add your key, clear any custom
  URL, test the connection, and fetch models.
- Generate a short Note, Quiz and Exam, submit an Exam for grading, and explain
  a term. Confirm outputs are provider-generated rather than offline drafts.
- Upload a small text-based PDF and confirm extracted text.
- Clear the key and verify generation is labelled offline, not genuine AI.
- Check Netlify function logs for failures; never share logs containing keys or
  private study material.

Automated tests mock paid AI calls. Live provider behaviour, Netlify's deployed routing,
execution duration and account-specific limits must be checked in this step.

## Constraints and operational safety

- Hosted JSON bodies are capped at **4 MiB**, including the base64 PDF and
  credentials. Keep PDFs below roughly **2.5 MiB** to leave room for encoding
  and other fields. Larger uploads require a future direct-storage upload flow.
  Netlify can reject requests before Express runs; those errors may not be JSON.
- Functions have execution, response-size and memory limits. Check the current
  limits for your account before launch. Long AI generation, provider retries,
  and large/scanned PDFs can exceed them. This version is synchronous: it does
  not add a background-job queue or promise unlimited document sizes.
- Gemini requests have a 20-second per-request timeout; retries can extend the
  total operation. Other providers remain subject to platform timeouts.
- BYOK prevents use of your provider balance, **not** abuse of Netlify function
  usage. Configure usage alerts/budget controls in Netlify before public launch.
  No authentication or durable per-user rate limiting has been added.
- Learner keys remain in the app's existing browser settings/localStorage and
  are sent over HTTPS through the function to the chosen provider. They are not
  stored in a server database. Do not use this on a shared browser profile.
- Study data is local to each browser and origin. Preview, production and custom
  domains have separate localStorage; export data before changing domains.
- The native PDF parser is externalized for bundling. Do not remove its native
  dependencies to shrink the function without testing PDF extraction again.

## 5. Release and rollback

Merge the reviewed PR after checks pass. Netlify automatically builds `main`
and publishes the successful deploy. Repeat the smoke checklist on production.
For later changes: branch → pull request → build checks + preview → review → merge.

If a release breaks, open Netlify's Deploys list, select a known-good production
deploy and use **Publish deploy** / rollback. This restores its frontend and
functions, not browser data. Revert the faulty change through a new PR so the
next automatic deployment does not reintroduce it.

Connect a custom domain only after the default `*.netlify.app` site works.
Follow Netlify's displayed DNS records and verify HTTPS after DNS propagates.

References:
- https://docs.netlify.com/build/frameworks/framework-setup-guides/express/
- https://docs.netlify.com/build/functions/overview/
- https://netlify.ai/

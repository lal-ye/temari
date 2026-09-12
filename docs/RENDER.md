# Render: one service, test the branch before merging

## Architecture and defaults

One **Node Web Service** serves the Vite frontend and Express API on the same
origin. No static-site service, database, Dockerfile, CORS setup or deploy token
is required. Study data stays in browser localStorage.

`render.yaml` is configured for **arena/01a09569-temari**, not `main`. Local checks and a real Render deployment can run on this branch before a PR is merged.
This is a normal branch-linked service used for testing, not an automatically
created PR preview environment. Anyone with its URL can access it.

- Runtime: Node 22.22.3, Bun 1.3.9 for dependency installation/build scripts.
- Build: `NODE_ENV=development bun install --frozen-lockfile && bun run build:render`.
  The install explicitly includes build/test dependencies even when the service
  has `NODE_ENV=production`. Tests explicitly run with `NODE_ENV=test` so React test helpers are available
  even on a production-configured service. The build runs typechecking, tests, compilation and
  a bounded smoke test of the actual compiled Node server.
- Start: `node build/server.cjs`.
- Health check: `/api/health`.
- Environment: `NODE_ENV=production`, `TEMARI_HOSTED=true`; no provider secrets.
- Binding: `0.0.0.0` on Render's supplied `PORT`; do not override PORT.
- Auto-deploy: **On Commit** (`commit`).

The public frontend is in `dist/`. The server bundle and source map are in
`build/`, outside the public directory. Never publish `build/` as static files.

## 1. Local verification (already possible without pushing)

```sh
bun install --frozen-lockfile
bun run build:render
```

`test:deploy` starts and stops its own production server on a dynamically
allocated port. It checks frontend routes/assets, JSON API errors, BYOK
validation, rejection of custom URLs, and that server bundles aren't public.
It intentionally sets a dummy server key and `TEMARI_HOSTED=false` while
`RENDER=true`, proving Render cannot accidentally bypass hosted safeguards.
No paid AI requests are made.

## 2. Push this branch and open an unmerged PR

Commit and push only **arena/01a09569-temari**, then open a PR into `main`.
Leave it unmerged until the Render deployment passes the remote checklist.
There is no active GitHub Actions workflow: the current Arena GitHub connection
cannot push workflow files. Render runs all quality checks in its build command.
A failed check stops that deployment, but does not block a GitHub merge.

Uncommitted changes in Arena are not visible to GitHub or Render. Passing local
checks does not mean a remote deployment has happened.

## 3. Create the test service on Render

### Recommended: Blueprint import

1. Create/sign in to your Render account and connect GitHub.
2. Select **New → Blueprint** and authorize `lal-ye/temari`.
3. Select **arena/01a09569-temari** as the Blueprint source branch and use
   `render.yaml` as the Blueprint path. The service's branch is also explicitly
   set to this branch inside the YAML.
4. Review the resources: **one web service, Free compute, no database**.
5. Apply/create the Blueprint. Review the initial build and deployment logs.
6. Confirm the service's linked branch is `arena/01a09569-temari` and Auto-Deploy
   is **On Commit**. The build command runs checks on initial, manual and
   automatic deploys; a failing check prevents publication.

If Blueprint import isn't available, choose **New → Web Service**, connect the
GitHub repository (not merely a public URL), choose the same branch and enter
the settings above manually. `render.yaml` is not automatically applied to a
manually created service. Keep dashboard settings consistent with the file.

Do not add GEMINI_API_KEY or any other provider key to Render. Learners supply
keys in the app. Do not add Render tokens or deploy hooks to GitHub Actions:
Render's Git integration handles deployments.

For later branch pushes, Render immediately starts its build, runs all checks,
and publishes only if the build succeeds. Inspect Render Events and build logs
for results. Do not choose After CI Checks Pass while no GitHub checks exist.

## 4. Validate the onrender.com URL before merging

Use a low-quota test key, not a production key. Do not share the key in chat.

- Visit `/` and `/app`; refresh `/app` directly.
- Visit `/api/health`: expect JSON, `status: "ok"`, `hasServerKey: false`.
- Visit `/api/missing`: expect a JSON 404, not the landing page.
- With no key, generation should remain clearly labelled offline.
- In Settings choose a built-in cloud provider, clear any custom URL, enter
  your key, test the connection, and fetch models.
- Generate a small Note, Quiz and Exam; grade an Exam and explain a term.
- Extract a small text PDF; confirm text is meaningful.
- Check logs for errors, avoiding sharing private material or provider errors
  that might contain credentials. Remove the test key when done.

The build smoke test doesn't validate live provider credentials, PDF behaviour on
Render's machine, or Render's network/resource limits. Those need this remote
checklist. A successful deploy also doesn't guarantee every provider/model
combination works.

## 5. Merge and promote later — not required to test now

Keep this service branch-linked until testing is complete. Promotion must be
explicit; merging a PR does not automatically change Render's tracked branch.

For a Blueprint-managed service:

1. Temporarily disable Blueprint auto-sync before changing the branch field,
   so a final PR edit cannot deploy the old `main` prematurely.
2. As the final reviewed PR change, update `render.yaml`'s service `branch` to
   `main`. Run local checks and review the successful branch deployment, then merge the PR.
3. Change the Blueprint's source branch to `main` in Render, then sync/apply
   the Blueprint. Confirm the service now tracks `main`. Re-enable auto-sync
   if desired. If Render's current UI cannot change the Blueprint source branch,
   stop and resolve that configuration before deleting the test branch.
4. Verify the deployed commit is the merged commit and repeat the smoke checks.

For a dashboard-managed service, update `render.yaml` for consistency, merge,
then change the service's linked branch to `main` in Settings and deploy the
latest commit. No Blueprint source setting is involved.

Keeping the same service preserves its URL (and thus its browser localStorage
origin). A new production service/custom domain has separate browser storage;
export important study data before changing domains.

Protect `main` in GitHub with required PR reviews as available for your plan.
There is no GitHub status check to require yet. Review Render build results
manually before merging. All code changes in this Arena session stay on
`arena/01a09569-temari`; promotion changes are made there through the PR.

### Optional: add GitHub Actions later

An inactive template is saved at
[`deployment/github-actions-ci.yml.example`](./deployment/github-actions-ci.yml.example).
It does not run from that location. Using GitHub's web editor or your own local
Git setup, copy it to `.github/workflows/ci.yml` on this branch and commit it.
No PAT needs to be shared with Arena. Once checks run successfully, change
`autoDeployTrigger` to `checksPass` (After CI Checks Pass), sync Render settings,
and optionally require **Typecheck, tests and build** in branch protection.
Until then, retain `commit` so deployments do not wait for nonexistent checks.

## Limits and safety

- Free compute sleeps after 15 idle minutes and can take about a minute to wake;
  **the whole site** waits, not just the API. Render doesn't recommend free
  instances for production. Upgrade compute when this becomes unacceptable.
- Free resources have quotas, including shared instance hours, bandwidth and
  build minutes. External-API traffic can also trigger free-service restrictions.
  Check current allowances and usage/spend settings in Render before launch.
- Hosted JSON requests keep a conservative 4 MiB cap. Keep PDFs under roughly
  2.5 MiB because base64 expands their size. This is an app safety limit, not a
  claim about Render's maximum. Larger files need a deliberate upload design.
- BYOK safeguards are active whenever `RENDER=true` or `TEMARI_HOSTED=true`.
  They require a learner key and reject custom URLs/Custom-Ollama endpoints.
  Local/private self-hosting retains its existing unrestricted mode.
- BYOK protects your provider balance, not your hosting resources. There is no
  account system or durable per-user rate limiter. Keep public exposure modest.
- Keys are stored in the existing browser settings/localStorage and pass over
  HTTPS through this service to the chosen provider. Avoid shared browsers and
  untrusted test deployments.
- Long AI requests/retries and PDF parsing can hit memory/network limits. There
  is no background queue, unlimited upload promise, or new database.
- Render's filesystem is ephemeral; do not start persisting study data there.

## Rollback

Use Render's service Events/Deploys history to roll back to a known-good deploy
(subject to your plan's retention limits). Review auto-deploy settings afterward
so another push doesn't reintroduce the issue. Revert the broken change via PR.
Rollback restores code, not browser data or previously changed environment values.

## Optional alternative

The Netlify adapter/configuration is retained. Its build is not required
by the primary Render build pipeline. Before switching, run:

```sh
bunx --no-install netlify build --offline
```

See [NETLIFY.md](./NETLIFY.md) for its separate setup and limitations.

References:
- https://render.com/docs/blueprint-spec
- https://render.com/docs/deploys
- https://render.com/docs/bun-version
- https://render.com/docs/free

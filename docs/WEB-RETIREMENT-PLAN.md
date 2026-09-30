# Web app retirement — cleanup plan

Status: **agreed, revised 2026-09-30 after external review; not started**. Produced by a
design grilling session 2026-09-29; every claim below cites the artifact that proves it,
so the plan can be checked line by line and pushed back on. The revision folds in an
external review and a re-verification pass against the repo itself: five PRs become
PR 0 + three, the AI promotion halves and switches its admissibility criterion from
DOM-free to Node-free, imports go by workspace name, `check:mobile` certifies the real
bundle, and two claims of the first draft (the Render branch in §4, the phase state in
§9) failed verification and are corrected here rather than softened. When it ships,
[ADR-0014](./adr/0014-expo-web-and-android.md) — written first, as PR 0 — has already
absorbed the durable part, and this moves to [`archive/`](./archive/) per
`docs/README.md` rule 2.

The one-sentence version: **the mobile app is the product, and the gate matrix
that certifies it currently tests almost none of it.**

## 1. The finding

`apps/mobile` is the forward product — one Expo app serving **both** web and
Android, replacing the Vite/React app in `src/`. But the gate matrix recorded as
checkpoint-B evidence in
[`M2-CHECKPOINT-B-PLAN.md`](./mobile/M2-CHECKPOINT-B-PLAN.md) is almost entirely
web:

| Gate | What it actually covers |
|---|---|
| `bun run check:reader` | `src/reader-core/` — web TS, run through `tsx` |
| `NODE_ENV=test bun run test` | 466 tests / 34 files, **0 in `apps/mobile`** |
| `bun run typecheck:all` | the only gate that reaches `apps/mobile` |
| `NODE_ENV=production RENDER=true bun run build:render` | Vite build + Render deploy smoke test |

Test-file distribution, measured:

```text
tree                          size    tests   verdict
──────────────────────────────────────────────────────────
src/reader-core/             796K       8     ← FORWARD: DOM, expo/dom
src/  (minus reader-core)    1.1M      24     ← abandoned Vite app
server/                       64K       1     ← abandoned (functions)
packages/core/                64K       1     ← shared
apps/mobile/                   44K       0     ← FORWARD: the Expo shell
```

25 of 34 test files, and the entire `build:render` gate, certify a tree that is
being deleted. The forward shell is covered by exactly one gate
(`typecheck:mobile`). That is the thing to fix.

Two mechanical consequences fall out of the same evidence — corrected in revision,
because the first draft got the failure mode backwards:

- Root [`tsconfig.json`](../tsconfig.json) `include`s `src/**`, `server/**`,
  `server.ts`, `shared/**`, `vite.config.ts` and **`exclude`s `packages/**`**
  (verified). Delete the web tree and bare `tsc` does **not** pass vacuously — it
  fails loudly: `TS18003: No inputs were found in config file`, exit 2 (verified
  empirically with the repo's own `tsc` against an include list matching nothing).
  A loud failure is honest but is the wrong shape for a gate; the fix is re-pointing
  the include in the same commit as the deletion (PR B), not a tripwire a human must
  remember to run.
- The **silent** failure is the suite. [`vitest.config.ts`](../vitest.config.ts)
  `include`s `src/**`, `server/**`, `packages/core/**` and `exclude`s
  `apps/mobile/**`, justified in a comment: *"native tests stay in the Expo
  workspace so they cannot accidentally require a browser environment"*. **That
  Expo workspace has no vitest config and no test script** — `apps/mobile/package.json`
  has only `start`, `android`, `typecheck` (verified). The deferral points at a room
  that was never built. Delete the web tree and `bun run test` goes green at 1 file /
  4 tests with no error anywhere — a gate that can shrink without failing is not a
  gate. And every intermediate state shrinks the same way: promote `src/reader-core/`
  out of `src/` and eight test files plus ~800K of sources silently fall out of both
  gates. PR A therefore extends the includes as it moves code (nothing falls out);
  PR B re-points and deletes atomically (the half-done state cannot exist).

## 2. Decisions

Agreed in grilling 2026-09-29; revised by the review 2026-09-30:

| # | Decision |
|---|---|
| 1 | The standalone web app is **abandoned**; the successor is one Expo app for web **and** Android. |
| 2 | **Promote `src/reader-core/` → `packages/reader-core/`** before deleting the web app. |
| 3 | **Absorb the durable AI pieces into `packages/core/`** — the ADR-0002 port (`src/services/ai/` minus its web singleton), `shared/aiCatalog.ts` (ADR-0003), and the domain types in `src/types.ts`. The transport (`server/aiProvider.ts`) dies with the tree. Admissibility criterion: **Node-free / Hermes-safe** — DOM-free was the web-era criterion and is not sufficient. **No third package.** |
| 4 | **No history rewrite.** `git rm` on a branch, merged by PR. One `git revert` from undoing — and git history *is* the archive, so nothing is copied into `docs/archive/` for sentiment. |
| 5 | **`check:mobile` certifies the real bundle**: `typecheck:mobile` + `CI=1 bunx expo export --platform android` + `check:reader:export`. A vitest project for `apps/mobile` is added the day M3 produces its first pure module — a one-test placeholder room certifies nothing. |
| 6 | **ADR-0014 is written and accepted first** (PR 0), including one table of which editorial rules survive Expo web. The 8 superseded ADRs flip to `Status: Superseded by ADR-0014` **in place** — no relocation. |
| 7 | **Delete the deployment configs outright**, no archive copies; the live Render/Netlify services are killed by hand. |
| 8 | **PR 0 + three PRs.** PR B re-gates *and* deletes in one PR, so the coupling hazard the review flagged (re-gate without delete, delete without re-gate) cannot arise by construction. |

### Why reader-core is forward, not past

It is the mechanism for "one codebase, two platforms": it is written as DOM
code with `'use dom'` and `expo/dom` — React Native 0.86 new-architecture DOM
rendering, **not** a WebView. `apps/mobile/components/ReaderAssetSpikeDOM.tsx`
opens with `'use dom'` and imports the renderer, bridge and CSS from it. Its
location inside `src/` is incidental and is enforced by exactly one hardcoded
string, `scripts/check-reader-boundary.mjs:6`. It is a standalone package
living in the abandoned tree, which is the whole reason `check:reader` points
into `src/`.

It is hermetically sealed — 8 allowed deps (`react`, `react-markdown`,
`remark-gfm`, `remark-math`, `rehype-raw`, `rehype-sanitize`, `rehype-katex`,
`lucide-react`, listed at `scripts/check-reader-boundary.mjs:9`), and
`localStorage`/`sessionStorage`/`indexedDB`/`fetch`/`XMLHttpRequest`/`WebSocket`/
`Worker`/`eval` (`:10`) and relative imports escaping the root all throw. That
seal is the reason the promotion is safe, and it follows the package.

### Why only the port and the catalog move

The first draft promoted three AI modules and called them "DOM-free" — the
web-era criterion. The forward criterion is **Node-free / Hermes-safe**: there is
no server in the Expo app, and M4 (real BYOK) has not decided whether Providers
are called device-direct or through some edge — the same undecidedness that
parks `aiConnection.ts`. Promoting a transport now means guessing M4's shape and
engraving the guess as a package.

`server/aiProvider.ts` fails the criterion measurably, not hypothetically: it
resolves credentials from `process.env` seven times (`:34`, `:116`, `:429`,
`:535`, `:585`, `:620`, `:662`) and its only heavyweight import is `@google/genai`,
whose tree pulls `google-auth-library`, `protobufjs` and `ws` (`bun.lock:434`) —
none of which exist on Hermes. Its companion `server/app.test.ts` binds
`serverless-http`. Both die with the tree; M4 exhumes whichever transport it
actually needs with one `git log --follow`.

What moves is exactly what [ADR-0002](./adr/0002-ai-generation-port.md) and
[ADR-0003](./adr/0003-shared-ai-provider-catalog.md) name as durable:

- **The port** — `src/services/ai/` minus the store-wired singleton: `contracts.ts`
  (`AiGenerator`, `GenerationAdapter`, `GenerationResult`), `http.ts`, `offline.ts`,
  `credentials.ts`, `diagnoseError.ts`, `isAbortError.ts` (a pure name check, no
  `DOMException` — Hermes-safe) and the two test files. The factory already takes
  its settings by injection — `createAiGenerator(deps: { getSettings })`,
  `index.ts:53` — so the port is store-free; only the exported `ai` singleton binds
  the web store (`index.ts:117`), and that binding stays behind in a shim until the
  tree dies.
- **The catalog** — `shared/aiCatalog.ts` (185L), ADR-0003's single source of truth
  for Provider identity.
- **The domain types** — `src/types.ts` (251L). `http.ts`, `contracts.ts`,
  `credentials.ts` and `offline.ts` import from it, so it moves or the port does
  not compile.

`GenerationResult.source` (`'model' | 'offline'`) is the only implementation of
[`CONTEXT.md`](../CONTEXT.md)'s rule that offline generation "must always be
identifiable as offline content, never presented as Provider output" — the port is
what keeps M3/M4 viable. Staying out, to die with the tree:
`src/components/tools/modelPresentation.ts` and `ApiKeySettingsModal.tsx` (client
concerns importing React), `src/services/aiConnection.ts` (ADR-0002's hypothetical
seam), and the transport pair above.

The fit for the destination is not incidental: `packages/core/src/portable.ts`
already declares the criterion — *"no React, browser, storage, filesystem, or
Node dependencies"* — and the absorbed modules must meet it, enforced (below), not
aspirational.

## 3. Target shape

```text
packages/
├── core/          @temari/core    exists + AI port + catalog + domain types absorbed
└── reader-core/   @temari/reader-core   ← src/reader-core/   promoted, seal intact
apps/mobile/       the Expo shell        imports @temari/* by workspace name, never ../../
src/  server/  shared/  netlify/  public/   deleted
render.yaml  netlify.toml  server.ts        deleted — no copies archived
```

Two packages and one app — no third package. The review asked whether the monorepo
is still worth it with the web app dead, and answered narrowly: yes for
`reader-core` — a genuinely separate compilation target (the DOM bundle) whose
`exports` map is the honest statement of its API — and yes for `core`, which is
tiny and pure. No for a new `ai-core`: the port is not a package boundary, it is a
module inside the existing pure one. `packages/core` is the template either way:
`private: true`, `type: module`, `exports` map, tests colocated
(`src/portable.test.ts`).

## 4. The PRs

PR 0, then three. Each lands green on the gate. Nothing is deleted before what
depends on it has moved.

### PR 0 — ADR-0014, accepted before any deletion

The decisions in §2 are agreed; the repo's own governance (`docs/README.md` rule 1)
treats ADRs as the durable record plans collapse into. Landing deletions that cite an
accepted [ADR-0014](./adr/0014-expo-web-and-android.md) beats landing deletions that
cite a plan promising one. The ADR records: the Expo web+Android decision, the
retirement, a one-line pointer to the deletion commit SHA (added in PR B), and —
closing the old §7 question — **one table** of which editorial rules survive on
`expo start --web` (ADR-0005's motion budget, ADR-0010's surface ramp: craft rules
carry over, DOM-platform rules do not). A table in the ADR, not a new doc.

### PR A — promote `reader-core`; absorb the AI port into `packages/core`

Two moves of the same kind — package boundaries — reviewed in one mode.

**Reader-core.** `git mv src/reader-core packages/reader-core`, then fix every
reference:

| Site | Change |
|---|---|
| `apps/mobile/app/reader-spike.tsx` (3 imports), `apps/mobile/components/ReaderAssetSpikeDOM.tsx` (4) | `../../../src/reader-core/…` → `@temari/reader-core/…` — workspace name, never a four-deep relative path into a sibling package |
| `apps/mobile/package.json` | add `"@temari/reader-core": "workspace:*"` |
| new `packages/reader-core/package.json` | on the core template; declare the 8 reviewed deps; an `exports` map with a `./*` subpath pattern so deep-path imports (`@temari/reader-core/bridge`, `/session/createExplainSessionHandler`, `/reader.css`, `/assets.generated.css`) survive without a barrel |
| new `packages/reader-core/tsconfig.json` + `typecheck:reader` | on the `typecheck:core` pattern, so type coverage is continuous through the move |
| `scripts/check-reader-boundary.mjs:6` | the hardcoded root — the one real blocker |
| `scripts/build-reader-assets.mjs:38` | generated-CSS output path |
| `scripts/smoke-reader.mjs` (3 imports) | paths |
| `.gitignore:56` | `src/reader-core/assets.generated.css` → new path (the root `postinstall` regenerates it) |
| `vitest.config.ts` | include gains `packages/reader-core/**` — the suite stays at 34 files / 466 tests; nothing silently falls out |
| `src/utils/segmentTerm.ts` | the checkpoint-B re-export shim — re-point it or web typecheck breaks (the first draft missed this one) |
| `src/components/notes/rehypeNoteAnchors.test.ts:118`, `src/components/ui/keyboardOwnership.test.ts:132` | both assert the **old path**: one reads `../../reader-core/NoteContent.tsx` off disk, one asserts the literal `"from '../../reader-core/selection/segmentTerm'"`. Re-point them now; they die with the tree in PR B |

The remaining ~14 `src/` files referencing reader-core (diagrams, notes,
`dev/reader-fixture.tsx`, `vite.config.ts`) die with the web tree in PR B. Metro
needs one check, not a config: `apps/mobile` has no `metro.config.js`, and SDK 57
watches workspace folders by default — the `expo export` leg in §8 is the proof it
resolved. **One web-only file rides along and must be dropped:** `csp.ts` (1.1K) plus
`csp.test.ts` build a Content-Security-Policy whose only consumer is
`vite.config.ts:5`. Delete them in this PR, not with the tree — they do not belong
in the sealed package.

**AI port.** Move into `packages/core/src/`: `types.ts`, the port modules listed in
§2, and `shared/aiCatalog.ts` (→ `packages/core/src/aiCatalog.ts`); the
`../../types` and `../../../shared/aiCatalog` imports collapse to package-internal
ones. Leave one-line re-export shims at `src/types.ts`, `shared/aiCatalog.ts` and
`src/services/ai/index.ts` — the shim keeps the `ai` singleton and its
`getStudyStore` wiring — so the doomed web tree (including `server/aiProvider.ts`)
keeps typechecking until PR B deletes it. This is the repo's established compat
pattern (`src/utils/segmentTerm.ts` did the same job at checkpoint B). Root
`typecheck` follows the import into `packages/core` even though the directory is
`exclude`d — exclude governs the entry set, not import-following — so any type
friction surfaces in PR A's gate run, where it belongs.

Extend the `packages/core` boundary check (`scripts/check-core-boundary.mjs`) so
the new criterion is enforced: forbid `node:*` imports, `process.*` and `Buffer` as
well as DOM globals — the target runtime is Hermes, not Node, and `tsc` alone
cannot see the difference.

**Import mechanics, once, here.** `apps/mobile` imports `@temari/reader-core` and
`@temari/core` by workspace name from now on; a four-deep relative path into a
sibling workspace bypasses the `exports` seal the promotion preserves and is
Metro's fragile case. Add a CI grep asserting `apps/mobile` contains no import
escaping the workspace root (`../../`) — the guard that keeps the tree deletable
between PR A and PR B.

**After PR A lands: re-run the phone checklist.** Checkpoint B's phone evidence
certifies asset embedding under a specific bundle layout — preview APK, airplane
mode, cold launch, no Metro, kitchen-sink render with fonts and CSP quiet — and
PR A moves exactly the paths that evidence depends on. One repeat of the offline
cold-launch check is cheap insurance; without it the checkpoint-B record silently
stops describing `main`.

### PR B — re-gate and delete, atomically

One PR, immune by construction to the sequencing hazard: the commit that removes
the old include targets is the commit that adds the new ones. There is no state in
which the gates certify nothing without failing.

- Re-point root `tsconfig.json` at `packages/*/src/**` and drop the web includes;
  bare `typecheck` then covers what exists.
- Re-point `vitest.config.ts`: drop `src/**` and `server/**`, keep `packages/**`.
- `git rm`: the rest of `src/`, `server/app.ts`, `server.ts`,
  `netlify/functions/api.ts`, `scripts/smoke-deploy.mjs`,
  `scripts/generate-og.py`, `render.yaml`, `netlify.toml`, `vite.config.ts`.
  **No copies archived** — Decision #4 makes git history the archive; ADR-0014
  gets the deletion commit SHA instead.
- Move `public/og.png` to `assets/` (it is bytes; Expo web gets a redesigned card
  anyway); its generator dies with the tree.
- Delete the now-meaningless scripts: `build:render`, `test:deploy`, `build`,
  `build:client`, `dev`, `start`, `preview`, `clean`; drop `express`,
  `serverless-http`, `@types/express` — and `@google/genai`, which the halved
  promotion makes dead weight: only the dying `server/aiProvider.ts` imports it
  (verified). It is one `git log` away if M4 wants it.
- Delete local artifacts: `dist/` (gitignored, 3.1M) and the stale APKs in the
  parent directory. Reproducibility beats relics — the APK workflow is fixed and
  merged (#29).

`render.yaml` correction, recorded because this plan's pitch is "check me line by
line": the first draft called the pinned branch misspelled (`temary`) and said it
"has been deploying nothing". **Both claims failed verification.** `render.yaml:7`
reads `branch: arena/01a09569-temari` — correctly spelled; it is the very branch
PR #24 deployed and the user confirmed live, and it still exists among the leftover
arena heads on origin. The service is *frozen at its last deploy* of a pre-merge
branch: it serves the abandoned app and will never see `main`. The action is
unchanged — delete the file, kill the service by hand.

**The live Render and Netlify services are killed by hand**, in their own
dashboards; nothing in the repo can do that. Until they are, a public URL still
serves the abandoned app. Kill them before PR C deletes the branch the Render
service tracks.

New gate matrix:

```text
bun run check:reader · NODE_ENV=test bun run test
bun run typecheck:all · bun run check:mobile
```

where `check:mobile` = `typecheck:mobile` + `CI=1 bunx expo export --platform
android` + `check:reader:export` — the gate that certifies the forward product's
actual Hermes bundle (one HTML doc, 24 embedded WOFF2, no `@import`, DOM assets in
Android metadata — [`scripts/check-reader-export.mjs`](../scripts/check-reader-export.mjs)),
not a placeholder test.

Expect the suite to fall from 34 files / 466 tests to ~10. That drop is the point,
not a regression: the deleted files certified a deleted product. **The PR
description carries §1's before/after table verbatim** — the number with its
denominator is not alarming; the bare number is.

### PR C — docs, ADR statuses, workflow wiring

See §6 for the docs. Also:

- Replace the dead
  [`docs/deployment/github-actions-ci.yml.example`](./deployment/github-actions-ci.yml.example)
  — a 26-line file whose only step is `bun run build:render` — with a real CI
  workflow on the new gate matrix; have `android-preview.yml` extend it and also
  trigger on push to `main`, so a merge produces an APK. Fix the example's
  hardcoded `bun-version: 1.3.9` against the repo's `.bun-version`.
- Delete the merged leftover `arena/*` branches on origin (six heads, including
  `arena/01a09569-temari`) — after the Render service is dead, since that is the
  branch it tracks.

## 5. What stays live, and why

Five ADRs describe domain decisions that survive the platform change — the
*decisions*; the web-era implementations behind 0001, 0007 and 0008 die with the
tree, and M3/M4 reimplement per the ADR. Two are cited by
[`CONTEXT.md`](../CONTEXT.md) itself:

| ADR | Decision |
|---|---|
| [0001](./adr/0001-study-store-deep-module.md) | one deep Study-Store module |
| [0002](./adr/0002-ai-generation-port.md) | AI generation behind one port (HTTP + offline) |
| [0003](./adr/0003-shared-ai-provider-catalog.md) | one shared AI Provider catalog |
| [0007](./adr/0007-source-material-resolver.md) | one pure Source-Material resolver |
| [0008](./adr/0008-cognitive-level-aware-exam-generation.md) | Cognitive-Level-aware Exam blueprints |

Eight are superseded by ADR-0014: 0004 (CSS view transitions), 0005 (motion
budget), 0006 (sidebar removal), 0009 (landing route split), 0010 (editorial
design system), 0011 (landing display variant) — all web UI — plus 0012 (Netlify)
and 0013 (one Render service), the deployment path being deleted.

All 13 currently read `Status: Accepted`; only 0005 carries a superseded note
(inline, at `:54`). The eight flip to `Status: Superseded by ADR-0014` **in place**.
The repo's rule is "ADRs get superseded, not deleted" (`docs/README.md`) — it
requires the record to survive, not to move, and moving files is how this repo
grew the orphaned-doc and broken-index problems §6 catalogs. `docs/archive/adr/`
stays empty.

## 6. Docs

`docs/` is 7.1M, of which `docs/screenshots/` is 6.6M. The dating is a clean
separator: every web-era doc is ≤ 2026-09-12, every mobile doc ≥ 2026-09-21.

- **Archive** to `docs/archive/` with dated banners (rule 2): both `ui-plan-*.md`,
  `NETLIFY.md`, `RENDER.md`.
- **Delete**: `docs/screenshots/` (6.6M, and `docs/README.md` already calls it
  historical), plus `figure-gallery.html` and
  `wireframe-interactive-notes.html`, which the README likewise marks as
  predating the redesign.
- **Link the orphans.** Three files have zero inbound links anywhere in the repo
  (verified: this plan is the only reference): `docs/adr/0012-netlify-byok-functions.md`
  (resolves itself once superseded and indexed) and two mobile files carrying real
  history — `docs/mobile/M2-B-PHASE3-HANDOFF.md` and `docs/mobile/PORTABLE-EXPORT.md`.
  Link these two from the mobile plan.

Two index defects, both mechanical:

1. `docs/README.md`'s ADR table lists 0001–0011 only. **0012 and 0013 exist on
   disk and are unlisted** — linked separately under "Deployment guides", as
   though they were guides rather than decisions. Fix: add both rows (Superseded)
   to the ADR table, and delete the "Deployment guides" section outright.
2. `docs/mobile/EAS-BUILD.md:99` states "No Render service, branch, credentials
   or hosting plan changes are needed", in tension with `RENDER.md` and ADR-0013
   being presented as the recommended path. Moot once `RENDER.md` is archived;
   the sentence goes with it.

## 7. Closed by the review

The 2026-09-29 draft left five questions open; the review answered all of them:

- **Design constraints on Expo web** → one table in ADR-0014 (PR 0), not a new
  doc. Marking ADR-0005/0010 superseded is right for the DOM, but the ADR says
  explicitly which craft rules survive, or the next person rebuilds or discards
  them arbitrarily.
- **`public/og.png`** → keep the PNG (it is bytes), delete the generator (it is
  maintenance). PR B moves the file before `public/` dies.
- **`src/services/aiConnection.ts`** → delete with the tree. Decision #4 makes it
  one `git log --follow` away; parking files in `archive/` "for M4" is how the
  docs tree got into the state §6 catalogs.
- **Test-count optics** → §1's before/after table goes verbatim into the PR B
  description.
- **`dist/` and the stale APKs** → delete. The APK workflow is fixed and merged
  (#29); reproducibility beats relics.

## 8. Verify

```bash
# after PR A — nothing may have silently fallen out
bun run check:reader                      # seal intact at the new root
NODE_ENV=test bun run test                # still 34 files / 466 tests
bun run typecheck:all                     # now includes typecheck:reader
grep -rn "\.\./\.\./" apps/mobile         # zero hits — the CI guard
# in apps/mobile:
CI=1 bunx expo export --platform android --output-dir ../../.cache/m2-export
cd ../.. && bun run check:reader:export   # the leg a moved generated-CSS path breaks; typecheck cannot see it
# + the phone checklist, re-run on the physical device

# after PR B — atomic, so there is no tripwire to run
NODE_ENV=test bun run test                # ~10 files; PR description carries the §1 table
bun run typecheck:all
bun run check:mobile                      # typecheck:mobile + expo export + check:reader:export
gh workflow run android-preview.yml       # the APK gate still builds after the deletion
```

The first draft's "`typecheck:all` must FAIL" tripwire is gone by construction: PR B
cannot land half-done, and the failure mode the tripwire guarded against was
misidentified anyway — a fully deleted tree makes `tsc` fail loudly (TS18003,
verified); the quiet killer is the suite shrinking without error, which PR A's
include-extension and PR B's atomicity close.

## 9. State

M2 checkpoint B: Phases 0–2 merged in PR #27 (2026-09-25); Phases 3–5 merged in
PR #28 (2026-09-28) — sanitizer + link policy, selection + session, gates — with
the gate matrix green 2026-09-28; PR #29 (the APK workflow's `setup-android` fix)
merged 2026-09-29. The **physical-device checklist is done (2026-09-30)**:
items 1–4 and 6–7 passed; the item-5 bug (tap chip auto-dismiss) was fixed in
PR #31 and re-verified on a fresh APK, and the evidence is in the checkpoint-B
record in [`M2-READER-SPIKE.md`](./mobile/M2-READER-SPIKE.md). Nothing on main
depends on any `arena/*` branch; the leftover heads are deleted in PR C. The
post-PR-A re-run is **done (2026-09-30)**: all 7 items pass on the APK from
`android-preview` run `36730738604` (head `7fc9da3`, the PR #33 merge);
evidence is appended to the checkpoint-B record. No device gate remains
before PR B.

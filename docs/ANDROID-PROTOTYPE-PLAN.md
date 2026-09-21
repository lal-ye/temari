# Temari Android feasibility prototype

Status: handoff-ready proposal. The user intends to continue in a fresh session;
confirm the first implementation batch and unresolved inputs before installing or restructuring.
Prepared: 2026-09-21. Scope: Android only, one physical test device first.

## 0. New-session handoff — read this first

### What the user wants next

The user asked to move implementation into a fresh session for context management,
finish this handoff, then merge the preparation PR. This document is a proposed
implementation plan, not evidence that any native work has already shipped.
Start with M0 + M1, review results with the user, then tackle the M2 reader risk
spike. Do not start a full React Native rewrite or all milestones at once.

### Repository and release baseline

- Repository: `lal-ye/temari`.
- Preparation PR: https://github.com/lal-ye/temari/pull/24, targeting `main`.
- Historical head before this handoff: `12d5c64` (Markdown display repairs).
- This handoff is being included in PR #24 before merging. In a new session, check
  the PR's actual merged state and current `main` SHA; do not infer merge success
  from this document. Start a new Arena session based on updated `main`.
- Stay on the new session's assigned branch. Do not switch to or push `main`, or
  reuse the historical preparation branch merely because it appears in this plan.
- No `apps/mobile`, shared workspace extraction, Expo project, EAS project, mobile
  SQLite schema, portable export format or native APK has been implemented yet.
- The work to date remains React/Vite + Express, with one shared web API and
  browser-local study data. This is not Next.js and has no account/database backend.

### Current deployed service and deployment hazards

- Live site: https://temari-996r.onrender.com/
- Study UI: https://temari-996r.onrender.com/app
- Health endpoint: https://temari-996r.onrender.com/api/health
- User created a Blueprint-managed Render Free Node web service, `temari`.
- `render.yaml` still targets `arena/01a09569-temari`, with `autoDeployTrigger: commit`.
  Merging PR #24 does NOT switch Render's service branch or Blueprint source branch.
  Keep the historical branch until Render is intentionally moved off it.
- Do not create another Blueprint/service as part of mobile scaffolding. Do not
  silently change paid compute, Render environment variables or auto-sync settings.
- Before implementing, ask whether the user has promoted the existing service to
  `main`. If not, follow `docs/RENDER.md` with the user: coordinate Blueprint
  auto-sync, source branch and service branch together. A dashboard override alone
  can be overwritten by the next Blueprint sync. Changing the YAML service branch
  while auto-sync is active may itself initiate a deployment.
- The Android API URL can remain the existing HTTPS URL. A new mobile working
  branch should not automatically become Render's backend deployment branch.
- Public hosted API is BYOK-only; custom URLs/Ollama are intentionally rejected.
  No shared provider key is required in Render. Hosted JSON cap is 4 MiB; start PDF
  tests below 1 MiB. Free-service cold starts still apply.

### Fixes already delivered — preserve them

- `a5e770a`: branch-first Render setup, shared Express factory, pinned tools, test/
  build/smoke gates, private backend bundle in `build/` rather than public `dist/`.
- `dfeaa41`: cloud requests omit saved custom/Ollama URLs; provider credentials
  scoped correctly; misleading shared-key copy and Gemini prefix warning removed.
- `dec5ae6`: readable topic/cognitive-level accuracy table with percentages,
  answer counts, horizontal scrolling and touch-accessible details.
- `20ba054`: GitHub-style callouts detected in parsed nodes rather than React child
  types; preserved multiline/inline formatting; improved heading text layout.
- `12d5c64`: display-only duplicate-heading and entity-escaped-callout repairs;
  stricter Markdown generation instructions. Stored source is not rewritten.

Do not regress the Markdown renderer when extracting it. Relevant fixtures cover
callouts, code, diagrams, math/heading anchors and generated formatting mistakes.
Existing malformed table spacing and unbalanced emphasis are NOT automatically
repaired; prompt guidance is not a guarantee of valid future AI output.

### Verified vs still unverified

- Last implementation baseline: 385 tests across 26 files, TypeScript, production
  build and compiled-server smoke test passed. Re-run rather than treating this
  historical count as a permanent requirement.
- User confirmed the live site and `/app` routing worked; subsequently confirmed
  the BYOK fix and analytics change worked.
- Earlier health verification returned `status: ok`, `hasServerKey: false`.
- Do NOT claim the complete live PDF/Exam/provider matrix was tested; those results
  have not all been reported. The latest Markdown display repair was tested locally;
  full post-deploy device validation was not recorded before this handoff.
- Native compatibility, runtime performance, offline DOM assets, actual EAS build
  access/quotas and native dependency resolution remain unproven until the prototype.
- Existing frontend build emits non-blocking CSS and large-chunk warnings.

### Commands and tooling

```sh
# Repository root; Node 22.22.3 and Bun 1.3.9 are the current pins.
bun install --frozen-lockfile
NODE_ENV=production RENDER=true bun run build:render
```

`build:render` runs typecheck, Vitest with NODE_ENV=test, Vite/esbuild production
build and `scripts/smoke-deploy.mjs`. Use `bun run test`, not Bun's built-in runner.
The smoke test starts/stops a bounded local process; it does not call paid AI.
Do not regenerate package-lock.json or silently upgrade the whole dependency tree.

No active GitHub Actions workflow exists. Arena's GitHub App was unable to push
`.github/workflows/ci.yml` because it lacks Workflows permission; repeated push
attempts did not solve it. The inactive template is at
`docs/deployment/github-actions-ci.yml.example`. Render runs checks during its
build; failed builds block deployment but not GitHub merges. Do not add a workflow
file through the same connection without resolving that permission first. Never
request a PAT/provider key/signing key in chat as a workaround.

### Read before changing architecture

1. `README.md`, `DEVELOPING.md`, `CONTEXT.md`.
2. `docs/adr/0001-study-store-deep-module.md` and
   `docs/adr/0002-ai-generation-port.md`.
3. `docs/adr/0003-shared-ai-provider-catalog.md`.
4. `docs/adr/0013-render-single-service.md` and `docs/RENDER.md`.
5. The actual imports/implementations named in section 2; inspect the current tree
   instead of assuming file paths/contracts are unchanged.

### Unresolved owner decisions

- Android phone model, OS and ability to use USB debugging.
- Expo account availability and EAS vs local build preference.
- Personal-device experiment vs near-term Play release.
- Confirm consent to add the portable-export UI and small workspace packages.
- Confirm current Render branch/promotion status before pushing structural changes.
- Confirm build/provider spending limits; no paid plan or account creation authorized
  merely by accepting this architecture document.

### Suggested opening prompt for the next session

> Continue Temari's Android feasibility prototype from
> `docs/ANDROID-PROTOTYPE-PLAN.md`. Read its handoff section and the referenced
> architecture documents first. Confirm PR #24 is merged and this session is based
> on updated main, but work only on this session's assigned branch. No native work
> exists yet. Verify the code/tool versions and ask the unresolved device/build
> questions. Propose the exact M0 + M1 changes before editing. Preserve the working
> web app, BYOK security, Markdown fixes and Render deployment. Do not implement the
> entire migration, add cloud sync, change hosting plans, create GitHub workflows,
> or merge anything without an explicit checkpoint.

## 1. Decision and purpose

Build a small Expo native client alongside the existing web app, not a replacement.
Use Expo DOM components for the complex Notes body, native screens for navigation,
import, settings and flashcards, and keep the existing Render backend.

The experiment must answer four questions:

1. Does a real exported Temari note render and behave well offline on Android?
2. Can text selection cross the DOM/native boundary into a BYOK explanation call
   without exposing credentials to the reader?
3. Can a learner import a quiz, finish a native Drill and retain the correct result
   after restarting, without changing the web scoring rules?
4. Is this sufficiently better than the mobile website to justify maintaining
   another client?

This is a feasibility prototype, not a production app or store launch commitment.
If the reader or integration costs fail the gates below, stop and prefer PWA work.

## 2. Evidence from this repository

The audit was performed on the current working tree, including the recent Render,
BYOK, analytics and Markdown fixes. No native implementation has started.

A text scan found 29 source-tree files mentioning localStorage, sessionStorage,
window or document; 26 excluding `*.test.*`. These are triage counts, not a reuse
percentage: comments can match, transitive imports can hide dependencies, and React
imports do not by themselves make a module unusable on React Native.

| Existing module | Observed evidence | Prototype treatment |
| --- | --- | --- |
| `src/types.ts`, `shared/aiCatalog.ts` | Domain types/provider facts; no browser runtime needed for the examined definitions | Share in a small pure TypeScript package, preserving compatibility re-exports for web |
| `src/services/examBlueprint.ts` | Planning, ordering, deduplication and option shuffling are separate functions importing domain types | Portable candidate; do not extract until needed by a mobile feature |
| `src/utils/analytics.ts`, `src/utils/bloomHeat.ts` | Analytics and review calculations are separate from JSX/browser persistence | Share only summary functions needed by the results screen; retain tests |
| `src/components/quizzes/FlashcardView.tsx` | Drill completion calculates score and updates state inside the component | Extract and test the minimal completion calculation; do not claim scoring is already fully portable |
| `src/services/studyStore.ts` | Has an injected StorageAdapter factory, but imports its web adapter and exposes a web singleton | Do not import the singleton into mobile; avoid a wholesale store rewrite |
| `src/services/storageAdapters.ts` | Synchronous reads/writes; localStorage and storage events mixed with memory adapter | Not a drop-in match for async native persistence; keep web adapter in web |
| `src/services/ai/http.ts` | Uses relative fetch paths, settings-derived credentials and AbortSignal | Make transport URL/credential acquisition injectable; preserve relative URLs for web |
| `src/services/ai/index.ts` | Factory/policy plus a study-store-backed singleton | Share pure contracts/policy only as needed; native composition must not import web singleton |
| `src/components/notes/NoteViewer.tsx` | DOM selection, reading-place hooks, toast/modal/UI dependencies, CSS and Markdown pipeline | Extract a content-only reader; web wrapper keeps existing integrations |
| `src/components/diagrams/*` | Custom diagram parsing/rendering, not a Mermaid runtime dependency | Preserve current JSON/legacy diagram support; do not add Mermaid just for the prototype |
| `exportAllData` / `importAllData` in study store | A version-1 backup exists; export copies all settings; import parses then performs sequential writes | Add a validated, credential-free portable format before real data transfer |

Important finding: existing backups can contain `apiKey` and `providerKeys` because
all settings are copied. Do not ask testers to send these files in chat, commit
real backups, or use them as fixtures. Treat backups already shared elsewhere as
potential credential disclosures.

## 3. Current tooling decisions, with corrections to the supplied report

### Expo baseline

Use the latest stable SDK 57 patch verified at implementation kickoff, at least
57.0.17; do not choose SDK 58 beta for this experiment. Record exact resolved
versions in the lockfile, run Expo's dependency alignment checks and Expo Doctor,
and use SDK-compatible React/React Native/Router versions rather than choosing
those independently. SDK 57 documents React Native 0.86 and React 19.2.

The current web dependency range permits React 19.3, so sharing React packages
requires an explicit compatibility/resolution check. A pure core package must not
pull React in at all. A shared DOM reader should use peer dependencies, not bundle
its own React copy. Each native bundle must resolve one compatible React runtime.
If alignment requires changing web React, that is a separately tested change, not
an incidental lockfile upgrade.

SDK 57's prebuild change is specifically that prebuild cleans/regenerates native
directories by default. We will deliberately use CNG/config plugins, keep generated
native directories out of source control initially, and not make unrecorded native
edits that the next prebuild deletes. Check New Architecture support for every
added native dependency; use the SDK-supported architecture, not legacy opt-outs.

### DOM components

Prefer a `'use dom'` entry around the extracted Notes body. Expo documents local
embedded exports and an async bridge; SDK 56+ defaults to `@expo/dom-webview`, so a
separate react-native-webview dependency is not automatically necessary.

This is NOT an automatic security boundary. It is possible to pass secrets as
props; our interfaces and tests must prohibit it. Native action props must be
serializable at the boundary and asynchronous, with no nested function props.
The existing callbacks that pass HTMLElement/SVGElement cannot cross directly.

### Keep the existing package manager

Use Bun workspaces initially; Expo officially supports Bun monorepos. Do not switch
to pnpm just because the report recommends a monorepo. Verify the existing Bun pin
works with the selected Expo toolchain; upgrade it only if required and rerun web
checks. Keep one canonical lockfile.

### Security and distribution corrections

SecureStore improves encrypted credential storage at rest; it is not protection
against a compromised/rooted runtime, malicious app code or secrets in logs.

Google's 12-testers/14-days rule applies to production access for new personal Play
accounts, not to every local prototype installation. Opening an account does not
start that clock: eligible testers must join a closed test and remain opted in.
Check verification/distribution eligibility early, but do not make public Play
release a dependency of this technical experiment.

## 4. Precisely bounded scope

### Included

- One Android application on one physical device; second device if available.
- Native Library, Settings, Drill and Result screens.
- Existing-note reading using an embedded DOM component, offline.
- One validated web export → Android import flow, with sample fixtures.
- Native persistence across restart and export of the resulting dataset.
- Native BYOK storage; initially expose Gemini as the single tested provider.
- Connection test and selection → Explain Term through the existing Render API.
- One small PDF import/extraction spike; no PDF library-management product.
- Loading, offline, cancellation, failure and cold-start UI.
- Installable preview APK that launches without a development server.

### Explicitly excluded

- Full exam-taking/AI grading UI, Planner, full analytics dashboard or full editor.
- Accounts, cloud sync, multi-device conflict resolution or a new backend/database.
- Rebuilding the Notes reader entirely with native text components.
- Production notifications, background generation and upload queues.
- iOS, Play production launch, subscriptions, ads or commercial analytics.
- On-device AI. It exists, but is intentionally outside this experiment.
- NativeWind adoption unless a small isolated spike proves it reduces work;
  default native UI uses StyleSheet plus a small shared token map.
- OTA updates in the first offline baseline build. Add later only with explicit
  runtime-version/channel strategy and rollback testing.

## 5. Repository layout and guardrails

Retain the web/server at their existing paths. Do not move the entire repository
into `apps/web` as a prerequisite.

```text
src/                         # existing web app, preserved
server/                      # existing API, preserved
apps/mobile/                 # Expo app, config, native adapters and screens
packages/core/               # only portable types/contracts and needed pure logic
packages/note-renderer/      # extracted React DOM reader, no native secrets/store
  src/                       # Markdown plugins, reader, diagram dependencies/assets
  # Exact renderer package boundary decided after import-graph audit
fixtures/mobile/             # synthetic, credential-free datasets and small PDFs
docs/mobile/                 # setup, device test log, size/timing measurements
```

Boundary rules:
- Core: no React/React Native, DOM globals, localStorage, Node-only APIs, or imports
  back into the web app. Add an automated dependency/global check and a dedicated
  TypeScript config without DOM globals. A grep alone is insufficient.
- Reader: may use React DOM/browser APIs internally; cannot import study-store or
  credential modules. All persistence and AI calls originate in native actions.
- Native: never import `src/App.tsx`, a web singleton, or root Vite configuration.
- Split TS/test scope: the current root tsconfig implicitly includes the whole
  repository. Explicitly separate web, core, DOM and mobile checks before adding
  native JSX and tests. Avoid Vitest accidentally collecting mobile tests.
- Keep `bun run build:render` operational. Native builds are separate and must not
  require Android SDK installation on Render.
- Recheck server bundling when workspace imports are introduced: the current
  esbuild configuration externalizes packages. Ensure shared package exports are
  executable on the deployed Node runtime or deliberately bundled; never leave
  Node trying to load uncompiled workspace TypeScript.
- No mass dependency upgrades or path-only reorganization.

Historical preparation branch: `arena/01a09569-temari`. A NEW Arena session must
use its own assigned working branch, not switch back to the historical branch.
The existing Render service was configured to auto-deploy the historical branch:
verify its current dashboard and Blueprint settings and agree on pushes before work begins. Prefer local gates followed by intentional checkpoint pushes. If desired,
temporarily disable Render auto-deploy in the dashboard; do not change production
infrastructure silently. No merge to main is part of this plan.

## 6. Milestones and acceptance gates

### M0 — Baseline and build feasibility (0.5–1 developer day)

1. Record current commit, web test/build status and a reference screenshot set.
2. Record test phone model, Android version, RAM, WebView version and free space.
3. Confirm Expo account/build method and Android package identifier, using a
   prototype-specific identifier before any store registration.
4. Check exact SDK 57 dependencies, Node/Bun requirements and native compatibility.
5. Add minimal workspace/TS boundaries; scaffold only a native hello screen.
6. Run Doctor and create an installable development build on the real phone.

Gate: web still builds, mobile installs, Android Back/safe areas work, React
resolution is clean. Stop if workspace setup requires a large unplanned web rewrite.

### M1 — Safe portable data contract (1–2 days)

Deliver a pure validator/serializer and a small web **Export for Android** action.
Use an allowlist, not a blacklist, for exported preferences.

Proposed envelope (distinct from the existing generic backup):

```json
{
  "format": "temari-portable",
  "schemaVersion": 1,
  "exportedAt": "ISO-8601 timestamp",
  "data": {
    "subjects": [],
    "notes": [],
    "quizzes": [],
    "attempts": [],
    "tasks": []
  },
  "preferences": { "theme": "system" }
}
```

- Exclude provider keys, legacy apiKey, custom URLs, tokens and transient UI state.
- Validate object shapes, supported schema version, enums, dates, score bounds,
  unique IDs, subject references and size/count limits before any writes.
- Version-1 legacy backups can be accepted through an explicit migration function:
  strip secrets, show a warning, validate all resulting records. Never trust a
  successful JSON.parse as validation.
- Import preview: show collection counts and validation errors before confirmation.
- Prototype import mode: explicit **replace this mobile library**, not merge. Keep
  a local pre-import snapshot and perform SQLite writes in one transaction.
- Re-importing the same file replaces it deterministically, never duplicates it.
- Unknown newer schemas and corrupt files must leave existing data unchanged.
- Preserve tasks/attempts even if the prototype doesn't expose editing UI for them.
- Create synthetic English/Amharic data, empty data, invalid references, duplicates,
  legacy backups with fake keys and a larger bounded dataset as fixtures.

Gate: portable export contains no credentials; validation and migration tests pass;
import/export round-trip preserves supported study data and IDs. Initial web work
is export-only: do not expand scope to redesign browser transactional persistence.
The mobile re-export is validated against the same schema; bidirectional web
restore UI is a follow-up, not implicit cloud sync.

### M2 — Reader + async action risk spike (2–3 days; early stop/go gate)

1. Extract the content renderer from NoteViewer. Keep web toolbar, printing,
   downloads, local reading-place store, modal origins and toasts in the web wrapper.
2. Share Markdown fixes and custom diagrams through the extracted module so bugs
   do not need fixing twice. Keep existing web renderer regression tests.
3. Create one full-height DOM reader inside a native screen. Native header handles
   Back; DOM body owns vertical scrolling. Tables may scroll horizontally. Do not
   put a native vertical ScrollView around the DOM document.
4. Bundle KaTeX CSS/fonts, editorial font assets and diagram code locally. Do not
   use CDN assets or load the live Render website into the reader.
5. Native bridge shape: serialized note fields plus top-level async actions such as
   `onExplain({ noteId, term, context, requestId }): Promise<void>`. No DOM nodes,
   callbacks inside nested objects, storage objects or key-bearing settings props.
6. Native action validates note ID, request length and current screen/request state.
   Show confirmation before a paid request. Results live in a native result panel.
   Cancel/ignore stale responses after navigation; prevent duplicate taps.
7. Exercise long press, selection handles, normal scrolling, links and diagram taps.

Security gate before real keys:
- Sanitize/allowlist untrusted raw note HTML before rendering. The existing web
  pipeline uses rehypeRaw without an explicit sanitization stage; don't assume an
  imported note is safe because React rendered it.
- Reject scripts/iframes/forms/event handlers and unsafe URL schemes. Generated
  diagrams render through trusted components, not arbitrary imported SVG/HTML.
- Block remote images/requests by default for the prototype; open approved HTTPS
  links externally only after user action. Restrict embedded view navigation.
- Test that fake keys never appear in reader props, generated HTML, logs or exports.

Gate: a release-like installed build reads representative notes from a cold launch
in airplane mode; no missing fonts, diagram assets or callouts; selection sends
only bounded text to a mock native action. Test large text, tables, math, nested
callouts, current malformed-note repairs and Amharic. Do not substitute Expo Go
success for this offline installed-build test.

### M3 — Native library and one complete Drill (1.5–2.5 days)

Use expo-sqlite with an async repository, not an async function disguised as the
existing synchronous StorageAdapter. For the prototype, versioned JSON collections
or records in SQLite are acceptable; do not design a large normalized schema.
Run migrations/imports in transactions and bound dataset size.

Reuse pure type/score functions; keep native state small. The native client only
writes imports and Drill attempts initially, so it need not clone the entire web
CRUD store. Extract shared attempt-completion rules from the web flow where needed.
Use collision-resistant IDs for new mobile records and preserve imported IDs.

End-to-end flow:

Web export → Android file picker → validate/preview → confirm import → select
Subject → read Note / open Quiz → flip and rate cards → finish → save Attempt →
show result and basic history → restart app → same data/result remains.

Gate: expected score matches web for the same rating sequence, including the last
card; rapid double taps don't duplicate completion/attempts. Imported subjects
remain scoped correctly. Cancellation during import doesn't wipe the old library.
Test 0%, partial and 100% scores, empty Quiz, restart and disk-write failure.

### M4 — Secure BYOK, cold-start UX and a small PDF (1–2 days)

- SecureStore stores only provider credentials. SQLite/preferences contain provider
  selection and model IDs, not keys. Handle missing/deleted keys and native storage
  errors. Verify Android backup exclusions; no assumption keys survive uninstall.
- Public API base URL is `https://temari-996r.onrender.com`. It is configuration,
  not a secret. Do not place keys in EXPO_PUBLIC variables or app configuration.
- Resolve credentials in native code immediately before the API call. Keep keys
  out of the DOM bridge. Preserve the server's hosted BYOK/custom-URL restrictions.
- Reuse provider error classification where portable. Do not assume every 401 is
  offline, or that every successful HTTP response is valid generation content.

Cold-start design:
- Launch immediately into local data; no network gate on the splash screen.
- User-initiated AI action starts a deduplicated `/api/health` readiness check.
  Optionally preflight on foreground when online and stale, never a keepalive cron.
- States: local-ready → connecting → server taking longer than usual → generating
  → success/error. Do not claim a server is asleep merely because the network is slow.
- Initial readiness budget: 90 seconds with cancellation and bounded GET retries;
  after a few seconds show a non-blocking explanation that free hosting can be slow.
  Exact budgets are provisional and will be measured on the real phone.
- AI POSTs are not silently retried: an uncertain result could duplicate charges.
  After timeout, offer explicit retry with that caveat. Cancellation can stop local
  waiting without guaranteeing the upstream provider stopped or avoided charging.
- Offline never queues paid requests automatically. Previously imported study stays
  available throughout. Preserve honest offline-draft labels if using that adapter.

PDF spike:
- Pick a small text-based PDF with DocumentPicker; copy it to readable cache if
  required by the provider URI; use the current FileSystem API, not legacy imports.
- Validate size before base64 conversion; keep the existing server's 4 MiB JSON
  budget and test conservatively with a PDF under 1 MiB.
- Extract through the existing endpoint, display text, handle cancel and clean up
  cached temporary files. Do not bundle Node's pdf-parse in the native client.

Gate: one real low-quota Gemini test and explanation succeeds; rotated/invalid key,
no network, slow readiness, 429, API 5xx and cancel are recoverable. Cold-start
measurement is done after genuine inactivity, not inferred from a warm request.

### M5 — Installed preview and decision (0.5–1 day)

Create two EAS profiles: development client for iteration and an internal preview
APK with embedded bundles, no Metro requirement and no auto-downloaded OTA update
in the baseline. No native build service credentials go in Git/chat.

Record a short device test log and compare against the mobile website:
- device/OS/WebView/build ID and commit;
- cold local startup, first note render and warm/cold server readiness;
- APK/download and installed size; JavaScript/DOM asset contribution;
- memory and scroll behaviour with a large note;
- task completion problems, Android Back, safe-area/keyboard issues;
- offline failures and any duplicate/missing records.

Initial product targets (not guarantees):
- Usable local Library within about 3 seconds on the named test phone.
- Typical imported note visible within about 2 seconds after opening.
- No horizontal page overflow except intentional tables/diagrams.
- No crashes, lost data or network access required for offline reading/Drills.
- Record APK size first; use ~80 MB as a review trigger, not a promise or an
  automatic failure. Explain large font/WebView/native-library contributions.

Deliver the APK/install instructions, portable sample file, passing automated
checks, measured test log and a go/no-go recommendation. Builds/artifacts go in
EAS or external artifact storage, not Git.

## 7. Testing and operational workflow

Required at each checkpoint:
1. Core/data validation unit tests, no browser globals.
2. Existing web tests + typecheck + production build + server smoke test.
3. Native typecheck, Expo dependency checks/Doctor and native interaction tests.
4. DOM reader fixtures tested in web rendering and on a real Android WebView.
5. Preview APK airplane-mode cold launch, import persistence and native action test.

Use a small manual device checklist initially; add one Maestro import → Drill →
result flow once stable, not a full test-infrastructure project before the reader
spike. New tests must not accidentally be collected by the web Vitest job.

The repository currently has no active GitHub Actions workflow because Arena's
GitHub connection cannot write workflows. Keep that constraint: local checks,
Render's own web build gate, and explicit EAS preview builds. The existing optional
workflow template can be enabled manually later; do not silently rely on it now.

Diagnostics: add error boundaries and a user-exportable redacted diagnostic report
with app/build ID, operation and error category, not note contents or provider keys.
Native DevTools/device logs are available; lack of browser devtools does not mean
we are blind. Add Sentry or another hosted service later if multiple testers make
local reporting inadequate, with explicit privacy/scrubbing configuration.

## 8. Distribution, costs and future features

Week-one administrative check, in parallel with M0:
- Confirm whether this is personal-device testing only or an intended Play release.
- If Play is intended soon, check account type/creation date, verification, signing
  ownership and tester availability. Plan the closed-test calendar once a useful
  build and required listing/setup exist; account creation alone starts no timer.
- Personal accounts covered by Google's policy need 12 opted-in closed testers for
  14 continuous days before applying for production access; approval isn't automatic.
- Developer verification has a regional rollout, not an immediate universal APK
  ban. Check current device/region/install-route requirements before sharing builds.
  The official page currently lists Sep 30, 2026 regional enforcement and broader
  2027 expansion, plus a limited-distribution route. Do not assume private APK
  distribution is permanently exempt or immediately blocked in Ethiopia.
- Verify EAS build queue/quota/pricing before building; do not promise unlimited
  free builds. Provider calls and Render usage also remain subject to their plans.

OTA updates, notification scheduling and Play release readiness are phase-two
choices. OTA cannot replace native rebuilds for native dependency/config changes,
and it needs runtime-version compatibility, staged channels and rollback tests.
For notifications, Android permission/battery/scheduling constraints must be tested;
"native" does not guarantee exact delivery in all device states.

## 9. Effort, checkpoints and stop rules

Budget approximately **7–12 focused developer days**, plus device feedback and
build queue delays. These are estimates, not dates or autonomous completion promises.
A reader/bundling problem may consume the risk budget; stop rather than silently
turning the prototype into a full migration.

Approval checkpoints:
- A: approve scope, phone/build access and allowed spend before M0.
- B: after M1/M2, inspect safe import + offline reader + mock bridge. Stop if reader
  integration, CSS/assets, security or touch selection is poor.
- C: after M4, test one complete native study flow and real AI request on device.
- D: after M5, decide: continue Expo, keep it as an experiment, or switch to PWA.

Continue only if offline reader fidelity, data correctness and the async bridge
pass, and the owner finds the native study flow meaningfully useful. Reject any
version that leaks keys, loses imported data, requires network to open saved notes,
or weakens web functionality just to make the prototype compile.

## 10. Inputs needed before implementation

1. Android phone model/version, and whether USB debugging is possible (useful but
   not mandatory for receiving an EAS preview APK).
2. Expo account availability and preference for EAS cloud builds versus local Android
   Studio builds. Default recommendation: EAS development/preview builds.
3. Personal-device experiment or near-term Play release? Default: personal device.
4. Approval to add a safe portable-export button to the web app and small shared
   packages. No real export/key should be pasted into chat.
5. Keep Render automatic deployment on this test branch, or pause it during package
   restructuring? Default: intentional tested pushes, no merge to main.

## References checked for this plan

- Expo SDK 57 release and patch notes: https://expo.dev/changelog/sdk-57
- Current release index (SDK 58 beta vs SDK 57 stable): https://expo.dev/changelog
- Expo DOM components, native actions, embedded exports: https://docs.expo.dev/guides/dom-components/
- Expo monorepos and Bun support: https://docs.expo.dev/guides/monorepos/
- SecureStore behaviour and Android backup: https://docs.expo.dev/versions/latest/sdk/securestore/
- Google Play testing requirements: https://support.google.com/googleplay/android-developer/answer/14151465
- Android developer verification rollout: https://developer.android.com/developer-verification

Claims not verified here (for example exact OTA download percentage savings and a
specific Router major claimed by the report) are not used to justify this plan.
Recheck version-specific package APIs and distribution policies at implementation
kickoff, especially where a documentation URL tracks "latest".

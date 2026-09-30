# M2 checkpoint A — offline DOM assets

Status: implemented 2026-09-23; **physical preview APK gate passed**
(user-reported 2026-09-24 — Samsung A32, Android 13, WebView 152.0.x; the
development client and the preview APK behaved the same; no clear anomalies
were reported).
This is the deliberately early asset experiment, not completion of M2.

## What is in this checkpoint

- One synthetic kitchen-sink Note: `fixtures/mobile/reader-kitchen-sink.json`.
  English/Amharic, headings, nested callouts, table, math, existing structured
  editorial SVG, malformed-note repairs, code, long text, hostile HTML and fake
  credential-shaped authored text. Both hosts and sanitizer tests use this file.
- Browser: development-only `/__reader-fixture`, a separate Vite HTML entry without
  the app shell, browser study store, Google Fonts link or API server dependency.
- Android: **Open reader asset spike** on hello → safe-area native Back header +
  one full-height Expo DOM component. The DOM owns vertical scrolling; only tables,
  equations and diagrams have intentional horizontal scroll regions.
- `src/reader-core/` is plain source sharing, not another workspace/package. Only
  pure diagram primitives and Markdown plugins have moved, unchanged, with old web
  import paths re-exporting them. `NoteViewer` still owns its original wrapper and
  renderer. Full content renderer extraction waits for this gate.
- Local fonts: Geist Latin, Playfair Display Latin, existing Abyssinica SIL Ethiopic,
  and KaTeX WOFF2. No extra native font or WebView dependency.
- A visible status panel reports each font load, timeout/failure and CSP violations.
  A font reporting "loaded" does **not** establish Android offline success.
- No selection action yet. Normal text selection can be probed; mock native action,
  external-link confirmation and diagram-node actions belong to checkpoint B.
- No SQLite, import UI, SecureStore, keys, study-store access, API calls or Render changes.

## Asset issue found and resolved locally

SDK 57's Metro DOM export reports **Importing local resources in CSS is not
supported yet** for CSS font URLs. Importing the web styles verbatim is not safe.
`scripts/build-reader-assets.mjs` builds deterministic CSS from the pinned font
packages and the repository's original Ethiopic WOFF2. All 24 faces are embedded
as data URLs; older WOFF/TTF fallback copies are omitted. License notices are
included. No CDN requests are necessary.

The root `postinstall` hook regenerates `src/reader-core/assets.generated.css`.
It is ignored, not committed or shipped as a separate source artifact. EAS's root
Bun install recreates it. If installation scripts were disabled, run
`bun run prepare:reader-assets` before bundling. Do not copy a generated file into Git.

Observed production Metro export: DOM JS about 1.4 MB, font/math CSS about 586 KB,
reader layout CSS about 2.2 KB (uncompressed output, **not APK size**). Font data
URLs deliberately trade some CSS size for a reliable first offline experiment.
Revisit packaging only after the phone gate, not as a speculative optimization.

## Security boundary and limits

`rehype-raw` → **rehype-sanitize with an explicit schema** → shared display repairs,
callouts/anchors → trusted KaTeX (`trust: false`) / trusted diagram React components.
Raw SVG/MathML, scripts, forms, frames, images, inline CSS, event attributes, imported
IDs and every URL attribute are stripped before trusted generated markup is added.
All links remain inert text in checkpoint A. Imported HTML cannot navigate the
embedded document. No claim of general-purpose WebView navigation interception is
made: the SDK 57 default WebView does not implement all RNC WebView props.

The general native Expo-module bridge is explicitly disabled. The reader accepts
only `title`, `content` and its host's development mode; there is no settings prop.
Fake credential-shaped **authored note text** intentionally remains visible. This
is not permission to pass settings/keys into the reader, nor a secret-redaction tool.

CSP is a second layer, not sanitization. Release blocks network connections/images,
frames, objects and forms, permitting bundled file scripts/styles, inline Expo
bootstrap/styles and data-font URLs. Development additionally permits same-origin
resources and that host's WS/WSS HMR connection. No wildcard network allowlist.

Browser CSP is in the dedicated HTML head. Expo supplies its own HTML template;
the DOM shell installs a head meta **before mounting untrusted Note content**.
Its earlier trusted bootstrap and styles are not retroactively protected by that
meta. The generated bundle is audited and has no remote resource dependencies.
Do not claim this is a document-start CSP or XSS-proof sandbox. Do not enable real
keys or remote images as a workaround for a load failure.

## Local checks performed

- Frozen root Bun install (including generated assets), web/core/mobile typechecks.
- Reader boundary check: AST import/API guard; no native/app/store/network imports.
- Node import/SSR smoke without window, document or browser storage.
- 404 tests passing, including 10 new fixture/sanitizer/CSP tests and two boundary/Node smoke tests and unchanged web
  NoteViewer/diagram regression tests.
- Web production build + compiled-server deployment smoke pass; existing CSS/chunk
  warnings remain. The fixture entry/data is not in the production web JS build.
- Offline Expo version check: dependencies aligned. Doctor's online schema check
  remains unavailable due to sandbox TLS failures; network-warning mode is not a
  claim that all online checks passed.
- Android + DOM production Metro export passes.
- Desktop Chromium at 408px: all four font checks loaded, math and diagram visible,
  no document horizontal overflow, no external page requests or hostile execution.
- The exported DOM HTML also rendered from `file://` in offline desktop Chromium
  with a **stubbed** Expo bridge and the release CSP. This narrows asset risk, but
  proves neither real native bridge behavior nor Android WebView behavior.

No APK was built in Arena: Android toolchain/device access is unavailable here.
No EAS build quota was spent by this checkpoint.

### Repeat local checks

From the repository root:

```sh
bun install --frozen-lockfile
bun run typecheck:all
bun run check:reader
NODE_ENV=test bun run test
NODE_ENV=production RENDER=true bun run build:render
bun run dev
# Open http://localhost:3000/__reader-fixture on YOUR computer.
```

For Metro's production bundle check, from `apps/mobile`:

```sh
bunx expo install --check
CI=1 bunx expo export --platform android --output-dir ../../.cache/m2-export
cd ../..
bun run check:reader:export
```

If Expo's online check fails, report that separately; `EXPO_OFFLINE=1` validates
against the installed SDK's bundled version map, not the online service.

## Phone gate — completed 2026-09-24 (user-reported)

Result, recorded from the user's report (amend if details differ): Samsung A32
running Android 13, WebView 152.0.x (abbreviated; fill in the full WebView
version and the preview artifact checksum when available). Both the development
client and the preview APK were exercised and behaved the same. The airplane-mode
offline checks passed with no clear anomalies reported. The checklist below is
retained because checkpoint B's final gate re-runs it.

The original checklist follows.

Use this branch's updated source and run the root frozen install first. The EAS
project link confirmed during M0 is now in `apps/mobile/app.json`; do not initialize
or create another project. Use the existing signing credentials.

1. From `apps/mobile`, start `bunx expo start --dev-client --lan` (or USB via
   `adb reverse tcp:8081 tcp:8081` and `--localhost`). On the installed development
   client, open **Open reader asset spike**. The previous binary should already
   include `@expo/dom-webview`; if it reports that native module missing, verify its
   build log and rebuild the development client rather than reloading repeatedly.
2. Check the four font statuses, math, table, structured diagram, callouts, Amharic,
   long scrolling, text-selection handles, safe areas and native Back. A missing font,
   blank DOM or red CSP diagnostic is a failure to investigate, not to bypass.
3. Build the first checkpoint's **preview**, not development, APK:

   ```sh
   # apps/mobile; first verify @lal-ye/temari-android-prototype
   bunx eas-cli@latest project:info
   mkdir -p ../../.cache
   bunx eas-cli@latest build --platform android --profile preview --local \
     --output ../../.cache/temari-preview.apk
   ```

   `--local` needs your own compatible Linux/macOS Android toolchain (JDK, SDK/NDK,
   build tools) and EAS authentication/signing access. It is not a prerequisite or
   automatically faster if those are missing. In that case use the same command
   **without `--local` and `--output`** for EAS cloud. Do not install Android tooling on Render.
   Prefer the EAS profile to a hand-run Gradle release task so bundling/configuration
   and credentials stay consistent. Confirm `expo-linking` and `@expo/dom-webview`
   in the native module logs. A local build may not have a cloud build ID: record
   source commit, profile, build timestamp and artifact checksum instead.
4. Install the fresh preview APK, replacing/uninstalling the development prototype
   (same application ID). Stop Metro. Turn airplane mode on **and ensure Wi-Fi is
   off**; Android can remember Wi-Fi being enabled in airplane mode. Force-stop
   Temari and launch from its icon, then open the reader again. No warm WebView.
5. Repeat the visual/selection/scroll/Back checks and record device, OS, WebView,
   build/artifact identifier and result. Optional local tools:

   ```sh
   adb shell getprop ro.product.model
   adb shell getprop ro.build.version.release
   adb shell am force-stop com.lalye.temari.prototype
   # Optional if supported by the device; otherwise use Android Settings:
   adb shell cmd connectivity airplane-mode enable
   # Restore connectivity after testing:
   adb shell cmd connectivity airplane-mode disable
   ```

   scrcpy is optional for mirroring/screenshots; it is not bundled or required.

## Checkpoint B — complete

Status, 2026-09-30: **Checkpoint B complete.** Phases 0–4 were implemented on
branch `arena/01a0d998-temari` (Phases 0–2 also on `main` via PR #27) with the
full local gate matrix green 2026-09-28 (below). The **phone checklist ran on
the physical device**: items 1–4 and 6–7 passed; item 5 failed with one bug,
fixed in `30d3039` (PR #31), and passed on re-test with a fresh APK (evidence
under § "Checkpoint B phone checklist"). Scope held throughout: no persistence,
real AI, SQLite, SecureStore, import UI or app network calls; the URL handoff is
`Linking.openURL`, not a request.

### What checkpoint B delivered

| Phase | Commits | Summary |
| --- | --- | --- |
| 1 · bridge contract | `d4ea872` | `src/reader-core/bridge.ts`: `ExplainRequest`/`OpenLinkRequest`, inclusive bounds (term 2–60, context ≤300 with the 302→300 builder clamp), fresh-object rebuilds, `isApprovedLink` as the one URL rule; action smoke over the real function-prop bridge |
| 2 · renderer extraction | `f1999ef` | `NoteContent.tsx` (one sanitized pipeline, one components map, web/reader skins), `FigureBlock`, `selection/`; `NoteViewer` a wrapper; `NoteViewer.test.tsx` byte-unchanged throughout |
| 3 · sanitizer + link policy | `f53069e` | unified pipeline `[rehypeRaw, rehypeTaskListInputs, [rehypeSanitize, readerSchema], repairs, callouts, anchors, KaTeX(trust:false, maxExpand:100, maxSize:20)]` everywhere; `FixtureMarkdown` retired; explicit `linkMode` (`disabled` default / `web` / `native-action`) with `isApprovedLink` at render time; security suite re-scoped to authored-vs-trusted chrome |
| 4 · selection + session + panel + links | `3028aa5` `e3c8707` `96f9dd6` `a8cdf7f` | pure `createExplainSessionHandler`/`createOpenLinkHandler` + shared `singleFlight` guard in `reader-core/session/` (18 web-vitest rows incl. the stuck-guard and link double-tap rows); debounced selection (300 ms settle, single-block, 2–60 chars) → fixed-bottom mock-labeled chip; native `Alert` confirm (host prominent, URL truncated) → `Linking.openURL` try/catch, never `canOpenURL`; ONE `useFocusEffect` lifecycle |

Records with the full reasoning live in
[M2-B-PHASE4-HANDOFF.md](./M2-B-PHASE4-HANDOFF.md) §8 and
[M2-B-PHASE5-HANDOFF.md](./M2-B-PHASE5-HANDOFF.md) §8.

### Verified nuances worth keeping (from the implementation records)

- hast-util-sanitize 5.0.2 shallow-merges the schema, so its default
  `required: {input: {disabled, type: 'checkbox'}}` still applies — a hostile
  `<input>` really does surface as a disabled checkbox without the
  `rehypeTaskListInputs` pre-filter (reproduced before writing it).
- `protocols: {href: ['https']}` passes `#frag`, `/path` and `//host` (a colon
  after `/?#` is not a scheme) — `isApprovedLink` is the actual rule; and the
  protocol match is case-sensitive, so authored `HTTPS://…` renders inert
  (fail-closed layering; pinned by a test).
- Intentional web deltas: note images and exotic tags (`<mark>`, `<details>`…)
  no longer render (unwrap to text); authored `id`s drop (only generated
  `sec-N`); `javascript:` schemes were already nulled by react-markdown's
  `urlTransform` — not a new change.
- The root tsconfig has no `strictNullChecks`, under which `if (!checked.ok)`
  does not narrow — the session factory uses the literal `checked.ok === false`
  form (documented in-file).
- The link handler deliberately has no focus-staleness checks (single-flight
  guard only): a confirm resolved after blur still opens the URL the user
  approved.

### Local gate matrix — green, 2026-09-28 (branch `arena/01a0d998-temari` @ `3c5b7f5`)

```text
bun install --frozen-lockfile                        1677 packages; assets.generated.css regenerated (git-ignored)
bun run typecheck:all                                exit 0 (web + packages/core + apps/mobile)
NODE_ENV=test bun run test                           466/466 (34 files; trail: 425 → 438 → 448 → 458 → 466)
NODE_ENV=production RENDER=true bun run build:render exit 0 (suite 466/466 inside; deploy smoke passed)
CI=1 bunx expo export --platform android             exit 0 (~65 s; 2.7 MB Hermes bundle, 5 files)
bun run check:reader:export                          one HTML doc; DOM assets in Android metadata; 24 valid embedded WOFF2; no @import
```

Sandbox limitation, recorded: `bunx expo install --check` requires Expo's
servers, which the Arena sandbox blocks (TLS failure). The equivalent drift
check was performed locally against `expo/bundledNativeModules.json`: **12
SDK-managed dependencies compared, 0 drift** (expo 57.0.24, react-native
0.86.3, expo-router ~57.0.22). No EAS quota was spent inside Arena; the APK
build happens on the developer's side.

### Checkpoint B phone checklist

Preview APK (existing EAS project and credentials; see the checkpoint A
instructions above), airplane mode **and Wi-Fi off**, cold launch, no Metro.
Record device, OS, WebView version, build/artifact id.

1. Complete kitchen-sink: math, table, structured figure + `Fig. N`, nested
   callouts, repairs, Amharic, long scroll, fonts, CSP panel quiet.
2. Selection (native handles) → fixed-bottom mock-labeled chip → run → native
   bottom-card result (term + requestId); **panel open/close preserves scroll
   position**. With the Phase-1 smoke button retired, items 2–6 are the real
   function-prop marshaling proof over Android WebView.
3. Rapid double-tap on the chip → exactly **one** mock invocation; rapid
   double-tap on a link action → exactly **one** Alert (never stacked).
4. **Close while pending** and **Back while pending** → no panel, no crash,
   late completion dropped — and a fresh submission afterwards works (the
   `MOCK · RUNNING` row makes "while pending" observable).
5. Diagram node tap → the same mock flow with the node label.
6. HTTPS link → native `Alert` shows the parsed host prominently with the full
   URL truncated → confirm hands it to the OS outside Temari (in airplane mode
   the handoff attempt is success; a no-handler error row is also honest);
   cancel stays in place; `//host`, relative, fragment, non-HTTPS stay inert;
   imported HTML cannot move the WebView.
7. Re-run checkpoint A's checks (fonts, Back, selection handles, scrolling).

Result: **pass, 2026-09-30** — one bug found and fixed on the way.

Device: Samsung A32, Android 13, WebView 152.0.x (the checkpoint-A device).
Artifacts: pre-fix preview APK from `android-preview` run `36471390779`
(head `d51a8c6`, built 2026-09-28); re-test on run `36698491237` (head
`8af13b4`, built 2026-09-30). Airplane mode and Wi-Fi off, cold launch, no
Metro.

- Items 1–4, 6, 7: **pass on the first run** (pre-fix APK).
- Item 5 (diagram node tap) initially **failed**: the mock chip appeared, then
  auto-dismissed ~300 ms later without user action, unlike text selections.
  Root cause, in `NoteReader.tsx`'s selection funnel: every
  selectionchange/touchend/mouseup arms the 300 ms settle timer, and at settle
  a null `deriveCandidate` result cleared the chip unconditionally. A diagram
  node tap fires touchend *before* click, so the settle following the tap
  found no text selection and wiped the tap candidate; text chips survived
  because their live selection re-derives. jsdom never saw it —
  `fireEvent.click` emits no touchend/mouseup/selectionchange.
  Fix `30d3039` (PR #31): candidates carry a source (`selection` | `tap`); a
  null settle now clears only selection chips. +3 regression tests, one
  reproducing the device event order (466 → 469). Re-tested on the fresh APK:
  item 5 **passes** — the chip persists until Run / Not now. Re-test scope was
  item 5 only; the fix touches only the reader shell, so items 1–4 and 6–7
  are unaffected.

Post-fix gate matrix — green, 2026-09-30 (`main` @ `8af13b4`):

```text
bun run check:reader                                   19 source modules clean
NODE_ENV=test bun run test                             469/469 (34 files; trail: 425 → 438 → 448 → 458 → 466 → 469)
bun run typecheck:all                                  exit 0 (web + packages/core + apps/mobile)
NODE_ENV=production RENDER=true bun run build:render   exit 0 (suite 469/469 inside; deploy smoke passed)
CI=1 bunx expo export --platform android               exit 0 (3.2 MB Hermes bundle)
bun run check:reader:export                            one HTML doc; DOM assets in Android metadata; 24 valid embedded WOFF2; no @import
```

Flake note, same PR as this record: the boundary SSR smoke shells out to
`node --import tsx scripts/smoke-reader.mjs` (~3 s standalone) and twice
exceeded vitest's 5 s default timeout under the full 34-worker suite (7.2 s
and 10.1 s, both against `build:render`; standalone runs always pass). The
sync `execFileSync` also blocks its worker, so the timeout fires late. That
one test's timeout is now 30 s; the smoke itself is unchanged.

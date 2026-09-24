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

## Checkpoint B — planned

A passed on the phone on 2026-09-24, so checkpoint B is unblocked. Scope is
unchanged: extract the rest of the content renderer into the same source folder,
preserving web behavior/regression tests; reuse the browser fixture as the fast
feedback loop; add a top-level async mock Explain action (bounded selection +
note/request ID, no credentials or DOM nodes; native result panel; request ID +
mounted-state guard and duplicate-tap prevention); approved HTTPS link handling
only through an explicit native action; final M2 preview gate over the complete
renderer and the real DOM/native mock bridge. Do not add persistence or real AI
at this checkpoint. The reviewed implementation plan is
[M2-CHECKPOINT-B-PLAN.md](./M2-CHECKPOINT-B-PLAN.md).

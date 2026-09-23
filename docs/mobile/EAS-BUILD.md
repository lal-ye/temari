# Running EAS builds for the Android prototype

Status: prepared 2026-09-21. EAS CLI is authenticated in this environment
(`bunx eas-cli whoami` lists accounts `lal-ye` and `lalye_s`). No EAS project
exists yet and no build has run.

## Prerequisite repairs completed before the first build

The working tree had accidental damage from installs run in the wrong
directories: `apps/mobile` `expo` had been downgraded to `^46.0.21` (SDK 46),
`netlify-cli` was added to the mobile app, root gained an unused
`expo-router@5.1.11` and the `bun` package, root `netlify-cli` was downgraded,
root `unified` was removed, and a gitignored `package-lock.json` appeared.
Restored the three affected files to the committed `2dbaefe` content, deleted
the stray `package-lock.json`, removed the stale `apps/mobile/node_modules`,
and re-ran `bun install --frozen-lockfile`. Then, with `bun.lock` containing a
single `expo@57.0.24`:

- `apps/mobile/app.json`: removed `newArchEnabled` — the property is no longer
  valid in the SDK 57 config schema; New Architecture is the SDK default.
- `apps/mobile/package.json`: `react-native-safe-area-context` `~5.6.2` →
  `~5.7.0` (SDK 57 bundled version) via `bunx expo install`.
- `apps/mobile/eas.json`: added `cli.appVersionSource: "remote"` and the
  `preview` profile (internal APK with an embedded JS bundle, no Metro).

Verified after the repairs: web/core/mobile typechecks pass, `expo-doctor`
reports 20/20 checks passed, and `CI=1 bunx expo export --platform android`
produces a 2.7 MB Hermes bundle.

## Steps to run a build

Run every EAS command from `apps/mobile` so the CLI picks up the correct
project directory.

1. **Choose the Expo account.** Two are logged in (`lal-ye`, `lalye_s`). Confirm
   the intended owner before creating the project; verify afterwards via the
   project URL that `eas init` prints. If it lands under the wrong owner, remove
   it in the expo.dev dashboard and re-run `init`.
2. **Link the EAS project (once):**
   ```sh
   cd apps/mobile
   bunx eas-cli init
   ```
   This creates the EAS project and writes `extra.eas.projectId` into
   `app.json`. Commit that change.
3. **Check queue/quota first.** Free-tier builds are limited; review the
   billing/limits page for the chosen account before spending slots
   (plan §8 requires this check).
4. **Development client build (M0 gate):**
   ```sh
   bunx eas-cli build --platform android --profile development
   ```
   The first build generates an Android keystore on EAS servers; keep it there
   and never export, commit, or paste it. Internal distribution, APK output.
5. **Collect the artifact:** the CLI prints a build page URL; `bunx eas-cli
   build:list --platform android --limit 1` also works. Free-tier queueing can
   take a while.
6. **Install on the Samsung A325F:**
   - With USB debugging: `bunx eas-cli build:run --platform android --profile development`.
   - Without: open the build page on the phone, download the APK, allow
     install-unknown-apps for the browser, install.
7. **Run against Metro:** `bunx expo start --dev-client` from `apps/mobile`
   (phone and dev machine on one network; add `--tunnel` otherwise). The dev
   APK is a native shell — it does not run without Metro.
8. **Offline installed-build gate (M5):** `bunx eas-cli build --platform
   android --profile preview` produces the Metro-free APK used for airplane
   mode, cold-start and size measurements.

## Guardrails

- EAS detects the Bun workspace through the root `bun.lock` and installs at the
  repo root on the build server; `.nvmrc` (22.22.3) selects the cloud Node
  version, matching the root `engines` range.
- Uploads contain git-tracked files only. `apps/mobile/android`, `ios` and
  `.expo` stay uncommitted, so EAS runs CNG prebuild server-side.
- Build artifacts stay in EAS or external storage; never commit APKs.
- Never record Expo access tokens, keystores, or provider keys in chat, logs,
  or fixtures.

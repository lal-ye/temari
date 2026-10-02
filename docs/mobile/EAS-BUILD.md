# EAS builds for the Android prototype

Updated 2026-10-02: APK builds are dispatched by the `Android APK` workflow
(see [CI builds](#ci-builds)). A fresh development APK has built and run on the
user's phone;
see [M0 device record](./M0-SETUP.md). Authentication is local to each computer —
this document does not imply the current sandbox is signed into Expo.

## Project identity (verify before every build)

Run every EAS/Expo command from **`apps/mobile`**, not the web repository root
whose package is named `react-example`.

- Owner/slug: `@lal-ye/temari-android-prototype`
- EAS project ID: `d714fc77-cb03-4a67-8899-2620e52b5b63`
- Android application ID: `com.lalye.temari.prototype`

The user confirmed this existing project during the M0 repair. Its ID/owner are now
recorded in `app.json`. Do not create a second project. Project IDs are identifiers,
not secrets; never place access tokens or signing credentials in source or chat.

```sh
# Root, Node 22.22.3 / Bun 1.3.9:
bun install --frozen-lockfile
bun run typecheck:all
bun run check:reader

cd apps/mobile
bunx expo install --check
bunx expo-modules-autolinking resolve --platform android
bunx eas-cli@latest whoami
bunx eas-cli@latest project:info
```

If not authenticated, use `bunx eas-cli@latest login --browser`. Verify the project
name and ID above, not a `react-example` project. Only when repairing a missing
link, use `bunx eas-cli@latest init --id d714fc77-cb03-4a67-8899-2620e52b5b63`.
Review `git diff -- app.json eas.json package.json`. Never blindly force a new link.

## Profiles

- `development`: internal APK with dev client. Needs Metro for the local JS app.
- `preview`: internal release-like APK with embedded bundles. No Metro required.
- Both use the **same Android application ID**; they do not install side by side.
- `cli.appVersionSource` is remote. The local `android.versionCode` warning is
  informational; it does not explain missing native modules or Metro connectivity.

```sh
# Development binary, when native dependencies change:
bunx eas-cli@latest build --platform android --profile development

# Offline gate:
bunx eas-cli@latest build --platform android --profile preview
```

Use `--clear-cache` for a suspected stale native build (as in the ExpoLinking repair),
not as a substitute for checking source/project identity. Check quota before cloud
builds. Local preview is optional: append `--local` only if your computer already
has the compatible Android toolchain. Let EAS manage signing; reuse the correct
project's credential and never export/paste the keystore.

In the Gradle **Using expo modules** section confirm `expo-linking` at SDK 57's
compatible version. The M2 reader also needs `@expo/dom-webview` (included by Expo
SDK 57). Gradle success alone does not establish module inclusion or runtime success.

## CI builds

The commands in [Profiles](#profiles) and [Install and launch](#install-and-launch)
are the manual path. Routine builds go through GitHub Actions instead, and both
paths use `--local`, so neither one touches the EAS build queue or EAS compute
quota — EAS is contacted only for the project existence check and managed signing
credentials. This repository is public, so GitHub-hosted runner minutes are free.

Two workflows:

- `.github/workflows/_android-apk.yml` — reusable builder. Takes a `profile`
  (from `apps/mobile/eas.json`) and an `artifact` name; receives `EXPO_TOKEN` as
  a declared secret. Every step that affects the compiled binary lives here, so
  the NDK pin has exactly one home instead of one per profile.
- `.github/workflows/android-apk.yml` — dispatcher. Runs on push to `main` and on
  `workflow_dispatch`.

What each merge builds:

| Change on `main` | `temari-preview-apk` | `temari-dev-apk` |
|---|---|---|
| `bun.lock`, `apps/mobile/package.json`, `app.json`, `eas.json`, or either workflow file | build | build |
| JS only (`apps/mobile/**`, `packages/**`) | build | skipped |
| Docs only | build | skipped |

The gate is `github.event.before..github.sha`, not `HEAD^..HEAD`: a push can carry
several commits, and the one-commit diff misses every earlier one. In the
retirement-era pushes the native change (`bun.lock`, `package.json`) sat in an
earlier commit of the same push, so the short form would have shipped a stale
development APK. If the base cannot be resolved the classifier fails safe to
`native=true`. Every run writes what it decided and why to the job summary, and a
skipped job reports as skipped rather than leaving a required check pending.

Force a build from Actions → *Android APK* → Run workflow, choosing `preview`,
`development` or `both`. Artifacts are retained 14 days:

```sh
gh run download <run-id> -n temari-preview-apk -D /tmp/temari-preview
adb install -r /tmp/temari-preview/temari-preview-apk.apk
```

APK workflows stay off `pull_request`: GitHub withholds repository secrets from
forked PR runs, so an APK build there would have no credentials.

## Install and launch

Download from the correct build page and verify its profile/build ID/timestamp.
Uninstall stale prototype binaries before testing. On a physical phone, use the
APK download or `adb install /path/to/new.apk`; do not confuse emulator install
commands with physical-device testing.

Development, same Wi-Fi:

```sh
bunx expo start --dev-client --lan
```

Or USB:

```sh
adb devices
adb reverse tcp:8081 tcp:8081
bunx expo start --dev-client --localhost
```

Use the **Metro terminal's QR code**, not the APK download QR, to connect the
installed development client. Keep Metro running. Preview launches from its app
icon with Metro off; the [M2 checkpoint](./M2-READER-SPIKE.md) describes its cold
launch/airplane-mode test.

## Build inputs and guardrails

- One root `bun.lock`; install from root, never independently inside a workspace.
- Root postinstall regenerates the ignored reader font/math asset CSS from pinned
  packages. If scripts were skipped, run `bun run prepare:reader-assets` explicitly.
- EAS archives honor ignore rules and can include uncommitted, non-ignored changes;
  do not assume only committed/tracked files are uploaded. Review the working tree.
- Generated native directories, `.expo`, exports and APKs stay out of Git. Keep CNG
  configuration in source; do not use stale local native prebuilds for cloud builds.

# EAS builds for the Android prototype

Updated 2026-09-23. A fresh development APK has built and run on the user's phone;
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
- No Render service, branch, credentials or hosting plan changes are needed.

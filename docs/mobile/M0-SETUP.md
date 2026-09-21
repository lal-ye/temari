# Android prototype M0 setup

Status: scaffolded on 2026-09-21; physical installation is still pending.

## Baseline

- Repository commit: `2a53f0bb2ff338264b01d9597fa1f9b4ccb845ae` (PR #24 merge).
- Working branch: `arena/01a0c36b-temari`.
- Web app remains at its existing paths and deployment configuration.
- Render service branch: `arena/01a09569-temari`; no Render promotion was made.
- Reference screenshots: [`docs/screenshots/`](../screenshots/).

## Test device

- Model: not verified in this session
- Android: not verified in this session
- RAM: not verified in this session
- WebView: not verified in this session
- Free storage: not recorded yet
- USB debugging: not recorded yet

Populate this section only after an installable APK has been checked on the real
phone. Do not record Expo access tokens, provider keys, or other credentials in
this file.

## Native baseline

- Expo SDK target: 57, with SDK-compatible resolved dependencies in `apps/mobile`.
- Application ID: `com.lalye.temari.prototype` (prototype-only; not a Play registration).
- Build profile: EAS `development`, internal Android APK.
- Expo SDK 57 resolved native dependencies are recorded in `bun.lock`; the root web
  React runtime is pinned to the SDK-compatible `19.2.3` so the web and native
  workspaces do not select different React releases.
- `expo-constants`, `expo-linking`, and `expo-system-ui` are direct mobile
  dependencies required by Expo Router/configuration; the app still has no native
  persistence, reader, API, or credential bridge.
- Generated `android/` and `ios/` directories are intentionally not committed.

## Local checks

Run from the repository root after Bun 1.3.9 is available:

```sh
bun install --frozen-lockfile
bun run typecheck
bun run typecheck:core
bun run typecheck:mobile
NODE_ENV=test bun run test
NODE_ENV=production RENDER=true bun run build:render
```

Run Expo Doctor and dependency alignment from `apps/mobile` before the first build.
The sandbox could not reach Expo's network checks because its TLS connection was
interrupted. The local Doctor checks can be run without treating those network
errors as failures with:

```sh
cd apps/mobile
EXPO_DOCTOR_ENABLE_DIRECTORY_CHECK=false \
EXPO_DOCTOR_WARN_ON_NETWORK_ERRORS=1 bunx expo-doctor
```

That command removes the network-only failures; the remaining local Doctor
warning is Expo's workspace duplicate scan for the same React `19.2.3` installed
at the web root and mobile workspace. This is a Bun workspace layout warning, not
a second React version; the Android Metro export and prebuild both resolve
successfully. Re-run plain Doctor when Expo's API is reachable and investigate any
non-network change.

The Android bundle smoke check is:

```sh
cd apps/mobile
CI=1 bunx expo export --platform android --output-dir /tmp/temari-mobile-export
CI=1 bunx expo prebuild --platform android --no-install --clean
rm -rf android ios
```

Authenticate with Expo through the local environment only. Never paste an Expo
robot token into chat, source files, `.env` files, fixtures, or logs.

## Device gate

1. Build the development APK with the EAS `development` profile.
2. Install it on the Samsung A325F.
3. Confirm the hello screen respects the safe area.
4. Open **Device check** and verify both the in-app and Android system Back actions.
5. Record the build ID, install result, free-space measurement, USB-debugging result,
   and any startup/navigation issue here without recording credentials.

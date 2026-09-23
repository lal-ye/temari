# Android prototype M0 setup

Status (2026-09-23): physical startup/navigation gate passed, user-reported.
The user confirmed a fresh development APK built successfully, `expo-linking`
was present in its EAS module list, and hello → Device check → Android Back and
in-app Back all work. Screenshots show no obvious content clipping/overlap.
The device/build metadata and one development reload still need explicit reporting;
a standalone offline result has not been claimed.

## Device run reported on 2026-09-23

- EAS project: `@lal-ye/temari-android-prototype`.
- Project ID: `d714fc77-cb03-4a67-8899-2620e52b5b63` (not a build ID or secret).
- Profile: `development` / Android internal APK.
- Build ID and exact source commit: not provided yet.
- Exact installation date: not provided; successful installation reported on 2026-09-23.
- Hello and Device check: pass, user-reported; previous red startup errors no longer reported.
- Safe areas: no visible text/button clipping in the supplied screenshots; status/
  navigation-bar boundary confirmation remains a user observation, not an automated result.
- Android system Back: pass, user-reported.
- In-app **Back to hello**: pass, user-reported.
- LAN / USB / tunnel: not provided yet.
- Development reload: not explicitly reported yet.
- Preview / airplane-mode cold launch: not tested in this record (M2 asset gate).
- Evidence: user-supplied hello and Device check screenshots in the session chat.
  The attachment files were unavailable in this checkout when recording the result;
  no repository screenshot paths or automated device results are claimed.

On the computer attached to the phone, collect non-sensitive device facts with:

```sh
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
```

Copy the build ID from the successful EAS build page. Do not substitute the EAS
project ID above. No physical device is attached to the Arena sandbox; unknown
fields below must not be inferred from screenshots or the earlier suggested model.

## Original scaffold baseline

- Repository commit: `2a53f0bb2ff338264b01d9597fa1f9b4ccb845ae` (PR #24 merge).
- Working branch: `arena/01a0c36b-temari`.
- Web app remains at its existing paths and deployment configuration.
- Render service branch: `arena/01a09569-temari`; no Render promotion was made.
- Reference screenshots: [`docs/screenshots/`](../screenshots/).

## Test device metadata (still awaiting confirmation)

- Model: not verified in this session
- Android: not verified in this session
- RAM: not verified in this session
- WebView: not verified in this session
- Free storage: not recorded yet
- USB debugging: not recorded yet

Populate the remaining fields from the actual phone used for the successful run.
Do not record Expo access tokens, provider keys, or other credentials in this file.

## Native baseline at the M0 device test (before the M2 source spike)

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

During the original scaffold checks, Doctor also reported a workspace duplicate
scan for the same React `19.2.3` at the root and mobile workspace, not a second
React version. Do not treat historical warnings as current results. Re-run plain
Doctor when Expo's API is reachable; current M2 checks and network limitations
are recorded in [M2-READER-SPIKE.md](./M2-READER-SPIKE.md).

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

1. Build the development APK with the EAS `development` profile
   (exact commands and prerequisites: [`EAS-BUILD.md`](./EAS-BUILD.md)).
2. Install it on the physical target phone and record its actual model.
3. Confirm the hello screen respects the safe area.
4. Open **Device check** and verify both the in-app and Android system Back actions.
5. Record the build ID, install result, free-space measurement, USB-debugging result,
   and any startup/navigation issue here without recording credentials.

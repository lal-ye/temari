# ADR-0016: Continue Expo after the M5 device gate

- Status: Accepted
- Date: 2026-10-21
- Amends: [ADR-0014](./0014-expo-web-and-android.md) and [ADR-0015](./0015-local-first-byok-and-web-parity.md) (scope only)
- Closes: checkpoint D in the [Android prototype plan](../ANDROID-PROTOTYPE-PLAN.md) §9

## Context

M5 asked for an installed preview and a decision: continue Expo, keep it as an
experiment, or switch to a PWA. The preview is installed on the baseline device
(Samsung A32, Android 13) at `main@e1f7e41`, and the study loop is verified
there:

- import from the system **Download** folder, after replacing the unreadable
  `expo-file-system` paths with a local read module (PRs #52–#58);
- export → replace-import round trip, with an invalid file rejected by field
  path and the library left untouched;
- Drill persistence: three Attempts recorded, `timesPracticed: 3`,
  `lastScore: 100`, all present in the exported file;
- reader typography including Amharic (Ge'ez) and a legacy pre-JSON figure;
- BYOK key save/rotate state, a PDF read from Download with provider consent,
  and a redacted diagnostics export.

Four acceptance details are still unrecorded — kill/relaunch durability, offline
cold launch, cancel paths, and the PDF extraction outcome — and latency figures
are outstanding. None of them is an architectural question; each is a device
check against code that already exists.

## Decision

1. **Continue Expo.** The prototype becomes the baseline for the product track.
   It is not restarted as a PWA, and the standalone web app stays retired under
   ADR-0014.
2. The device acceptance record stays open until those four checks are written
   into [`PORT-COMPLETION.md`](../mobile/PORT-COMPLETION.md). This decision
   means "continue development"; it does not mean acceptance is complete.
3. Phase two is scoped by [`PHASE-TWO-PLAN.md`](../mobile/PHASE-TWO-PLAN.md).
   Its first slice is the share-to-Temari entry point; PDF hardening,
   distribution readiness, OTA and optional notifications follow in that order.
4. **Play release is not implied.** Distribution intent remains the owner's
   decision (plan §8), including the 12-tester / 14-day closed-test requirement
   for personal accounts.

## Consequences

- Native build cycles remain the expensive step: there is no Android SDK on the
  development machine, so every Kotlin or manifest change costs a CI build. Keep
  native edits minimal and adopt published-module templates verbatim.
- The custom `TemariFileRead` module is load-bearing until the upstream
  `expo-file-system` File API reads `content://` URIs reliably. Retirement
  criterion: SDK ≥ 58 plus device evidence that the File API reads both a
  downloads-provider URI and a media-provider URI.
- ADR-0015's local-first constraints still bind: no server, no network at
  startup, atomic library replacement, credentials only in SecureStore.
- Feature growth (Exams, Planner, editing, full analytics, other native
  Providers, cloud sync) stays out until the phase-two slices ship.

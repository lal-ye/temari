# Phase two — from verified prototype to a releasable app

> Status: **open**, written 2026-10-21 after checkpoint D.
> Basis: [ADR-0016](../adr/0016-continue-expo-after-m5.md) (continue Expo) and the
> device evidence in [`PORT-COMPLETION.md`](./PORT-COMPLETION.md).
> This plan scopes the work that follows the prototype. It does not re-open
> decisions settled in ADR-0014, ADR-0015 or ADR-0016.

## 1. What is already true

Verified on the baseline device (Samsung A32, Android 13) at `main@e1f7e41`:
import from Download, export → replace-import, invalid-file rejection, Drill
persistence with three recorded Attempts, reader typography (English and
Amharic), legacy figure fallback, BYOK save/rotate state, a PDF read with
provider consent, and a redacted diagnostics export.

Automated: 202 package tests, 29 app adapter tests (including the native SQLite
contract), typechecks, import-boundary guard, web/browser gate, Android and web
exports. A signed preview APK cannot be produced from a commit whose gates fail.

Still unrecorded, and therefore still open: kill/relaunch durability, offline
cold launch, cancel paths, the PDF extraction outcome, and latency figures.

## 2. Guardrails (unchanged, not negotiable in this plan)

```text
local-first          no server, no account, no network at startup
atomic data          library replacement is all-or-nothing; imports never merge
credential boundary  keys only in SecureStore; never in storage, logs or exports
offline promise      saved Notes and Drills open with no network
one app              Expo app for Android and web; no second client
gates                every slice ships through CI + a preview build
```

Anything that would weaken these to ship faster is out of scope by definition.

## 3. Workstreams

Ordered. Each is independently shippable; none blocks on a later one.

### P0 — Close the acceptance record (no code)

Record the four outstanding device checks and the latency figures in
`PORT-COMPLETION.md`, then tick the boxes they belong to.

**Done when:** each box in that document is either ticked with dated evidence or
explicitly deferred with a reason.

### P1 — Share-to-Temari entry point (small)

Today the only way in is the in-app picker. `ACTION_SEND` / `ACTION_VIEW` for
`application/json` in `app.json` gives a second entry point that bypasses the
picker entirely — the last structural dependency on Samsung's file handler.

Acceptance:
- Sharing a `.json` from My Files or a browser offers Temari;
- it lands on the existing import preview, with the same atomic-replace
  confirmation and the same validation messages;
- a shared file that is not a Temari export is rejected with the existing
  field-level message, and the library is untouched;
- cold start via share works (intent handled after the library loads);
- no second copy of the import logic: the intent handler feeds `pickStudyFile`'s
  equivalent read path.

### P2 — PDF path hardening (medium)

The PDF path is the least exercised. Decide between continued Gemini
transcription and a local text extractor; either way the failure taxonomy and
the consent copy must be as precise as the import path's.

Acceptance:
- a text-based PDF up to the 1 MiB cap transcribes, and the result is editable
  before it becomes Material;
- an oversized, scanned or non-PDF file fails with a message that names the
  class and the remedy;
- cancelling mid-extraction leaves no Material and no partial state;
- the consent screen names the provider, the cost risk and the fact that
  transcription is not lossless.

### P3 — Distribution readiness (medium; owner decisions)

Internal testing track, signing continuity and a versionCode policy. The
current preview APK is fine for one device; it is not a distribution answer.

Owner decisions required before this slice starts:
1. Personal-device use only, or a Play release?
2. If Play: personal or organisation account, and are 12 closed testers
   available for the 14-day requirement?
3. Is the current EAS-managed keystore the permanent signing identity?

Acceptance:
- an internal-track install upgrades over the existing app and keeps the
  library and credentials;
- certificate SHA-256 matches the recorded anchor, or a migration is documented;
- versionCode increments per build and is visible in diagnostics.

### P4 — OTA updates (medium; depends on P3)

EAS Update with a pinned runtime version and a staged channel. OTA is a
convenience, never a way to skip a native rebuild.

Acceptance:
- a JS-only change reaches an installed build without reinstalling;
- a native dependency or config change forces a new build instead of a broken
  update;
- a bad update can be rolled back, and offline launch is unaffected either way.

### P5 — Notifications (optional, last)

Only if the product needs reminders. Android permission, battery optimisation
and scheduling behaviour must be tested in doze and after reboot; "native" does
not guarantee delivery.

## 4. Deliberately not in this plan

Exams, Planner, editing, full analytics, additional native Providers, cloud
sync, accounts, and any server component. Each needs its own plan and its own
decision; none is a prerequisite for P0–P5.

## 5. Sequencing

```text
P0  acceptance record        parallel with P1, needs only the phone
P1  share-to-Temari          first code slice (smallest, closes a flagged gap)
P2  PDF hardening            after P1 merges
P3  distribution readiness   after the owner answers the three questions
P4  OTA                      after P3
P5  notifications            only if needed
```

Sizes are relative effort, not dates. Native changes cost a CI build cycle each
because this machine has no Android SDK; prefer one well-tested native change
over several small ones.

## 6. Risks

- **Picker/provider regressions.** The custom read module is the reason imports
  work; a future picker or module change can break it. It fails loudly with a
  staged message, and P1 removes the picker from the critical path.
- **Trust surface.** Every new entry point (share intent, OTA, notifications) is
  a new way in. Each slice must state what it can read and what it stores.
- **Single-device evidence.** One phone is not a device matrix. If distribution
  grows beyond the owner's device, P3 must add at least one more form factor.

# Android + Expo web completion record

Updated 2026-10-14. This records **implementation and automated evidence**, not a
physical-device sign-off. Scope is the included features in Android plan §4,
not its explicitly excluded full Exam/Planner/analytics/editor products.

## Implementation matrix

| Requirement | Implementation / evidence |
|---|---|
| M0/M1/M2 baseline | Existing Expo app, portable validator, shared sanitized reader retained |
| M3 Library + scoped Notes/Quizzes/history | SQLite on Android; real IndexedDB on web; offline local startup |
| Import preview/confirm/cancel/failure | Same pure validator + migration; 4 MiB bound before read; no write until confirm; synthetic sample entry |
| Restart and atomic persistence | SQLite transaction; IndexedDB transaction + stale-tab rejection; failed startup surfaces an error, never a fake empty library |
| Drill score, last card, rapid completion | Existing tested machine; one write path; idempotent Attempt retries; ID collisions rejected |
| Re-export | Native share sheet / web download; all collections and imported theme preserved; current Attempts included; credentials omitted |
| M4 BYOK settings | SecureStore on Android; memory-only browser key; save/rotate/delete; persisted non-secret model |
| Connection / Explain | Metadata GET readiness; confirmed single POST; bounded retries only for GET; slow, cancellation and recoverable error states |
| PDF | Picker → bounded local read → explicit paid disclosure → Gemini transcription → editable Material → text export |
| Diagnostics | Root render boundary and allowlisted diagnostic export (operation/category/build only) |
| Web functionality | Real persistence/import/export/Drill/Explain/PDF; isolated reader CSP; optional offline static-shell cache |
| M5 distribution | Development and embedded preview profiles; updates disabled; gated signed-APK workflow with checksum + build metadata |

**Architecture adjustment:** [ADR-0015](../adr/0015-local-first-byok-and-web-parity.md)
replaces the old Render readiness and PDF endpoint, which ADR-0014 deleted.
There is no server keepalive, paid automatic retry, background upload or queued AI.

## Automated verification

Run from the root, Node 22.22.3 / Bun 1.3.9:

```sh
bun install --frozen-lockfile
bun run check:reader
NODE_ENV=test bun run test
bun run test:adapters
bun run typecheck:all
bun run check:mobile:imports
bun run check:mobile
bun run check:web
bunx playwright install --with-deps chromium
bun run test:web
```

Recorded locally: 200 package tests, 14 app adapter tests, four Chromium end-to-end
flows; typechecks, boundary checks, Android Hermes/DOM export and web export pass.
Browser tests exercise offline reload + reader + Drill, restart, credential-free
export, invalid/cancelled imports, memory-only keys, actual iframe Explain bridge
with a mocked Provider, explicit PDF send and redacted diagnostics. They do not
contact paid AI. Android export verifies all 24 embedded font faces.

In a network-restricted sandbox Chromium was supplied via an npm-distributed binary
and its bundled shared libraries; CI uses Playwright's supported browser installer.
Expo's offline dependency alignment check passed; online Doctor/network-directory
checks and real provider requests require unrestricted network access.

`tests/android/import-drill.yaml` is the focused Maestro smoke flow. **It clears
app data**; use only a disposable test installation, never the learner's library:

```sh
maestro test tests/android/import-drill.yaml
```

This flow has not been executed on a physical device in this session.

## Owner/device acceptance still required

Use the existing Samsung A32 / Android 13 baseline, record actual OS/WebView and
artifact commit rather than copying old evidence. Export the old library first;
install the preview APK over the existing app with the same signing identity.
Do **not** uninstall as a routine upgrade: uninstall deletes data and keys.

- [ ] Record artifact URL, SHA-256, commit, versionCode, download/installed size.
- [ ] Force-stop, airplane mode, Wi-Fi off: cold Library, two Subjects, Note
      fonts/math/Amharic/figures, long Note scroll and Back/safe areas.
- [ ] Samsung picker: JSON cancel, invalid/legacy file, successful replace;
      kill/relaunch; full Drill with final-card rating and 0/partial/100% scores.
- [ ] Export/share to Files, replace-import that file, verify new Attempts/tasks.
- [ ] Save key, force-stop/relaunch, test saved model, rotate invalid key, delete
      key; saved study remains usable. Confirm backup/uninstall expectations.
- [ ] One owner-approved low-quota real Gemini Explain; decline and cancel;
      airplane mode/429/5xx recoveries; no duplicate requests or stale panels.
- [ ] `fixtures/mobile/material-small.pdf` through Samsung picker, confirm sending,
      review text, cancel, re-pick and export; no residual app-owned temp copies.
- [ ] Record local startup / Note display / actual connection latency and large-Note
      memory/scroll observations. No fabricated timing or go/no-go decision.

Automatic checks cover injected storage/network/malformed-response failures, but
cannot establish low-end-device performance, actual provider quota or signing
continuity. Final M5 go/no-go remains the owner's decision after this checklist.

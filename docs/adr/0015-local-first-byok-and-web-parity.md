# ADR-0015: Local-first BYOK and browser parity after server retirement

- Status: Implemented on the Android completion branch; physical-device acceptance pending
- Date: 2026-10-14
- Amends: ADR-0014 and the historical M4 transport/PDF assumptions in the Android plan

## Context

The Android plan originally assumed a live Render health/AI/PDF API. ADR-0014
retired that API and its deployment, leaving one Expo app. The M3 Library also
explicitly disabled browser storage. Calling relative `/api/ai/*` paths from that
app would not work, and restoring a server silently would reverse ADR-0014.

## Decision

1. Keep one Expo app, without a new server, account or hosted key. Complete the
   prototype's **Gemini-only** BYOK surface directly over HTTPS. Provider endpoint
   and default model remain in the shared catalog. The old seven-provider port
   remains reusable core code, not a claim that seven native providers shipped.
2. Android credentials live only in `expo-secure-store` with its backup-exclusion
   config plugin. Non-secret model preference lives in a separate SQLite database.
   Browser credentials live only in module memory and disappear on reload. Never
   use public build variables, persistent browser storage or reader props for keys.
3. No network startup gate. A user-initiated action checks the selected model's
   metadata with a GET; at most three readiness attempts, within a 90-second total
   action budget, slow messaging after five seconds, cancellable throughout.
   Concurrent AI actions are rejected while one is active, not charged twice.
   This replaces Render `/api/health`: there is no Render cold-start to measure.
4. Generation uses exactly one POST, never an automatic POST retry or offline
   queue. Explain confirms the selected term and surrounding-text disclosure before
   sending. Cancellation/navigation aborts local fetch and suppresses stale results;
   it cannot promise cancellation of provider work or charges. Fixed failure codes
   and recovery messages replace raw provider errors; no prompts/keys in logs.
5. The small PDF spike is now **explicitly consented Gemini transcription**, not
   the deleted Node PDF endpoint. Validate `%PDF-`, base64 length and a 1 MiB cap;
   review/edit/export resulting Material. This may cost money and is not guaranteed
   lossless. A local parser is a future alternative, not bundled into Hermes.
6. Android Library uses transactional SQLite; browser Library uses transactional
   IndexedDB with optimistic revision checks. Stale tabs must reload rather than
   overwrite newer work. Preserve every portable collection and theme preference.
   Library replacement never replaces credentials/model settings. Duplicate Attempt
   retries are idempotent; conflicting IDs fail before persistence.
7. On web, Expo DOM would render the reader inline and install its restrictive CSP
   on the entire app. Instead embed the **same shared reader** in an opaque-origin
   `sandbox="allow-scripts"` iframe. Static HTML embeds all scripts/styles/fonts;
   network, frames, forms and external resources are blocked by CSP. Only Note
   fields and bounded action payloads cross `postMessage`, bound to the frame's
   source and a random per-host token. No `allow-same-origin`, credential props or
   arbitrary native-module bridge. Android keeps the proven Expo DOM seam.
8. Web's optional service worker caches only a generated allowlist of static shell
   assets. No library/credential/API responses in CacheStorage. After first complete
   load, supported HTTPS browsers can reopen the app offline. New releases activate
   after existing tabs close. Native preview embeds its bundle; OTA stays disabled.

## Consequences and limits

- Direct requests must be allowed by the user's network, key restrictions and the
  Provider's browser CORS policy. Browser extensions or compromised app code can
  still observe a key in memory; SecureStore is not protection from a rooted device.
- The physical acceptance gates still matter. Mocked transport tests and Hermes
  exports do not prove a real Gemini key, Samsung picker, Android backup rules,
  low-memory scrolling or signed APK installation on the user's device.
- Full Exams, Planner, full analytics, editing, other native Providers, cloud sync,
  notifications and Play release remain outside the prototype's explicit scope.

# M3 — native Library and one complete Drill (v1)

Status: **draft for review**, written 2026-10-01; implementation has not started.
The load-bearing decisions D1–D4 and D12 were confirmed with the user on
2026-10-01; D5–D11 are this plan's proposals, open to the same review. This
plan follows the [checkpoint-B plan](./M2-CHECKPOINT-B-PLAN.md) pattern (v3)
and resolves that plan's D4 carry-over as D2 below.

Authoritative scope, unchanged: [`ANDROID-PROTOTYPE-PLAN.md` §M3](../ANDROID-PROTOTYPE-PLAN.md)
(lines 422–443). Nothing in this plan may shrink that milestone's gate.

Checkpoint rule: M4 (BYOK, SecureStore, real AI, cold start, small PDF) does
not start here. M4 opens only after the M3 gate is recorded and the user
explicitly opens it. The M2 mock-Explain single-active-absorb-all
simplification stands until then.

## 1. Scope and non-goals

```text
in scope
  expo-sqlite persistence behind an async repository (versioned JSON
    collections, one transaction per import and per Drill finish, dataset
    bounded by PORTABLE_LIMITS)
  import flow: DocumentPicker → read → parsePortableExport |
    migrateLegacyBackup → preview (counts + issues + legacy warning) →
    confirm replace-all → outcome
  Library screens: Subject list → Subject detail (Notes, Quizzes, history)
  one complete Drill over a Quiz: flip → rate Mastered / Need Practice →
    finish → save Attempt → result → basic history → restart → persists
  native re-export (Share sheet) of the current library
  pure Drill machine, completion guard, attempt builder and StudyRepository
    in packages/core (TDD); thin SQLite backend + screens in apps/mobile

out of scope (M4: BYOK/SecureStore/real AI/cold start/PDF · M5: installed preview + decision)
  real AI, BYOK, SecureStore, any network call (mock Explain stays mock)
  any CRUD beyond import + Drill attempts — no on-device authoring of
    Subjects, Notes or Quizzes; the old web store is not cloned
  swipe gestures, shuffle, confetti (M5 polish; buttons only — D3)
  Analytics, Planner, Exam taking (only the basic Attempt history list ships)
  a persisted global Active-Subject setting (M4 revisit; D10)
```

The §M3 end-to-end flow this plan delivers, verbatim from the authority: web
export → Android file picker → validate/preview → confirm import → select
Subject → read Note / open Quiz → flip and rate cards → finish → save Attempt
→ show result and basic history → restart app → same data/result remains.

Device testing uses `fixtures/mobile/*.json` only (user-confirmed): no real
export files exist yet. Two fixture gaps are planned — a multi-Subject export
(scoping proof) and an export containing a legacy pre-JSON diagram fence (D2
proof).

## 2. Decisions (settled 2026-10-01)

| # | Decision | Resolution and basis |
| --- | --- | --- |
| D1 | Import mode | **Replace-all in one transaction after explicit confirm** (user-confirmed; PORTABLE-EXPORT.md's "replace-confirmation"). Cancel at any step = zero writes, old library intact. |
| D2 | Legacy pre-JSON diagram fences | **Survive import; the reader shows the labelled source fallback** (user-confirmed; resolves the M2 plan's D4). No `LegacyEditorialDiagram` port. A new fixture proves the path on device. |
| D3 | Drill surface | **Buttons only**: tap-to-flip, Mastered / Need Practice, prev/next (user-confirmed). Shuffle and swipe gestures are M5 polish. |
| D4 | Empty Quiz | **Block Drill start**: empty-state message, no Drill, no Attempt (user-confirmed). The web's broken 0 % flow is not preserved — a deliberate, recorded deviation. |
| D5 | Placement | Drill machine, completion guard, attempt builder and the StudyRepository live in **packages/core** (vitest-collected). SQLite backend, id factory and screens live in **apps/mobile**. |
| D6 | New-record IDs | **Collision-resistant, injected**: `randomUUID` at the app seam; deterministic counters in tests. Imported IDs preserved verbatim. (Web used `att-${Date.now()}`, which collides under rapid taps — the gate names this.) |
| D7 | Re-export | Minimal **Share-sheet export** of the current library (PORTABLE-EXPORT.md assigns native re-export to M3). No auto-backup. |
| D8 | Finish unit of work | Attempt insert + Quiz metadata bump (`lastScore`, `timesPracticed + 1`) commit as **one repository operation**. The web made two sequential calls; native commits atomically. |
| D9 | Completion guard | **Explicit single-flight guard** at the finish boundary: the first accepted save always runs to completion — invalidation never drops a completed Drill (deliberately different from the Explain session, where a late result is noise; here it is the learner's work). Further taps absorbed while pending; the done-machine is the structural second layer. A rejected save returns to a retryable error state; retry cannot duplicate because the repository never partially writes. |
| D10 | Active Subject | The **opened Subject** scopes its screens (CONTEXT.md's definition: screens show only the Active Subject's materials). No persisted global selection in M3. |
| D11 | Native dependencies | `expo-sqlite`, `expo-document-picker`, `expo-file-system`, `expo-sharing` land **together in Phase 3** → one development-build cycle; Phases 4–6 iterate over Metro. |
| D12 | Doc tidy-ups | This plan PR also flips ANDROID-PROTOTYPE-PLAN.md's header (still says "Checkpoint B is underway") and rewrites the web-era module map in DEVELOPING.md (user-confirmed). |

## 3. Target shape

```text
packages/core/src/
├── drill/
│   ├── drillSession.ts      # pure machine: flip / rate / next / prev → done(result)
│   ├── drillCompletion.ts   # single-flight finish guard + buildDrillAttempt (§5.3)
│   └── drill.test.ts        # §12 rows
├── repository/
│   ├── studyRepository.ts    # StudyRepository contract + StudyBackend seam + coordinator
│   ├── portableToLibrary.ts # pure Portable→Stored conversion (deep copy, IDs verbatim)
│   ├── inMemoryBackend.ts   # Map-backed StudyBackend — ADR-0001's required second adapter
│   └── repository.test.ts    # §12 rows
└── index.ts                 # re-export drill + repository

apps/mobile/
├── src/
│   ├── db/sqliteBackend.ts  # StudyBackend over expo-sqlite: JSON collections, one transaction per persist
│   ├── db/schema.ts         # table shape + versioned migration, transactional
│   ├── ids.ts               # newRecordId(): randomUUID (D6)
│   └── importFlow.ts        # bytes → parse/migrate → preview payload (pure orchestration)
├── app/
│   ├── index.tsx            # Library: Subject list (the hello hub retires)
│   ├── import.tsx           # pick → preview → confirm replace → outcome
│   ├── subject/[subjectId].tsx  # Active Subject: Notes, Quizzes, history
│   ├── note/[noteId].tsx    # library-backed reading (the 'use dom' seam, fed real data)
│   └── drill/[quizId].tsx   # one complete Drill + recorded result
├── components/ReaderAssetSpikeDOM.tsx   # unchanged seam
└── app/reader-spike.tsx, app/device-check.tsx   # fate decided in the Phase 5 review

fixtures/mobile/
└── portable-legacy-diagram.json   # NEW: valid export containing a pre-JSON legacy fence (D2)
```

Import rule for every new app file: nested routes reach shared code through
the existing `@/*` tsconfig alias — `scripts/check-mobile-imports.mjs` flags
any specifier starting `../..` (it is string-based; even in-app targets get
flagged).

## 4. Phase 0 — this plan + doc tidy-ups (docs only)

This PR. Definition of done: plan merged; ANDROID-PROTOTYPE-PLAN.md header
flipped to M3-underway; DEVELOPING.md module map rewritten to the
two-packages-plus-app layout; docs/README.md in-flight table carries this
plan.

## 5. Phase 1 — Drill core (packages/core, TDD)

The web parity target is `src/components/quizzes/FlashcardView.tsx` +
`QuizzesManager.handleFinishDrill` at `35d3329^` (deleted; read from history).

### 5.1 drillSession — pure machine

```text
createDrillSession(flashcards) → session | null        // null when empty (D4)
state { index, flipped, mastered, review, status: active | done, result? }
flip                   → flipped = true
rate('mastered')       → mastered ∪ {card}, review ∖ {card}, advance(fresh set)
rate('need-practice')  → review ∪ {card}, mastered ∖ {card}, advance(fresh set)
next / prev            → index ± 1, flipped = false, sets untouched
advance(set)           → index + 1, or when past the last card: status = done
                         and result = { score, masteredCount, total } recorded
                         from the event's explicit set — never recomputed
events after done      → absorbed (terminal state)
```

Rules pinned by tests: rating is idempotent in both directions (re-rating
moves the card between sets); navigation without rating changes nothing;
passing the last card IS the finish — the rater passes the just-built set, so
rating the final card cannot be dropped (the gate's named regression); score =
`Math.round((mastered.size / Math.max(1, cards.length)) * 100)`, preserved
verbatim even though D4 makes the empty deck unreachable.

### 5.2 drillCompletion — guard + payload

A small single-flight factory local to packages/core — not the reader-core
one: the absorb semantics differ per D9, and core must not depend on
reader-core. Absorb rules: further finish taps while pending → absorbed;
after settle the machine is done (structural layer); a rejected save returns
to a retryable error state, and retry cannot duplicate because the repository
never partially writes.

### 5.3 Attempt payload — web parity table

| Web (`35d3329^`) | M3 | Note |
| --- | --- | --- |
| `score = Math.round((mastered.size / Math.max(1, cards.length)) * 100)` | same | |
| `updateQuiz(lastScore, timesPracticed + 1)` then `recordAttempt` | one repository op (D8) | |
| attempt fields: `subjectId, subjectName, name, type:'Quiz', overallScore, totalQuestions = flashcards.length, correctQuestions = mastered, topicsToReview: []` | same | `timeSpentSeconds` and `gradedOffline` unset — web parity |
| `id: 'att-' + Date.now()` | injected factory (D6) | deliberate deviation |
| `date: new Date().toISOString()` | same (full timestamp) | portable accepts ISO date or timestamp |
| summary renders the recorded result | `state.result`, captured at finish | never recomputed |
| confetti at ≥ 70 | out of scope (M5 polish) | |

Definition of done: `NODE_ENV=test bun run test` green with the §12 drill
rows; `bun run typecheck:all` green; core boundary script green (the machine
is pure — no DOM/node globals).

## 6. Phase 2 — StudyRepository (packages/core, TDD)

```text
StudyBackend   { load(): Promise<Snapshot | null>, persist(s): Promise<void> }
               // persist must be atomic in production; may throw (disk-write failure)
StudyRepository
  listSubjects() → Subject summaries (+ note/quiz counts)
  getSubject(id) / getNote(subjectId, noteId) / getQuiz(subjectId, quizId)
  listAttempts(subjectId) → newest first
  importPortable(value) → counts        // replace-all or throw, zero observable change
  recordDrillFinish(attempt, quizId)    // one op: prepend attempt + bump quiz metadata
createStudyRepository(backend)          // coordinator, in core, fully tested
createInMemoryBackend()                 // second adapter (ADR-0001)
portableToLibrary(value)                // pure conversion; imported IDs verbatim
```

The coordinator holds the loaded snapshot in memory (bounded by
PORTABLE_LIMITS — 4 MiB file ceiling) and routes every write through
`persist`. An injected throwing backend proves the §M3 gate lines
"cancellation during import doesn't wipe the old library" and "disk-write
failure" as plain vitest rows. Two backends exist on day one (ADR-0001's
one-adapter rule): in-memory (tests) and SQLite (Phase 3).

The Snapshot carries **every** portable collection — subjects, notes, quizzes,
attempts, tasks, articles — even collections no M3 screen renders, because the
re-export round-trip (D7) must not lose imported data. Portable v1 field names
(e.g. `Article`) are frozen contract; CONTEXT.md's Material rename does not
rewrite the format.

Definition of done: §12 repository rows green; typecheck + core boundary green.

## 7. Phase 3 — native foundation (apps/mobile)

From `apps/mobile`: `bunx expo install expo-sqlite expo-document-picker
expo-file-system expo-sharing` — one development-build cycle (D11).
`src/db/sqliteBackend.ts` implements StudyBackend: JSON collections in SQLite
rows, a schema-version row, migration and every persist inside one
transaction. `src/ids.ts` supplies `randomUUID` (D6). A module-scoped
repository singleton wires the app; screens never construct one
(ADR-0001: no public persistence service).

Definition of done: gates green (`typecheck:all`, `check:mobile:imports`,
`check:mobile`); the user's EAS development build installs and boots to an
empty Library state on the A32. Metro serves Phases 4–6; no further native
builds until the gate build.

## 8. Phase 4 — import flow (device checkpoint A)

`src/importFlow.ts` (pure): bytes → `parsePortableExport`; on
unsupported-format → `migrateLegacyBackup` (its warning surfaces in the
preview); the result is a preview payload { counts, issues, legacy warnings }
or an error. The screen: pick → read → preview → confirm replace-all (the
confirm copy states the wipe explicitly, D1) → `importPortable` → outcome.
Cancel at pick, preview or confirm = zero writes. All parsing and legacy
migration happens before any write.

Prep: stage the fixture files onto the device (any file-manager path; they
are plain JSON); ensure at least one fixture contains ≥ 2 Subjects (extend
`portable-valid-en.json` if needed) for the scoping proof.

**Device checkpoint A** (development build; no network by construction):

1. Import `portable-valid-en.json` → preview counts → confirm → Subjects listed.
2. Kill + relaunch → data persists.
3. Import `portable-invalid-reference.json` → issue preview → old library intact.
4. Cancel at preview → old library intact.
5. Import `legacy-with-fake-credentials.json` → legacy warning → migration
   completes; credentials never surface anywhere.

## 9. Phase 5 — Library + note reading

`index.tsx` becomes the Library (Subject list, import entry, empty state);
`subject/[subjectId].tsx` lists Notes, Quizzes and (Phase 6) the history
section; `note/[noteId].tsx` feeds the existing `'use dom'` seam
(`ReaderAssetSpikeDOM.tsx` unchanged) from the repository — the reader's
content source moves from the bundled kitchen-sink fixture to library data.
`device-check.tsx` stays as a diagnostic. The `reader-spike` route's fate
(retire now vs M5) is decided in this phase's review.

Add `fixtures/mobile/portable-legacy-diagram.json`; on device, open its Note
→ the fence renders as the labelled source fallback (D2 proof — no
`LegacyEditorialDiagram` on mobile).

Definition of done: reader gates unchanged and green (the pipeline is
untouched — only its content source moves); a Note is visible from a cold
subject list; the legacy fence renders labelled on device.

## 10. Phase 6 — Drill screen + history (device checkpoint B)

`drill/[quizId].tsx` wires Phase 1: flip on tap, the two rating buttons,
prev/next, finish by advancing past the last card, the recorded-result screen,
then `recordDrillFinish` under the §5.2 guard. History = an Attempts list on
the Subject screen (newest first). Empty Quiz → blocked empty state (D4).

**Device checkpoint B = the full §M3 gate** — §13's checklist. Score rows are
hand-computed against the web rule before touching the phone.

## 11. Phase 7 — re-export + records

Library action → `portableCounts` + `createPortableExport` +
`serializePortableExport` → `expo-sharing`. Round-trip: export → replace-import
the same file → imported data + device-created Attempts intact.

Records (docs only, the closing PR): the M3 checkpoint record (SHAs, device,
OS, WebView, build id, checklist results) in `docs/mobile/`; this plan gets
its dated banner and moves to `docs/archive/`; ANDROID-PROTOTYPE-PLAN.md's
header and docs/README.md flip to "M3 complete"; an M4 handoff doc opens M4
explicitly.

## 12. Tests and gates

| Core test (vitest, packages/**) | Catches |
| --- | --- |
| empty flashcards → session is null | D4 deviation left implicit |
| all-mastered run rating the **last** card → recorded 100 % | the web stale-closure regression (gate-named) |
| last card rated need-practice → recorded score excludes it | last-card parity, both directions |
| rate → prev → re-rate moves the card between sets | one-way set updates |
| navigation without rating leaves sets unchanged | silent score drift |
| machine absorbs events after done; result never recomputed | post-finish mutations |
| guard: double finish → one save call (mock repo) | duplicate Attempts (gate) |
| guard: save rejects → no partial state → retry succeeds once | disk-write-failure recovery (gate) |
| repo: import replaces atomically; throwing persist → old snapshot intact, error surfaces | cancellation/failure wipes the library (gate) |
| repo: re-import the same file → identical state | import nondeterminism |
| repo: `recordDrillFinish` prepends the Attempt and bumps quiz metadata in one op | D8 partial writes |
| repo + counter id factory: two finishes → two distinct Attempts, newest first | the `att-Date.now()` collision class |

Iteration loop (cheap, every step): targeted vitest files +
`bun run typecheck:all` + `bun run check:reader` (the reader stays green
though untouched). Integration points only:

```sh
bun install --frozen-lockfile
bun run check:mobile:imports
bun run check:mobile        # typecheck:mobile + CI=1 expo export + reader export check
# device: EAS development build after Phase 3; preview build at the M3 gate
```

apps/mobile is not vitest-collected — screens stay thin wiring (the M2 rule:
control flow lives in core; the phone checklist is the screen test).

## 13. Final M3 gate (phone — Samsung A32, Android 13, WebView 152.x)

Preview build (embedded bundles, no Metro), airplane mode and Wi-Fi off, cold
launch. Record device, OS, WebView version, build/artifact id.

1. Empty Library state on first run.
2. Import `portable-valid-en.json` → preview → confirm → Subjects listed.
3. Kill + relaunch → same data (restart persistence).
4. Subject screens show only that Subject's Notes, Quizzes and Attempts
   (≥ 2 Subjects imported; imported subjects stay scoped — gate line).
5. Read a Note end-to-end; the legacy fence renders as the labelled source
   fallback (D2).
6. One complete Drill: flip, rate, finish → **score matches the hand-computed
   web expectation for the same rating sequence, including a run that rates
   the last card** (the gate's named regression).
7. Rapid double-tap on finish → exactly one Attempt; `timesPracticed` +1 once.
8. 0 %, partial and 100 % Drills recorded correctly.
9. Empty Quiz → blocked empty state, no Attempt.
10. Cancel import at every step → old library intact; failed import (invalid
    reference) → old library intact; legacy backup → migrated with warning.
11. Import cancellation never wipes: re-run item 10 with real data at stake.
12. Re-export → share sheet → the file contains Subjects + device-created
    Attempts → replace-import round-trips.
13. Restart after all of the above → everything persists.

Disk-write failure specifically is proven by the §12 injected-failure rows
plus the SQLite single-transaction structure; the phone checklist proves the
error paths never destroy the library (items 10–11).

## 14. Implementation order (each step ends green)

```text
0. plan + tidy-ups PR (this PR, docs only)
1. drill machine tests → drillSession (the §5.3 parity table becomes tests)
2. guard + builder tests → drillCompletion
3. repository tests → coordinator + inMemoryBackend + portableToLibrary
4. expo install (4 deps) → sqliteBackend + ids + singleton → gates → EAS dev build
5. importFlow tests (pure) → import.tsx → device checkpoint A
6. Library screens → note route off library data → legacy-fence fixture → device
7. drill/[quizId] + history → device checkpoint B (§13)
8. re-export → round-trip on device
9. records: checkpoint record, archive plan, header flips, M4 handoff
```

## 15. Risks and open items

| Item | Handling |
| --- | --- |
| Expo SDK drift on the 4 new native deps | `bunx expo install` picks SDK-57-compatible versions; lockfile pinned; one dev build validates |
| Reading `content://` URIs on Android | Decide in Phase 4 against the installed expo-file-system (SAF read vs cache copy); the import flow keeps the read isolated so the choice is one function |
| Whole-snapshot-in-RAM coordinator | Bounded by PORTABLE_LIMITS (4 MiB ceiling); acceptable for the prototype; revisit only if M4+ real data grows |
| SQLite partial-import bugs | Single-transaction persist is structural; injected-failure rows pin the coordinator; checkpoint A items 3–4 test on device |
| Guard drops a completed Drill on unmount | D9: an accepted save always completes — deliberately different from the Explain session; pinned by a test row |
| Fixture gaps (multi-Subject, legacy fence) | Phase 4/5 prep items, named in the phases |
| Import-entry placement, history placement, reader-spike fate | Open for phase reviews (copy/layout decisions, not structural) |
| Web parity source is deleted code | `35d3329^` is the only authority; the §5.3 table is copied into tests so parity outlives the exhumed files |
| dev-build quota/latency (user-side EAS) | D11 lands all native deps at once; Metro serves the rest; no agent-side EAS credentials |

Standing rules unchanged: the user merges every PR; no new EAS projects, no
workflow files, no M4 scope; fixtures stay credential-free
(`ANDROID-PROTOTYPE-PLAN.md`).

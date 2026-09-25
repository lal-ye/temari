# Checkpoint B · Phase 5 — session handoff

Status: **Phases 0–2 merged to `main`** (PR #27) · **Phases 3–4 implemented**
(2026-09-25, branch `arena/01a0d998-temari`, steps 4.1a/4.1b/4.2/4.3/4.4 as
separate commits). Phase 5 — the full gate matrix, the phone checklist and the
checkpoint-B record — is **not started**. This file is the authoritative
starting point for the next session; the design authority remains
[M2-CHECKPOINT-B-PLAN.md](./M2-CHECKPOINT-B-PLAN.md) (v3).

## 0. Suggested opening prompt for the next session

> Continue Temari's M2 checkpoint B from `docs/mobile/M2-B-PHASE5-HANDOFF.md`.
> Read it and `docs/mobile/M2-CHECKPOINT-B-PLAN.md` §9–§10 first. Phases 0–4
> are done (0–2 via PR #27; 3–4 on branch `arena/01a0d998-temari`). Implement
> **Phase 5 only**: run the full gate matrix, execute the phone checklist on
> the physical device, and write the checkpoint-B record. Do not merge to
> `main`, add persistence, real AI, or any M3/M4 scope without an explicit
> checkpoint.

## 1. Where things stand

| Phase | State | Evidence |
| --- | --- | --- |
| 0 · A phone evidence recorded | done, `d4ea872` | `M2-READER-SPIKE.md` — Samsung A32, Android 13, WebView 152.0.x |
| 1 · bridge contract + device action smoke | done, `d4ea872` | `bridge.ts` + 15 tests; smoke was on Expo web — **the on-phone WebView marshaling re-smoke folds into this phase's checklist (items 2–6 exercise the real function-prop paths: selection → onExplain, link → onOpenLink; the smoke button was removed in 4.2)** |
| 2 · mechanical renderer extraction | done, `f1999ef` | `NoteContent.tsx` (one map + skins), `FigureBlock`, `selection/`; `NoteViewer.test.tsx` byte-unchanged 25/25 throughout |
| 3 · sanitizer + link policy | done, `f53069e` | unified sanitized pipeline; `FixtureMarkdown` retired; fixture mounts `NoteContent`; security suite re-scoped (record: Phase 4 handoff §8) |
| 4 · selection + single-active session + native panel + link confirm | **done (this branch)** | see §8 below |
| 5 · full gates + phone checklist + checkpoint-B record | **not started** | plan §9–§10 = the scope |

Gates at the Phase 4 close (all green, run in order):

```text
bun run check:reader                      # 19 modules; Node smoke incl. link modes
NODE_ENV=test bun run test                # 466/466 (34 files)
bun run typecheck:all                     # web + core + mobile
NODE_ENV=production RENDER=true bun run build:render   # integration point only — it runs the suite itself
```

Count trail: 425 (checkpoint B start) → 438 (Phase 3) → 448 (4.1b: +10
explain-factory) → 458 (4.2: +10 NoteReader selection) → 466 (4.3: +8
link-factory).

Standing scope rules (still in force): no persistence, real AI/paid calls,
SQLite, SecureStore, import UI, or app network calls at checkpoint B. M3 owns
native import/SQLite/Library/Drill; M4 owns real BYOK/API/SecureStore (and may
revisit request supersede/cancellation — at B the single-active-absorb-all
simplification stands).

## 2. Environment lessons (read before working in the sandbox)

Unchanged; still true every turn:

- **`bun` is not on PATH** and installs outside the workspace do not persist:
  `npm install --prefix /home/user/.tools bun@1.3.9`, then
  `export PATH=/home/user/.tools/node_modules/.bin:$PATH`.
- **`node_modules` is snapshot-excluded**: `bun install --frozen-lockfile` at
  the start of a fresh turn (the root `postinstall` regenerates
  `src/reader-core/assets.generated.css` — generated, git-ignored, never
  committed).
- **Git objects can vanish between turns** (observed twice now). Commit and
  push every turn; on a rewind: `git fetch origin '+refs/heads/*:refs/remotes/origin/*'`,
  `git ls-remote origin` for the real tip, `git reset --soft` to it, then
  `git reset HEAD` to refresh the stale index — never force-push.
- `git`/`gh` are authenticated. Never ask for tokens/PATs. Render auto-deploys
  the historical branch `arena/01a09569-temari`, not `main`.
- The browser fast loop: `bun run dev` →
  `http://localhost:3000/__reader-fixture` (check at 408px) — selection →
  chip → session through the SAME factory as the phone; the dev panel has
  Send-mock/Close-invalidate buttons and shows the session state.
- Scratch-verification pattern for the dev page: temporary jsdom test that
  mounts `src/dev/reader-fixture.tsx` into a `#root` div (fake timers, advance
  300 ms for selection settle / 600 ms for the mock) — **delete before
  committing**.

## 3. Phase 5 scope (plan §9–§10 is the authority — this is a map, not a replacement)

No product code is expected to change; this is verification + records. If a
checklist item fails, fix the smallest surface and re-run the §1 gates.

**Gate matrix (all must pass before the phone checklist):**

```text
bun install --frozen-lockfile
bun run typecheck:all
NODE_ENV=test bun run test
NODE_ENV=production RENDER=true bun run build:render   # includes the suite — don't double-run
# apps/mobile (integration):
bunx expo install --check
CI=1 bunx expo export --platform android --output-dir ../../.cache/m2-export
cd ../.. && bun run check:reader:export   # one HTML doc, 24 embedded WOFF2 url(data:font/woff2;base64,…), no @import
```

**Phone checklist (plan §10; preview APK, airplane mode AND Wi-Fi off, cold
launch, no Metro):**

1. Complete kitchen-sink: math, table, structured figure + `Fig. N`, nested
   callouts, repairs, Amharic, long scroll, fonts, CSP panel quiet.
2. Selection (native handles) → fixed-bottom mock-labeled chip → run → native
   bottom-card result (term + requestId); **panel open/close preserves scroll
   position**. This plus items 3–6 are the Phase-1 marshaling re-smoke — the
   real `onExplain`/`onOpenLink` function-prop paths over Android WebView.
3. Rapid double-tap on the chip → exactly **one** mock invocation (the second
   is absorbed); rapid double-tap on a link action → exactly **one** Alert
   (never stacked).
4. **Close while pending** and **Back while pending** → no panel, no crash, no
   state on a dead screen; late completion dropped — and a fresh submission
   afterwards starts normally (the guard never sticks). The pending panel row
   reads `MOCK · RUNNING`, so "while pending" is observable.
5. Diagram node tap → same mock flow with the node label.
6. HTTPS link → **native `Alert` shows the parsed host prominently with the
   full URL truncated below** → confirm hands it to the OS outside the reader
   (in airplane mode, the handoff attempt is success — the external page need
   not load); cancel leaves the app in place; `//host`, relative, fragment and
   non-HTTPS links stay inert; imported HTML cannot move the WebView.
7. Re-run checkpoint A's checks (fonts, Back, selection handles, scrolling).

Record device, OS, WebView version, build/artifact id. No EAS quota spent
inside Arena; no merges, no `main` interaction, no workflow files, no Render
changes, no new EAS projects.

**Checkpoint-B record:** update `M2-READER-SPIKE.md` (§Checkpoint B) with the
phone evidence + the Phase 3/4 records (Phase 4 handoff §8 and Phase 5
handoff §8 below carry the content).

## 4. Traps — the corrections, not the summary

1. **The suite runs inside `build:render`** — don't double-run it at the
   integration point.
2. **Airplane-mode link criterion is the handoff, not a page load** —
   `Linking.openURL` may open an associated app; the OS chooser/browser
   appearing (or a no-handler error row, which is also an honest outcome) is
   the observable.
3. **Back while pending must invalidate**, not just unmount — the phone test
   for it is the `useFocusEffect` blur path; a crash or a resurrecting panel
   is a real bug, fix the screen wiring (never the factories, which are
   pinned by 18 web-vitest rows).
4. **Do not "helpfully" add a cancel path or supersede semantics** —
   single-active-absorb-all is the settled decision; M4 revisits if real AI
   needs cancellation.
5. `NoteViewer.test.tsx` stays byte-unchanged; any fix lands in the reader
   family or the schema, never that suite.
6. **No merges or `main` interaction** — the checkpoint-B review/merge is an
   explicit human checkpoint after the record exists.

## 5. Key file map (as of this handoff)

```text
src/reader-core/
├── bridge.ts                # ExplainRequest/OpenLinkRequest, inclusive bounds,
│                            # build/validate, isApprovedLink, newRequestId
├── NoteContent.tsx          # memo; ONE sanitized pipeline (§7.1); linkMode
│                            # matrix (default 'disabled'); a→button in
│                            # native-action; isApprovedLink at render time
├── NoteReader.tsx           # DOM host shell: CSP/fonts status + NoteContent
│                            # (skin reader) + debounced selection funnel +
│                            # fixed-bottom mock chip (SELECTION_SETTLE_MS=300)
├── session/singleFlight.ts  # the shared single-active guard primitive
├── session/createExplainSessionHandler.ts    # + 10 tests (§8.3 semantics)
├── session/createOpenLinkHandler.ts          # + 8 tests (§8.5 semantics)
├── sanitize.ts              # readerSchema + rehypeTaskListInputs pre-filter
├── csp.ts / csp.test.ts     # reader CSP contract
├── reader.css               # reader-skin classes + chip bar + dev panel
├── selection/segmentTerm.ts # termAtOffset/contextWindow (48 / 120; 302 note)
└── selection/termAtPoint.ts # recogniseTermAtPoint — web long-press reference
src/dev/reader-fixture.tsx   # dev page: full funnel (selection → chip →
                             # session factory) + mock link log + dev panel
src/components/notes/NoteViewer.tsx       # web wrapper (linkMode="web")
apps/mobile/app/reader-spike.tsx          # wiring only: two factories,
                                          # Alert confirm, Linking handoff,
                                          # ONE useFocusEffect, bottom cards
apps/mobile/components/ReaderAssetSpikeDOM.tsx # 'use dom' seam (smoke button
                                               # retired; noteId/onExplain/
                                               # onOpenLink + native-action)
fixtures/mobile/reader-kitchen-sink.json  # unchanged since Phase 3 (v1)
```

## 6. Definition of done (Phase 5)

- The §3 gate matrix passes end to end (counts reported in the record).
- The §3 phone checklist passes on the physical device; failures fixed at the
  smallest surface with the §1 gates re-run; evidence recorded (device, OS,
  WebView, artifact id, per-item results).
- The checkpoint-B record exists in `M2-READER-SPIKE.md` with the Phase 3/4
  records folded in.
- Everything committed and pushed to `arena/01a0d998-temari`; the PR/merge
  decision is left open for the explicit human checkpoint.

## 7. After Phase 5

Checkpoint B is complete; M3 owns native import/SQLite/Library/Drill (legacy
pre-JSON diagram import parity is a recorded M3 decision, D4), M4 owns real
BYOK/API/SecureStore and may revisit request supersede/cancellation. The
Render-deployed service tracks the historical branch `arena/01a09569-temari`,
not `main` — deploying any of this is a separate, explicit decision.

## 8. Phase 4 record — carry into the checkpoint-B record

- **4.1a** `3028aa5`: pure rename `ReaderAssetSpike.tsx → NoteReader.tsx`
  (isolated commit, zero behavior change); the `'use dom'` seam keeps its
  historical name per the plan's target shape.
- **4.1b** `e3c8707`: `session/createExplainSessionHandler.ts` — the pure
  factory (check-and-set before run, absorb-while-pending with ANY id, invalid
  payloads start no work, epoch-based invalidation drops late completions,
  `finally` clears the guard) + `session/singleFlight.ts` guard primitive;
  10 web-vitest rows including the stuck-guard row (submit → Close while
  pending → submit again succeeds). The Expo screen shrank to wiring; the dev
  fixture's mock host runs the same factory. Narrowing note: the root tsconfig
  has no strictNullChecks, so the rejection arm uses the literal
  `checked.ok === false` form (documented in the file).
- **4.2** `96f9dd6`: selection funnel in `NoteReader` — ONE debounced
  `selectionchange` derive 300 ms after the last event (touchend/mouseup only
  re-arm), capture at settle, container-scoped both-endpoint check,
  multi-block and >60-char rejection (whitespace-collapsed), `contextWindow`
  context, fixed-bottom mock-labeled chip (D3), diagram taps through the same
  `buildExplainRequest` funnel; the Phase-1 smoke button retired; 10 jsdom
  rows.
- **4.3** `a8cdf7f`: `session/createOpenLinkHandler.ts` (injected
  confirm/open; `isApprovedLink` re-check; same single-flight guard; cancel
  dispatches nothing; guard clears on completion/failure/invalidate; never
  `canOpenURL`) + 8 rows; `reader-spike.tsx` wires `Alert.alert` (host
  prominent, URL truncated), `Linking.openURL` try/catch handoff, link status
  rows in the bottom card; ONE `useFocusEffect` (setup: alive+focused;
  cleanup: invalidate both sessions) replaces the useEffect aliveRef pair.
- **Intentional small deltas at 4.2/4.3** (record, don't relitigate): the
  panel now shows a `MOCK · RUNNING` row while pending (plan §8.3 renders
  idle/pending/done/error; it also makes "Close while pending" observable);
  the note header eyebrow reads "M2 · Reader / kitchen-sink fixture"; the
  seam always passes `linkMode="native-action"` (inert until the handler
  exists — per §7.3, never handler-presence-inferred modality in the
  renderer). The link handler intentionally has NO focus-staleness checks
  (guard only) — a confirm resolved after blur still opens the URL the user
  approved; revisit only if the phone checklist flags it.
- `NoteViewer.test.tsx` byte-unchanged across all four steps (25/25).

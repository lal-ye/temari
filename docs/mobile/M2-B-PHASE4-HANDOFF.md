# Checkpoint B · Phase 4 — session handoff

Status: **historical** — Phases 0–2 merged to `main` (PR #27); **Phase 3
implemented** (`f53069e`) and **Phase 4 implemented** (2026-09-25, branch
`arena/01a0d998-temari`: `3028aa5` rename · `e3c8707` session factory ·
`96f9dd6` selection · `a8cdf7f` link confirm + lifecycle). The next session
starts from [M2-B-PHASE5-HANDOFF.md](./M2-B-PHASE5-HANDOFF.md); this file is
retained as the Phase 4 scope record (its §8 Phase 3 record is carried
forward there). The design authority remains
[M2-CHECKPOINT-B-PLAN.md](./M2-CHECKPOINT-B-PLAN.md) (v3).

## 0. Suggested opening prompt for the next session

> Continue Temari's M2 checkpoint B from
> `docs/mobile/M2-B-PHASE4-HANDOFF.md`. Read it and
> `docs/mobile/M2-CHECKPOINT-B-PLAN.md` §8–§11 (v3 — the Phase-4 review is
> incorporated) first. Phases 0–3 are done (0–2 via PR #27, Phase 3 on branch
> `arena/01a0d998-temari`); implement **Phase 4 only** on this session's
> assigned branch, in the review-ordered steps **4.1 → 4.4** (session-handler
> factory → DOM selection → native link confirm + lifecycle consolidation →
> gates), each step ending green. Honor every trap listed in the handoff §4.
> Keep `NoteViewer.test.tsx` green and unchanged. Run the §6 gates before
> stopping and write a Phase 5 handoff the same way. Do not implement Phase 5,
> persistence, real AI, or merge without an explicit checkpoint.

## 1. Where things stand

| Phase | State | Evidence |
| --- | --- | --- |
| 0 · A phone evidence recorded | done, `d4ea872` | `M2-READER-SPIKE.md` — Samsung A32, Android 13, WebView 152.0.x |
| 1 · bridge contract + device action smoke | done, `d4ea872` | `bridge.ts` + 15 tests; smoke on Expo web only — **the on-phone WebView marshaling re-smoke still sits in the Phase 5 gate** |
| 2 · mechanical renderer extraction | done, `f1999ef` | `NoteContent.tsx` (one map + skins), `FigureBlock`, `selection/`; `NoteViewer` 497 lines; `NoteViewer.test.tsx` byte-unchanged 25/25 |
| 3 · sanitizer + link policy | done, `f53069e` | unified sanitized pipeline everywhere; `FixtureMarkdown` retired; fixture mounts `NoteContent` (skin `reader`, `native-action` against mocks); security suite re-scoped; see §8 |
| 4 · selection + single-active session + native panel + link confirm | **not started** | plan §8 (v3) = the scope, review-ordered into steps 4.1–4.4 (§3 below). `reader-spike.tsx`'s Phase-1 handler skeleton gets **extracted into the factory** in 4.1, not grown in place |
| 5 · full gates + final M2 preview gate | not started | plan §9–10 |

Gates at the Phase 3 close: `bun run check:reader` clean (**16** modules) ·
`NODE_ENV=test bun run test` **438/438** (was 425: −10 retired fixture suite,
+21 new `NoteContent` tests, +2 moved CSP tests) · `bun run typecheck:all`
green · `NODE_ENV=production RENDER=true bun run build:render` green
(integration point only; it runs the suite itself — don't double-run).

Standing scope rules (still in force): no persistence, real AI/paid calls,
SQLite, SecureStore, import UI, or app network calls at checkpoint B. M3 owns
native import/SQLite/Library/Drill; M4 owns real BYOK/API/SecureStore.

## 2. Environment lessons (read before working in the sandbox)

Unchanged from the Phase 3 handoff, still true:

- **`bun` is not on PATH** and installs outside the workspace do not persist:
  `npm install --prefix /home/user/.tools bun@1.3.9`, then
  `export PATH=/home/user/.tools/node_modules/.bin:$PATH`.
- **`node_modules` is snapshot-excluded** between turns: run
  `bun install --frozen-lockfile` at the start of a fresh turn (the root
  `postinstall` regenerates `src/reader-core/assets.generated.css`, which is
  generated, git-ignored, and must never be committed).
- **Git objects can vanish between turns** even though working files persist.
  Commit **and push every turn**. If `git status` shows already-committed files
  as modified/untracked again, the history was rewound: `git fetch origin
  '+refs/heads/*:refs/remotes/origin/*'`, find the real remote tip with
  `git ls-remote origin`, `git reset --soft` to it (then `git reset HEAD` to
  refresh the stale index), and re-commit any delta — never force-push over
  the remote's history. (This happened again before this handoff was written;
  the remote branch tip survived, only local history rewound.)
- `git`/`gh` are authenticated. Never ask for tokens/PATs. Render auto-deploys
  the historical branch `arena/01a09569-temari`, not `main`.

Phase-3 additions:

- The browser fast loop is `bun run dev` →
  `http://localhost:3000/__reader-fixture` (check at 408px). It renders the
  kitchen-sink through the real `NoteContent` pipeline with
  `linkMode="native-action"` against the **mock dev panel** at the bottom,
  which logs every `onOpenLink`/`onExplain` payload it receives.
- To verify the dev fixture programmatically, mount `src/dev/reader-fixture.tsx`
  in a temporary vitest file (jsdom: give the document a `#root` div first,
  then dynamic-import the entry) — **delete the scratch test before
  committing**; it must not join the suite.
- `scripts/smoke-reader.mjs` now SSR-renders the fixture path through
  `NoteContent` (all three link modes) — the boundary test runs it on every
  `NODE_ENV=test bun run test`.

## 3. Phase 4 scope (plan §8 v3 is the authority — this is a map, not a replacement)

The Phase-4 review reordered the work into four steps, each ending green;
4.1's rename is its own commit so the selection diff stays reviewable.

```text
4.1 · Pure rename + session-handler factory               (plan §8.3)
src/reader-core/ReaderAssetSpike.tsx → NoteReader.tsx
                                   # ISOLATED pure-rename commit, zero behavior
                                   # change; update importers: src/dev/reader-fixture.tsx,
                                   # apps/mobile/components/ReaderAssetSpikeDOM.tsx,
                                   # scripts/smoke-reader.mjs
src/reader-core/session/createExplainSessionHandler.ts (+ .test.ts)
                                   # pure factory, no DOM/RN APIs:
                                   # createExplainSessionHandler({ expectedNoteId,
                                   # isAlive, isFocused, dispatch, run }) ->
                                   # { submit(raw), invalidate() }
                                   # check-and-set BEFORE run; absorb-while-pending
                                   # (any id); finally clearing; stale-result drop;
                                   # invalidate() clears the guard AND the view;
                                   # single-flight guard reusable by the link path
apps/mobile/app/reader-spike.tsx   # shrink to wiring: refs + useReducer +
                                   # useFocusEffect -> invalidate; no control flow
src/dev/reader-fixture.tsx         # the mock host REUSES the same factory
tests                              # the §9 rows as plain vitest against the
                                   # factory, call counts on a mock run — incl.
                                   # the NEW row: submit -> Close while pending ->
                                   # submit again SUCCEEDS (stuck-guard pin)

4.2 · DOM selection                                       (plan §8.1)
src/reader-core/NoteReader.tsx     # ONE debounced selectionchange derive
                                   # (~250–300 ms after the last event; touchend/
                                   # mouseup only re-arm it), both endpoints in
                                   # the note container, whitespace-collapsed
                                   # phrase <= 60 chars and single block else NO
                                   # chip, capture term+context AT SETTLE (never
                                   # on chip tap), FIXED-BOTTOM mock-labeled chip
                                   # (D3), diagram taps through the same
                                   # buildExplainRequest funnel; verify at 408px

4.3 · Native link confirm + lifecycle consolidation        (plan §8.5, §8.3)
apps/mobile/app/reader-spike.tsx   # Alert.alert confirm: parsed HOST prominent,
                                   # full URL truncated below; isApprovedLink
                                   # re-check first; Linking.openURL in try/catch
                                   # — NEVER canOpenURL (Android 11+ package
                                   # visibility false negatives); link double-tap
                                   # through the same single-flight guard
                                   # (+ its client test); ONE useFocusEffect
                                   # (alive/focused on focus, invalidate() on
                                   # blur) replaces the useEffect aliveRef pair

4.4 · Gates                                               (§6 below)
```

**What already exists** (extract/replace, don't rebuild): `reader-spike.tsx`
has a working Phase-1 single-active handler + bottom-card panel (a sibling,
not a Modal) — 4.1 moves its control flow INTO the factory and deletes the
inline copy. `NoteContent` already dispatches `onOpenLink` from trusted action
buttons (Phase 3); 4.3 only adds the native confirm behind it. The smoke
button in `ReaderAssetSpikeDOM` is removed in 4.2 (or kept behind
`development`) once real selection wiring exists.

## 4. Traps — the corrections, not the summary

1. **Test the factory, not the screen.** No RN harness exists for
   `reader-spike.tsx` and none gets added at checkpoint B; every §9
   concurrency row is a plain vitest test against
   `createExplainSessionHandler` with a mock `run` — assert **call counts**.
   The screen is wiring only.
2. **The stuck-guard hole.** Absorb-everything's failure mode is an
   `activeRequestId` that never clears (error path, missed invalidation) —
   after which nothing can ever submit again. `invalidate()` and the
   `finally` block must BOTH clear the guard; the fourth test row (submit →
   Close while pending → submit again succeeds) pins it.
3. **One lifecycle mechanism.** `useFocusEffect` alone covers focus/blur AND
   mount/unmount for a focused screen, and its setup/cleanup is Strict-Mode
   safe. One `useFocusEffect` sets alive/focused on focus and calls
   `invalidate()` on blur — replacing the `useEffect` aliveRef pair. The
   factory is the single place invalidation lands.
4. **Debounce `selectionchange`** (~250–300 ms after the last event). Android
   fires it continuously during handle-drag; deriving per event thrashes the
   chip and re-renders the tree mid-drag. Capture `term` + `context` when the
   debounce settles — never on chip tap (the button press changes focus and
   collapses the selection).
5. **Both endpoints in the note-content container**, and multi-block or
   oversized selections are rejected: collapse whitespace in the selected
   string; if the trimmed phrase exceeds 60 chars OR the anchor/focus blocks
   differ → no chip. Rejecting matches web behavior, which already caps at 60.
6. **Fixed-bottom chip bar**, never a popover near the selection — Android's
   floating ActionMode toolbar owns the space above a selection in a WebView.
   One flex row of CSS sidesteps the whole overlap class.
7. **Link confirm = `Alert.alert`**: native, accessible, modal, free. Parsed
   host prominent, full URL truncated below. Never `canOpenURL` (Android 11+
   package-visibility false negatives) — `try { await Linking.openURL(url) }
   catch { error row }`. The wording rule stays verbatim: the app hands the
   URL to the operating system outside the reader; in airplane mode the
   handoff attempt is the success criterion, not a loaded page.
8. **Guard the link button's double-tap too** — two rapid taps → two stacked
   Alerts is the duplicate-Explain bug class. Route `OpenLinkRequest`s
   through the same single-flight guard (extracted testable beside the
   factory) and pin it with a client test.
9. **Stable callbacks = `useCallback` with EMPTY deps reading refs**, not deps
   on session state — every panel state change must not re-serialize props
   across the DOM bridge.
10. **Clamp in the builder** (302→300): use `buildExplainRequest`; never
    hand-build an `ExplainRequest` in the DOM.
11. **Keep single-active-absorb-all** — no supersede, no request-id history.
    Easier to prove on the phone checklist; M4 can revisit cancellation if
    real AI needs it.
12. **`NoteViewer.test.tsx` stays byte-unchanged**; fix the feature, never
    that suite.
13. **The rename is its own commit** (pure `ReaderAssetSpike.tsx →
    NoteReader.tsx`, zero behavior change) so the 4.2 selection diff stays
    reviewable.

## 5. Key file map (as of this handoff)

```text
src/reader-core/
├── bridge.ts                # ExplainRequest/OpenLinkRequest, inclusive bounds,
│                            # build/validate, isApprovedLink, newRequestId
├── NoteContent.tsx          # memo; ONE sanitized pipeline (§7.1 list); one
│                            # components map + web/reader skins; linkMode
│                            # matrix (default 'disabled'), a→button in
│                            # native-action, isApprovedLink at render time
├── NoteContent.test.tsx     # 27 tests: skins, normalization, link matrix
│                            # (incl. no-handler inert, skin≠behavior,
│                            # uppercase-scheme nuance), task lists, hostile
│                            # inputs, kitchen-sink security, seed note
├── ReaderAssetSpike.tsx     # fixture shell → NoteContent (skin reader) with
│                            # explicit linkMode/onOpenLink; 4.1 renames to
│                            # NoteReader.tsx (isolated commit), 4.2 grows the
│                            # debounced selection funnel + fixed-bottom chip
├── session/createExplainSessionHandler.ts   # NEW in 4.1 (pure, + tests);
│                            # the single-flight guard beside it serves the
│                            # link confirm path in 4.3
├── sanitize.ts              # readerSchema + rehypeTaskListInputs pre-filter
│                            # (comments carry the verified §4.2 semantics)
├── csp.ts / csp.test.ts     # CSP moved out of the retired fixture suite
├── reader.css               # reader-skin classes (callout/quote/pre/table/
│                            # link/-button/inert, figure-wrap, task lists)
│                            # + .reader-dev-panel
├── selection/segmentTerm.ts # termAtOffset/contextWindow (48 / 120; 302 note)
└── selection/termAtPoint.ts # recogniseTermAtPoint — web long-press reference
src/dev/reader-fixture.tsx   # dev page: native-action + mock onOpenLink/
                             # onExplain logged in the dev panel; 4.1 reuses
                             # the factory for the mock host
src/components/notes/NoteViewer.tsx       # web wrapper; only Phase-3 change:
                                          # linkMode="web"
src/components/notes/rehypeNoteAnchors.test.ts  # source pin follows the
                                                # unified pipeline (updated)
apps/mobile/app/reader-spike.tsx          # Phase-1 single-active handler +
                                          # bottom card; 4.1 wiring-only, 4.3
                                          # Alert confirm + guards
apps/mobile/components/ReaderAssetSpikeDOM.tsx # 'use dom' seam + smoke button
fixtures/mobile/reader-kitchen-sink.json  # unchanged this phase (v1)
```

## 6. Definition of done (Phase 4)

- 4.1: the rename landed as an **isolated pure-rename commit**;
  `createExplainSessionHandler` in `reader-core` with all factory rows green —
  rapid submissions → `run` called **once** · invalid payload → `run` never
  called · `invalidate()` while pending → late completion stays dropped ·
  submit → Close while pending → submit again **succeeds**. `reader-spike.tsx`
  reduced to wiring; the dev fixture's mock host runs the same factory.
- 4.2: debounced selection (native handles + the browser fixture) proposes a
  candidate; container/bounds/multi-block/oversized rejection; the
  **mock-labeled fixed-bottom chip**; diagram node taps join the same
  `buildExplainRequest` flow.
- 4.3: native `Alert.alert` confirm (host prominent, URL truncated) after the
  `isApprovedLink` re-check; `Linking.openURL` in try/catch (no `canOpenURL`);
  the link double-tap guard with its client test; one `useFocusEffect`
  lifecycle.
- The mock panel stays a native bottom-card sibling; panel open/close
  preserves reader scroll position.
- `NoteViewer.test.tsx` byte-unchanged and green.
- Gates: `bun run check:reader` · `NODE_ENV=test bun run test` (all green,
  count reported) · `bun run typecheck:all` — and at the integration point
  only `NODE_ENV=production RENDER=true bun run build:render` (it already runs
  the test suite; don't double-run).

## 7. After Phase 4

Phase 5 (plan §9–10): the full gate matrix (`bun install --frozen-lockfile` ·
`typecheck:all` · `NODE_ENV=test bun run test` · `build:render` ·
`bunx expo install --check` · `CI=1 bunx expo export --platform android` ·
`check:reader:export` — one HTML doc, 24 embedded WOFF2, no `@import`), the
phone checklist (which carries the Phase-1 marshaling re-smoke, "Close while
pending — and a fresh submission afterwards works", "panel open/close
preserves scroll position", rapid link double-tap → one confirm, and the
airplane-mode link **handoff**), and the checkpoint-B record. No merges, no
`main` interaction, no workflow files, no Render changes, no new EAS projects.
M4 may revisit supersede/cancellation if real AI needs it — at B the
single-active-absorb-all simplification stands.

## 8. Phase 3 record — carry into the Phase 5 checkpoint-B record

- **Pipeline** (exactly the §7.1 diff): `[rehypeRaw, rehypeTaskListInputs,
  [rehypeSanitize, readerSchema], rehypeNoteRepairs, rehypeNoteCallouts,
  rehypeNoteAnchors, [rehypeKatex, { trust: false, maxExpand: 100, maxSize:
  20 }]]` — one list for web and the reader; `FixtureMarkdown` deleted; the
  fixture (dev page and the Expo shell) mounts `NoteContent` (skin `reader`).
- **Schema deltas**: `input` moved from `strip` to `tagNames` with
  `[['type','checkbox'], ['checked', true], ['disabled', true]]` only; `a:
  ['href']` with `protocols: { href: ['https'] }`; everything else unchanged.
- **Verified against hast-util-sanitize 5.0.2** (not trusted from either
  summary): the shallow schema merge keeps the default `required`
  `{input: {disabled: true, type: 'checkbox'}}`, and a hostile
  `<input name="credential" value="FAKE-ONLY">` really does surface as a
  disabled checkbox without the pre-filter (reproduced; the pre-filter removes
  it). `protocols: { href: ['https'] }` passes `#sec-1`, `/app` and `//host`
  (a colon after `/?#` is not a scheme) — `isApprovedLink` is the actual rule,
  as reviewed. One NEW nuance: the protocol match is **case-sensitive**, so an
  authored `HTTPS://…` link renders inert even though `isApprovedLink` approves
  it — the layering is fail-closed (lower layer stricter, never looser);
  documented and pinned by a test.
- **Intentional web deltas** (plan §7.3, guarded by tests): note images stop
  rendering (including their alt text — no `img` in the schema, consistent
  with M2's remote-image policy); exotic authored tags (`<mark>`, `<abbr>`,
  `<details>`…) unwrap to text; authored `id`s are dropped (heading ids are
  the generated `sec-N` only); in `web` mode local fragments/paths render
  plain `<a>` per the §7.3 table — the old blanket `target="_blank"` now
  applies to approved HTTPS anchors only. Dangerous link schemes were **not**
  a change (react-markdown's `urlTransform` already nulled them). The web
  wrapper's only change this phase: `linkMode="web"`.
- **Trusted chrome vs authored** (§7.4): authored buttons/inputs/forms are
  removed; the expected buttons are the native-action link button (its URL
  rides as inert `title` data — never a URL-bearing attribute; CSP
  `img-src`/`connect-src` remain `none`) and `FigureShell.Error`'s "Show
  source". The old blanket `button`/`a`/`example.invalid` assertions are
  re-scoped to that distinction.
- `NoteViewer.test.tsx` byte-unchanged (25/25); the seed-note text test is
  supplementary coverage (sanitization is not redaction; `strip` loses text).

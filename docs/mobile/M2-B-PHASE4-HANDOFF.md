# Checkpoint B · Phase 4 — session handoff

Status: **Phases 0–2 merged to `main`** (PR #27) · **Phase 3 implemented**
(2026-09-25, branch `arena/01a0d998-temari`, this handoff included). Phase 4 is
**not started**. This file is the authoritative starting point for the next
session; the design authority remains
[M2-CHECKPOINT-B-PLAN.md](./M2-CHECKPOINT-B-PLAN.md) (v2, review-corrected).

## 0. Suggested opening prompt for the next session

> Continue Temari's M2 checkpoint B from
> `docs/mobile/M2-B-PHASE4-HANDOFF.md`. Read it and
> `docs/mobile/M2-CHECKPOINT-B-PLAN.md` §8 first. Phases 0–3 are done (0–2 via
> PR #27, Phase 3 on this session's assigned branch); implement **Phase 4
> only** (selection wiring + single-active request + native panel + link
> confirm) on this session's assigned branch. Honor every trap listed in the
> handoff §4. Keep `NoteViewer.test.tsx` green and unchanged. Run the §6 gates
> before stopping and write a Phase 5 handoff the same way. Do not implement
> Phase 5, persistence, real AI, or merge without an explicit checkpoint.

## 1. Where things stand

| Phase | State | Evidence |
| --- | --- | --- |
| 0 · A phone evidence recorded | done, `d4ea872` | `M2-READER-SPIKE.md` — Samsung A32, Android 13, WebView 152.0.x |
| 1 · bridge contract + device action smoke | done, `d4ea872` | `bridge.ts` + 15 tests; smoke on Expo web only — **the on-phone WebView marshaling re-smoke still sits in the Phase 5 gate** |
| 2 · mechanical renderer extraction | done, `f1999ef` | `NoteContent.tsx` (one map + skins), `FigureBlock`, `selection/`; `NoteViewer` 497 lines; `NoteViewer.test.tsx` byte-unchanged 25/25 |
| 3 · sanitizer + link policy | **done (this branch)** | unified sanitized pipeline everywhere; `FixtureMarkdown` retired; fixture mounts `NoteContent` (skin `reader`, `native-action` against mocks); security suite re-scoped; see §8 |
| 4 · selection + single-active mock + native panel | **not started** | plan §8 = the scope. Note: `reader-spike.tsx` already has the Phase-1 single-active handler skeleton + bottom-card panel — §3 lists what actually remains |
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
  `git ls-remote origin`, `git reset --soft` to it, and re-commit the delta —
  never force-push over the remote's history.
- `git`/`gh` are authenticated. Never ask for tokens/PATs. Render auto-deploys
  the historical branch `arena/01a09569-temari`, not `main`.

Phase-3 additions:

- The browser fast loop is `bun run dev` →
  `http://localhost:3000/__reader-fixture` (check at 408px). It renders the
  kitchen-sink through the real `NoteContent` pipeline with `linkMode
  ="native-action"` against the **mock dev panel** at the bottom, which logs
  every `onOpenLink`/`onExplain` payload it receives.
- To verify the dev fixture programmatically, mount `src/dev/reader-fixture.tsx`
  in a temporary vitest file (jsdom: give the document a `#root` div first,
  then dynamic-import the entry) — **delete the scratch test before
  committing**; it must not join the suite.
- `scripts/smoke-reader.mjs` now SSR-renders the fixture path through
  `NoteContent` (all three link modes) — the boundary test runs it on every
  `NODE_ENV=test bun run test`.

## 3. Phase 4 scope (plan §8 is the authority — this is a map, not a replacement)

One change set: real selection wiring into the (already working) single-active
mock Explain, the native bottom-card panel fed by it, and the native link
confirm. File-by-file:

```text
src/reader-core/ReaderAssetSpike.tsx → NoteReader.tsx (plan §3 name)
                                   # DOM host shell: container-scoped selection
                                   # → mock-labeled chip → buildExplainRequest →
                                   # onExplain; diagram taps reuse the same path;
                                   # keep linkMode/onOpenLink passthrough as-is
src/reader-core/selection/         # termAtPoint.ts is the web reference for
                                   # selection capture; segmentTerm bounds 48/120
apps/mobile/components/ReaderAssetSpikeDOM.tsx
                                   # pass onExplain (exists) + onOpenLink (new);
                                   # linkMode="native-action"; remove the Phase-1
                                   # smoke button or gate it behind development
apps/mobile/app/reader-spike.tsx   # + native link confirm (shows the URL) +
                                   # Linking.openURL after re-running
                                   # isApprovedLink; + useFocusEffect
                                   # invalidation (blur, not just unmount)
src/dev/reader-fixture.tsx         # dev panel stays; selection now exercises
                                   # the real DOM chip → mock onExplain path
tests (client-side)                # the three remaining §9 rows — see §6
```

**What already exists** (do not rebuild): `reader-spike.tsx` has the §8.3
control flow from the Phase 1 smoke — check-and-set `activeRequestIdRef`
before the mock, submissions absorbed while pending (any id), `aliveRef` set
true during setup, `try/catch/finally`, bottom-card panel as a **sibling**
(not a Modal), Close invalidates. **What's missing**: DOM-side selection
(§8.1) feeding it, the mock-labeled chip (§8.4/D3), diagram taps into the same
flow, the native link confirm + `Linking.openURL` + `isApprovedLink` re-check,
`useFocusEffect` route-blur invalidation, and the client-test rows.

## 4. Traps — the corrections, not the summary

1. **Capture `term` + `context` at selection time**, before the Explain button
   takes focus and collapses the selection (plan §8.1).
2. **Both selection endpoints** (`anchorNode`, `focusNode`) must be inside the
   note-content container; selections starting in the panel, chips or other UI
   are ignored.
3. **The 302→300 clamp is already handled**: `contextWindow` with a 60-char
   selection yields `120+60+120+2 = 302`; `buildExplainRequest` clamps to 300
   before dispatch. Use the builder; never hand-build an `ExplainRequest` in
   the DOM.
4. Word path (≤48 chars via `termAtOffset`) and phrase path (2..60 inclusive)
   both funnel into the same builder.
5. **Single active request**: check-and-set `activeRequestId` BEFORE starting
   the mock; absorb submissions while pending **even with a different id**; no
   supersede, no request-id history (plan §8.3 — the pseudocode there is the
   authority).
6. `aliveRef.current = true` in effect **setup** (React Strict Mode does
   setup/cleanup/setup). Invalidation on **Close, note change, route blur
   (`useFocusEffect`), and unmount** — the current code only handles Close and
   unmount.
7. **Perf rules (§8.2)**: chip/pending/panel state lives in the screen shell,
   outside `NoteContent` (it is `memo`ized already); stable callback props into
   the `'use dom'` component; never re-key/remount it when the panel opens —
   "panel open/close preserves scroll position" is also a Phase 5 phone row.
8. **The chip is DOM-side and must say the action is mock** (D3): "Run mock
   explanation…", not merely the result panel. Panel header: `MOCK ·
   checkpoint B`. Mock text echoes the term and the first ~120 chars of
   context. No credentials, network or AI.
9. **Links — one confirmation, native** (plan §7.3): the DOM button dispatches
   `onOpenLink` with no DOM confirm bar; native re-runs `isApprovedLink`, shows
   the URL, then hands it to the operating system outside the reader
   (`Linking.openURL` may open an associated app, not a browser). Wording rule:
   it is a **handoff**, not a page load — in airplane mode the handoff attempt
   is the success criterion.
10. **Client tests assert call counts** (§9): rapid submissions invoke the mock
    **once**; Close/blur then late completion leaves no panel; an invalid
    payload starts **no** work (no mock call at all). The v1 bug was
    reducer-only deduplication — the test must fail on that shape.
11. `NoteViewer.test.tsx` stays byte-unchanged; fix the feature, never that
    suite. (Three of the six §9 rows are already done and tested: diagram
    click with element — Phase 2; `native-action` without handler inert and
    hostile inputs/task checkboxes — Phase 3.)

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
│                            # explicit linkMode/onOpenLink — Phase 4 evolves
│                            # this into NoteReader (selection)
├── sanitize.ts              # readerSchema + rehypeTaskListInputs pre-filter
│                            # (comments carry the verified §4.2 semantics)
├── csp.ts / csp.test.ts     # CSP moved out of the retired fixture suite
├── reader.css               # reader-skin classes (callout/quote/pre/table/
│                            # link/-button/inert, figure-wrap, task lists)
│                            # + .reader-dev-panel
├── selection/segmentTerm.ts # termAtOffset/contextWindow (48 / 120; 302 note)
└── selection/termAtPoint.ts # recogniseTermAtPoint — web long-press reference
src/dev/reader-fixture.tsx   # dev page: native-action + mock onOpenLink/
                             # onExplain logged in the dev panel
src/components/notes/NoteViewer.tsx       # web wrapper; only Phase-3 change:
                                          # linkMode="web"
src/components/notes/rehypeNoteAnchors.test.ts  # source pin follows the
                                                # unified pipeline (updated)
apps/mobile/app/reader-spike.tsx          # Phase-1 single-active handler +
                                          # bottom card (grow per §3)
apps/mobile/components/ReaderAssetSpikeDOM.tsx # 'use dom' seam + smoke button
fixtures/mobile/reader-kitchen-sink.json  # unchanged this phase (v1)
```

## 6. Definition of done (Phase 4)

- Selection (native handles) on the phone path and the browser fixture
  proposes a candidate; the **mock-labeled chip** runs it through
  `buildExplainRequest` → `onExplain`; diagram node taps join the same flow.
- Single-active handler per §8.3 including `useFocusEffect` blur invalidation;
  the mock panel is a native bottom-card sibling; panel open/close preserves
  reader scroll position.
- Native link confirm shows the URL and hands it off via `Linking.openURL`
  after re-running `isApprovedLink`; cancel leaves the app in place.
- The three remaining §9 client-test rows exist and pass (call-count based);
  the dev fixture still renders and logs at 408px.
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
pending", "panel open/close preserves scroll position", and the
airplane-mode link **handoff**), and the checkpoint-B record. No merges, no
`main` interaction, no workflow files, no Render changes, no new EAS projects.

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

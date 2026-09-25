# Checkpoint B · Phase 3 — session handoff

Status: **historical** — Phases 0–2 merged to `main` via PR #27; **Phase 3 is
implemented** (2026-09-25, branch `arena/01a0d998-temari`). The next session
starts from [M2-B-PHASE4-HANDOFF.md](./M2-B-PHASE4-HANDOFF.md); this file is
retained as the Phase 3 scope record. The design authority remains
[M2-CHECKPOINT-B-PLAN.md](./M2-CHECKPOINT-B-PLAN.md) (v2, review-corrected).

## 0. Suggested opening prompt for the next session

> Continue Temari's M2 checkpoint B from
> `docs/mobile/M2-B-PHASE3-HANDOFF.md`. Read it and
> `docs/mobile/M2-CHECKPOINT-B-PLAN.md` §7 first. Phases 0–2 are merged via
> PR #27; implement **Phase 3 only** (unified sanitizer pipeline + explicit
> link policy + fixture rewiring + security-test rework) on this session's
> assigned branch. Honor every review correction listed in the handoff §4.
> Keep `NoteViewer.test.tsx` green and unchanged. Run the §6 gates before
> stopping and write a Phase 4 handoff the same way. Do not implement Phase 4/5,
> persistence, real AI, or merge without an explicit checkpoint.

## 1. Where things stand

| Phase | State | Evidence |
| --- | --- | --- |
| 0 · A phone evidence recorded | done, `d4ea872` | `M2-READER-SPIKE.md` — Samsung A32, Android 13, WebView 152.0.x, dev client + preview APK same behavior, no clear anomalies reported |
| 1 · bridge contract + device action smoke | done, `d4ea872` | `src/reader-core/bridge.ts` + 15 tests; smoke 4/4 per user screenshots **on Expo web** (`localhost:8081`) — Android WebView function-prop marshaling is **not yet proven**; a 2-minute on-phone re-smoke sits in the Phase 5 gate |
| 2 · mechanical renderer extraction | done, `f1999ef` | `NoteContent.tsx` (one components map + web/reader skins), `FigureBlock`, `selection/`; `NoteViewer` 797 → 497 lines; **`NoteViewer.test.tsx` byte-unchanged, 25/25** |
| 3 · sanitizer + link policy | **not started** | plan §7 = the scope |
| 4 · selection + single-active mock + native panel | not started (a Phase-1-style minimal panel exists in `reader-spike.tsx`) | plan §8 |
| 5 · full gates + final M2 preview gate | not started | plan §9–10 |

Gates at the merge: `bun run check:reader` clean (17 modules) · `NODE_ENV=test
bun run test` **425/425** · `bun run typecheck:all` green.

Standing scope rules (still in force): no persistence, real AI/paid calls,
SQLite, SecureStore, import UI, or app network calls at checkpoint B. M3 owns
native import/SQLite/Library/Drill; M4 owns real BYOK/API/SecureStore.

## 2. Environment lessons (read before working in the sandbox)

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
  '+refs/heads/*:refs/remotes/origin/*'` (this clone is single-branch `main`),
  find the real remote tip with `git ls-remote origin`, `git reset --soft` to
  it, and re-commit the delta — never force-push over the remote's history.
- `git`/`gh` are authenticated. Never ask for tokens/PATs. Render auto-deploys
  the historical branch `arena/01a09569-temari`, not `main` — merging to `main`
  does not change the live service.

## 3. Phase 3 scope (plan §7 is the authority — this is a map, not a replacement)

One change set (the plan's "separate change"): adopt the shared sanitizer and
the explicit link policy **everywhere**, rewire the fixture to `NoteContent`,
and rework the security tests. File-by-file:

```text
src/reader-core/NoteContent.tsx    # pipeline → unified sanitized list (§7.1 diff)
                                   # + linkMode prop, `a` renderer matrix (§7.3)
src/reader-core/sanitize.ts        # schema deltas + rehypeTaskListInputs pre-filter (§7.2)
src/reader-core/reader.css         # styles for the shared-structure reader classes
                                   # (reader-callout/-label/-quote/-pre/-link, figure-wrap…)
src/reader-core/NoteContent.test.tsx  # linkMode matrix; hostile/task-list cases
src/reader-core/FixtureMarkdown.*  # retire: fixture mounts NoteContent
src/dev/reader-fixture.tsx         # skin="reader" + linkMode="native-action"
                                   # + mock onOpenLink/onExplain (dev panel)
scripts/smoke-reader.mjs           # fixture path through NoteContent
src/components/notes/NoteViewer.test.tsx  # MUST stay byte-unchanged and green
```

Pipeline end state (plan §7.1):

```diff
- [rehypeRaw, rehypeNoteRepairs, rehypeNoteCallouts, rehypeKatex, rehypeNoteAnchors]
+ [rehypeRaw, rehypeTaskListInputs, [rehypeSanitize, readerSchema],
+  rehypeNoteRepairs, rehypeNoteCallouts, rehypeNoteAnchors,
+  [rehypeKatex, { trust: false, maxExpand: 100, maxSize: 20 }]]
```

Link policy end state (plan §7.3): `linkMode?: 'disabled' | 'web' |
'native-action'` (default `'disabled'`), `skin` presentation-only,
`isApprovedLink` (bridge.ts) is the single URL rule for rendering **and**
native validation, native links are real `<button type="button">`, and the one
confirmation is native ("hands the URL to the operating system outside the
reader" — `Linking.openURL` may open an associated app).

| `linkMode` | `https:` | scheme-less (`#sec-1`, `/app`) | `//host`, `http:`, other schemes |
| --- | --- | --- | --- |
| `disabled` | inert text | inert text | inert text |
| `web` (only `NoteViewer`) | `<a target="_blank" rel="noopener noreferrer">` | local path/fragment → `<a>` | inert |
| `native-action` | `<button type="button">` → `onOpenLink` | inert | inert |

## 4. Review corrections — the traps, not the summary

1. **Inputs**: an attribute allowlist filters attribute *values*, not elements,
   and hast-util-sanitize's default `requiredAttributes` handling can surface a
   disallowed text input as a **disabled checkbox**. Do not rely on schema
   rules alone: a small `rehypeTaskListInputs` filter **before** sanitization
   removes every non-checkbox `input` entirely and forces surviving checkboxes
   `disabled`. Test checked/unchecked task lists **and** the fixture's hostile
   `<input name="credential" value="FAKE-ONLY" />` (must disappear).
2. **Comments in `sanitize.ts` are currently imprecise** — fix while there:
   `protocols: {}` does not "deny every URL" (URLs vanish because `href`/`src`
   are not in the per-tag `attributes` allowlist); sanitization does **not**
   always preserve text (`strip` elements lose their contents). Therefore the
   seed-note text-equality test (plan §9) is **supplementary** coverage only.
3. **Web deltas to document in the checkpoint-B record** (intentional): note
   **images** stop rendering (schema has no `img`, consistent with M2's
   remote-image policy); exotic authored tags (`<mark>`, `<abbr>`, `<details>`)
   unwrap to text. `javascript:`-style links are **not** a new change —
   `react-markdown`'s default `urlTransform` already nulls them before
   components render; the sanitizer is still required for raw-HTML event
   handlers, forms, frames and URL attributes.
4. **Sanitizer protocol checks are not an HTTPS validator**: scheme-less and
   `//host` values pass protocol filtering. `isApprovedLink`
   (`src/reader-core/bridge.ts`) rejects relative, fragment-only,
   protocol-relative, credentials-in-URL and every non-`https:` scheme — call
   it at render time and again natively.
5. **`linkMode` is explicit**; an omitted `onOpenLink` must never fall back to
   navigable anchors in a native reader. Native-action without a handler
   renders inert content.
6. **Buttons split (security tests, plan §7.4)**: untrusted *authored*
   buttons/inputs/forms must be removed; trusted *application chrome* is now
   expected — link action buttons (`native-action`) and the `FigureShell.Error`
   "Show source" disclosure. The fixture suite's blanket `button`-is-null and
   `a, [href]`-is-null assertions must be re-scoped accordingly. Note the
   kitchen-sink's `https://example.invalid/` link becomes a trusted action
   button in `native-action` mode — its URL may then appear as inert data in
   markup (that is not a fetch; CSP `img-src/connect-src` still block the
   network), and the old `not.toContain('example.invalid')` assertion must be
   rewritten around that distinction.
7. **One confirmation, native** (plan §7.3): no DOM confirm bar for links; the
   mock Explain chip stays DOM-side and must be labeled as mock (D3).
8. **`NoteViewer.test.tsx` stays byte-unchanged.** The web pipeline becomes
   sanitized in this phase and that suite must still pass — if a case fails,
   fix the schema/filter, never the test. (Its evidentiary role: SSR markup
   only; interactions are covered by the client-side tests.)

## 5. Key file map (as merged)

```text
src/reader-core/
├── bridge.ts                # ExplainRequest/OpenLinkRequest, bounds, build/validate, isApprovedLink
├── NoteContent.tsx          # shared renderer: one map + web/reader skin tokens (Phase 2 shape)
├── FixtureMarkdown.tsx      # the spike renderer to retire this phase
├── sanitize.ts              # readerSchema (to extend) — pre-filter goes beside it
├── FigureBlock? → diagrams/FigureBlock.tsx   # fence routing + legacyFigure slot
└── selection/segmentTerm.ts # termAtOffset/contextWindow (bounds 48 / 120)
src/components/notes/NoteViewer.tsx        # wrapper only (497 lines) — hands off §0 of the plan
src/components/diagrams/LegacyEditorialDiagram.tsx  # web-only legacy (D4)
apps/mobile/app/reader-spike.tsx           # Phase-1 mock panel + single-active handler (Phase 4 grows it)
apps/mobile/components/ReaderAssetSpikeDOM.tsx      # 'use dom' seam; smoke button (Phase 4 removes/keeps dev-only)
fixtures/mobile/reader-kitchen-sink.json   # id "m2-reader-kitchen-sink-v1" — shared fixture
```

## 6. Definition of done (Phase 3)

- One pipeline (unified list above) used by web and the fixture; `FixtureMarkdown`
  retired; fixture renders `NoteContent` (skin `reader`, `linkMode`
  `native-action` against mock handlers) as the fast loop.
- `rehypeTaskListInputs` behavior per §4.1 with tests; schema comments corrected.
- Link matrix tests per §7.3 across all three `linkMode`s (incl. `native-action`
  without a handler stays inert — the review's client-test row).
- Security suite re-scoped per §4.6 (authored vs trusted), hostile HTML suite
  still green, fake credential-shaped authored text still visible
  (sanitization is not redaction).
- `NoteViewer.test.tsx` byte-unchanged and green; seed-note text-equality test
  added as supplementary.
- Gates: `bun run check:reader` · `NODE_ENV=test bun run test` (all green, count
  reported) · `bun run typecheck:all` — and at the integration point only
  `NODE_ENV=production RENDER=true bun run build:render` (it already runs the
  test suite; don't double-run).

## 7. After Phase 3

Phase 4 (plan §8): selection safeguards (container-scoped, capture-before-focus,
inclusive bounds with the 302→300 context clamp already in `bridge.ts`),
`memo`-stable `NoteContent`, the **single-active-request** handler (check-and-set
`activeRequestId` *before* starting the mock; absorb submissions while pending
even with other ids; `aliveRef.current = true` in effect setup; `useFocusEffect`
invalidation; try/catch/finally), native bottom-card panel as a sibling of the
reader (not a Modal), diagram taps into the mock Explain flow, and the review's
client-side test rows (rapid submissions invoke the mock **once** — assert call
counts; Close/blur + late completion; invalid payload starts no work). Phase 5
(plan §9–10) is the full gate matrix + phone checklist (which now also carries
the Phase-1 marshaling re-smoke and "Close while pending", "panel open/close
preserves scroll position", "airplane-mode link **handoff** is success").

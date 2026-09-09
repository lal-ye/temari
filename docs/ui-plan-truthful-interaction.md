# UI Plan — Truthful feedback, predictable control, and reading continuity

Status: **Proposed** · Date: 2026-09-08 · Branch: `arena/01a0809f-temari`
· Reviewed against: `main` @ `f34c42f`

This plan turns the critical UX assessment of the interaction-design report
into scoped work. The report compared Temari against the "Invisible Details of
Interaction Design" guide ([Rauno Freiberg, 2023](https://rauno.me/craft/interaction-design):
swipe commit timing, responsive gestures, spatial consistency, frequency and
novelty, scroll landmarks, touch content visibility, implicit input, scrolling
ownership — plus the multi-pointer ownership example the review cites from
Emil Kowalski's gesture work). The assessment's conclusion, which this plan
adopts:

> Change "strong, ahead of the guide, one gap" to **"promising foundations,
> with important correctness, accessibility, and continuity work remaining."**

Every claim below was re-checked against the source. Line numbers refer to
`f34c42f`. **This is a source review; nothing here has been device-tested.**
Where the review was right, the evidence is cited. Where the code is worse
than the review says, that is called out, because the fix has to cover it.

---

## 0. Vocabulary for statuses

The report used ✅ to mean "a mechanism exists." From here on, every item
carries one of these, and only device work can move an item to the top one:

| Status | Meaning |
|---|---|
| **Verified on devices** | Exercised on the device matrix in §7 by a human. |
| **Implemented; source-reviewed** | Code exists and reads correctly; not yet exercised on devices. |
| **Hypothesis requiring testing** | A tuning value or behaviour that only a device can confirm. |
| **Incomplete** | Mechanism is partial, misleading, or contradicts itself. |
| **Not applicable** | The guide's example has no counterpart in Temari. Not a pass. |

The report's own rows should be rewritten as
**learner task → intended behaviour → observed implementation → failure cases → evidence → next action**.
§8 gives the corrected rows.

---

## 1. Pull-to-refresh simulates work — remove it

**Status: Incomplete (and misleading).**

Learner task: "Get a better version of this Note."
Intended: the Note is regenerated and the learner can compare.

Observed:

- `NotesManager.tsx:339-342` — the supplied `onRefresh` is
  `await new Promise(r => setTimeout(r, 850))`. Nothing is generated, saved, or
  changed.
- `NoteViewer.tsx:331-337, 575` — after that wait the banner reads
  **"Note Refreshed with ተማሪ AI"**, and while waiting,
  **"Re-summarizing with ተማሪ AI..."** (`:588`). Both are false. This is the
  exact class of "fabricated data" the taste-skill audit already removed once
  (the hardcoded streak).

Failure cases the review did not reach:

- **The "at top" guard is dead.** `handlePullDownStart` (`:296-304`) reads
  `containerRef.current?.scrollTop`, but that element is `overflow-hidden`
  (`:534`) and never scrolls; the real scroller is `.app-main`
  (`App.tsx:372`). `scrollTop` is always `0`, so the pull arms on **every**
  pointerdown anywhere on the Note, at any reading depth.
- **It fires on desktop text selection.** The handlers are pointer events
  (`:528-530`), which include the mouse. Dragging a text selection downward
  grows the banner; past ~70px of travel (`pow(d, 0.76) * 2.2 >= 55`) release
  shows the fake success. That directly collides with the select-to-Explain
  flow on the same surface.
- Pointer **and** touch handlers are both attached (`:528-533`), so touch
  devices run every handler twice.
- There is no `pointercancel` path for the pull; if the browser takes the
  touch for scrolling, `pullStartRef`/`isPulling` dangle until the next
  pointerup.
- The **8px cancellation applies to long-press** (`:278-287`), not to the
  pull; the report attributed it to the wrong recogniser.

Next action (Phase 1):

1. **Delete the pull-to-refresh interaction**: the handlers, `pullY` /
   `isPulling` / `isRefreshing` / `refreshSuccess` state, the banner markup,
   and the `onRefresh` prop. Nothing else depends on it.
2. If regeneration is wanted, build it as an explicit **Regenerate note**
   button in the action bar. It needs the original Material, which
   `StoredNote` does not keep (`types.ts:15-24`); add an optional
   `material?: string` to the Note when generated, run `ai.generateNotes`
   with `GenerationProgress`, keep the original, and show the draft as a
   **replacement preview** with Keep / Discard. Attribute `source` as
   everywhere else. This is a separate, later workstream — do not gate the
   removal on it.

Report revision: mark refresh **Incomplete — unfinished functionality**, not
an example of delightful interaction.

---

## 2. Pointer ownership and animation interruption are both required

**Status: Incomplete.**

The report's clearest conceptual error was treating "block a second finger"
and "re-grab an animating element" as alternatives. They are compatible and
Temari needs both:

- **Multi-pointer ownership**: one pointer owns a gesture; a second
  simultaneous contact must not move, finish, or reset it.
- **Interruption**: after release, a *new* gesture may grab the settling
  element and continue from its live position.

Pointer capture does not give exclusivity: `setPointerCapture(id)` routes
that one pointer's events; a second pointer still delivers its own
`pointerdown`. `pointerId` identifies a contact, not which finger it is.

Observed in `FlashcardView.tsx`:

- **No ownership.** `handlePointerDown` (`:203-226`) never checks an active
  pointer; a second finger re-runs it, overwrites `pointerStartRef`, and
  resets the gesture. `handlePointerMove`/`Up` (`:228-301`) accept any
  `pointerId`. No `isPrimary` / button check. No `onLostPointerCapture`.
- **Interruption state is set and then immediately reset in the same
  handler** (`:206-220`): `setGestureAxis(...)` and
  `hasDraggedRef.current = true` on interruption, then unconditionally
  `hasDraggedRef.current = false` (`:218`) and `setGestureAxis(null)`
  (`:220`). Consequences, which the report missed:
  - With the axis `null`, the transform is `undefined` (`:519-524`) and
    `transition: none` (`:525`), so the card **hard-cuts to rest** on the
    interrupting pointerdown, then **jumps back out** to `base + dx` once the
    8px re-lock (`:237-244`) picks an axis.
  - A tap during the settle has `hasDragged === false`, so `handlePointerUp`
    **flips the card** (`:277-278`) instead of catching it.
- The spatial plan's WS-5.3 ("track settle as a WAAPI animation and
  `.cancel()` it on pointerdown") is marked shipped in
  `ui-plan-spatial-consistency.md` but was implemented as a CSS transition
  plus a computed-transform read; given the above it does not work as
  specified. Update that plan's DoD line.

Specification to implement:

```
activePointerId: number | null          // owner; null = idle
down(e):   if activePointerId !== null → ignore
           if !e.isPrimary or e.button !== 0 → ignore
           activePointerId = e.pointerId; capture it
           if surface is mid-settle: base = live offset, axis = from live,
             hasDragged = true, interrupting = true      // keep it
move(e):   if e.pointerId !== activePointerId → ignore
up(e):     if e.pointerId !== activePointerId → ignore
           commit by the existing rules; a tap while interrupting does NOT flip
cancel / lostpointercapture:
           if e.pointerId !== activePointerId → ignore
           clear ownership, settle to rest, commit NOTHING
```

Implementation shape: extract a **pure gesture reducer**
`src/components/quizzes/flashcardGesture.ts` —
`reduce(state, event) → { state, effect? }` with events
`down | move | up | cancel | lostCapture` and effects
`next | prev | rateHard | rateEasy | flip`. The component becomes a thin
adapter (read live transform, dispatch, apply effect). This is the only way
to unit-test ownership, interruption, thresholds and velocity in this repo,
which has no jsdom (see `designSystem.test.ts` header). Keep the
lightweight-vs-destructive split from ADR-0005 (navigation may commit
mid-swipe; rating commits on release).

Hypotheses requiring device testing (unchanged values, now labelled
honestly): `DISTANCE_THRESHOLD = 65`, `VELOCITY_THRESHOLD = 0.4 px/ms`, the
`0.25` edge damping.

Report revision: replace "both correct, different intent" with
*"Animation interruption is intentional, but multi-pointer ownership and
interruption-state preservation still need implementation verification."*
A comment is not the fix.

---

## 3. Call things what they are: proxy vs. acknowledgment vs. preview

**Status: touch-content proxy Incomplete; the rest are fine under their real names.**

The guide's proxy solves *hidden information beneath the finger* (the caret
loupe, the enlarged keyboard key). Temporary feedback is not automatically a
proxy. Reclassify:

| Report example | Real classification | Status |
|---|---|---|
| Pulse ring (`NoteViewer.tsx:255-256`, `index.css:374-384`) | Press acknowledgment / progress | Implemented; source-reviewed |
| Flashcard tint + "Release to rate …" label (`:570-597`) | Preview of the intended outcome | Implemented; source-reviewed |
| Modal FLIP morph (`Modal.tsx:120-146`) | Spatial continuity | Implemented; partial — see note |
| Enlarged / offset chip showing the recognised term | **Touch-content proxy** | **Incomplete — does not exist** |
| Video scrubbing | — | Not applicable |

Note on the morph: only the X button, backdrop and Escape run the exit morph
(`requestClose`). Every in-panel Done / Cancel button calls the parent's
`onClose` directly (`ExplainTermModal.tsx:128`, `NotesManager.tsx:476`, …),
and `App`'s Escape handler nulls `explainTermData` immediately (`App.tsx:248-254`),
so the explainer never shrinks back to its word. Small; fix in Phase 4 by
exposing a `useModalClose()` from `Modal` so in-panel buttons take the exit
path.

Problems with the term recogniser (`getWordAtPoint`, `NoteViewer.tsx:43-101`):

- The ring never shows **which word** was recognised. On a phone the word is
  under the finger for the whole 300ms.
- Long-press **opens the modal and starts generation immediately**
  (`:266-269`) — no confirmation. Mouse selection, by contrast, shows the
  "Explain … ?" tooltip first (`:237-247`, `:674-694`). Two paths, two
  behaviours.
- `context` is the parent's **first 200 characters** (`:78, :88, :97, :244`),
  not a window around the term.
- Word boundary regex `/[\w\-\u1200-\u137F]/` (`:64`): `\w` is ASCII-only, so
  `café` splits at the accent; the Ethiopic block **includes the punctuation
  `፡` U+1361 (wordspace) and `።` U+1362 (full stop)**, so adjacent Amharic
  words are glued into one "term" (verified: the regex matches `\u1361`).
- The ring appears on **every** pointerdown, including every desktop click in
  the Note (`:256`), at `z-index: 9999`. That is the 100+/day tier of the
  motion budget; the taste-skill backlog item to gate it is still open.
- The 300ms timer is not cleared on unmount; `onHighlightTerm` can fire after
  the Note changes. On iOS the app's 300ms press races the platform's own
  text-selection long-press on a `select-text` surface — **hypothesis
  requiring testing**.

Next action (Phase 2):

1. **Segmentation**: `src/utils/segmentTerm.ts` — `Intl.Segmenter(locale,
   { granularity: 'word' })` with `isWordLike`, falling back to a Unicode-aware
   regex (`\p{L}\p{M}\p{N}`) where the Segmenter is missing. Context = a
   window of ±120 characters around the term inside the parent text. Unit
   tests with English, `café`, and `ተማሪ፡መጽሐፍ` (expect `ተማሪ`).
2. **Proxy**: during the press, render a small chip **above** the contact
   point with the candidate term, and highlight the actual text range
   (`Range` → `getClientRects()` → an absolutely positioned highlight, or the
   CSS Highlight API where available). Ring stays as acknowledgment only,
   and is gated to touch (`pointerType === 'touch'`).
3. **Confirmation**: long-press ends in the same **Explain** tooltip the
   mouse path already uses; generation starts only on Explain. One path.
4. Clear the timer on unmount and on Note change.

Report revision: acknowledge useful feedback, mark obscured-target
confirmation **Incomplete**, and move video scrubbing to **Not applicable**.

---

## 4. Attribution is strong at the service; the UI still owes cancellation and a reason

**Status: service Implemented (source-reviewed, unit-tested); UI cancellation Incomplete; failure reason Incomplete.**

What is genuinely good: `withFallback` (`ai/index.ts:52-64`) returns
`GenerationResult<T>` with `source`, propagates `AbortError` instead of
substituting content, and `aiGenerator.test.ts` covers model/offline
attribution, abort propagation, and recall-level labelling of offline Exam
questions. Keep saying so.

### 4a. Service cancellation is not UI cancellation

- `ExplainTermModal.tsx:25-52` ignores late results via `isMounted` but passes
  **no `signal`** to `ai.explainTerm`. Closing the explainer does not cancel
  the request. The transport already accepts a signal (`http.ts:27-37`,
  `contracts.ts:71-75`).
- In the Notes / Quizzes / Exams generate modals the **Cancel button is
  `disabled={isGenerating}`** (`NotesManager.tsx:477`, `QuizzesManager.tsx:367`,
  `ExamsManager.tsx:467`). The learner cannot cancel any generation.
- The server never aborts upstream on client disconnect (`server.ts` has no
  `req.on('close')` / `AbortController`). Client abort must not be described
  as cancelling Provider computation.

Next action (Phase 1 for the explainer, Phase 2 for the generate modals):

1. `ExplainTermModal`: `const ctrl = new AbortController()` in the effect;
   pass `signal: ctrl.signal`; `return () => ctrl.abort()`. In `.catch`,
   `if (err.name === 'AbortError') return;` — cancellation is not an error
   and must not paint the error box.
2. Generate modals: keep Cancel enabled during generation; wire an
   `AbortController` per run; Cancel aborts, closes, and shows no error toast.
   Add a **Cancel** affordance inside `GenerationProgress` (it already owns
   the elapsed counter, so it is the natural home).
3. Optional (Later): server passes `req` close → `controller.abort()` into
   SDK calls that accept a signal. Until then, copy must say "stopped
   waiting", not "cancelled the model".

### 4b. Provenance ≠ privacy, and provenance ≠ reason

The offline banner discloses **how content was produced**. The guide's App
Switcher blur **conceals sensitive content in a context**. Different
responsibilities; Temari is not "ahead" of that example, it does not address
it. (Nothing to build: study notes are not bank statements. Mark **Not
applicable**, honestly.)

Separately, `withFallback` catches **every** non-abort error — a 401 bad key,
a 429, an unknown model, an HTML 404 from Netlify — and every banner then
says *"No AI Provider was reachable"* (`OfflineBanner.tsx:19`,
`NotesManager.tsx:211`, `ExplainTermModal.tsx:91`). For a rejected key that
sentence is false, and the recovery it suggests ("Reconnect") is wrong.

Next action (Phase 2):

1. Extend the result: `GenerationResult<T> = { source, value,
   fallback?: { kind: FailureKind; message: string } }`, populated in
   `withFallback` when `source === 'offline'`. Reuse
   `diagnoseConnectionError` (`ai/diagnoseError.ts`) with `provider` /
   `hasKey` / `isLocal` from `resolveCredentials(getSettings())`. Tests in
   `aiGenerator.test.ts`: 401 → `bad-key`; fetch `TypeError` → `network`;
   HTML 404 → `no-server`; abort → still throws.
2. `OfflineBanner` takes `fallback` and renders **provenance + reason +
   the right action**:

   | kind | Sentence | Action |
   |---|---|---|
   | `network`, `no-server`, `local-unreachable`, `timeout` | Offline draft. Temari could not reach {Provider}. | **Retry** |
   | `missing-key`, `bad-key`, `unknown-model` | Offline draft. {Provider} rejected the request ({title}). | **Open Provider settings** (`setOpenModal('api-key')`) |
   | `rate-limited`, `quota` | Offline draft. {Provider} is limiting requests right now. | **Retry later** |
   | `unknown` | Offline draft. {Provider} returned something Temari could not use. | **Retry** |

   "Check Provider settings" and "Reconnect" are never interchangeable.
3. **Decided (2026-09-08): label first.** Auto-fallback stays; the banner
   names the reason and offers the matching action. Revisit a
   prompt-before-fallback for configuration failures after seeing how often
   they occur. The review is right that auto-fallback is a product policy,
   not evidence of intent — the label is what makes that policy honest.

---

## 5. "Find your place" is a reading-continuity feature, not an outline

**Status: Implemented; source-reviewed (2026-09-08).** Items 1–3 below are
on `arena/01a0809f-temari`; item 4 stays optional. jsdom-smoked (33 checks:
restore on remount, user scroll wins over late restore passes, jump → pill →
return, dismiss, edited/missing-anchor/switched/deleted Note). Device
verification owed for the font-swap and viewport-width cases.

An outline answers *"where can I go?"* A reading landmark answers *"where was
I before this detour?"* The guide's example preserves the **departure
position**; a heading link or back-to-top button does not.

Why it needs state above the hub: `App` conditionally mounts each hub
(`App.tsx:374-392`), the selected Note is `NotesManager` local state
(`NotesManager.tsx:42`), and the scroller is `.app-main` (`:372`). Switching
to Quizzes and back today loses both the Note and the position.

Next action (Phase 3), in order of value:

1. **Reading restoration across hubs and reloads.**
   New ephemeral module `src/services/readingPlace.ts` (same
   `useSyncExternalStore` pattern as `toast.tsx` / `confirm.tsx`; persisted to
   `sessionStorage`, keyed by `subjectId`). It is UI/session state, not study
   data, so it stays out of `studyStore` (ADR-0001 is about study data; if it
   ever needs to roam across devices, it moves into the store as one op).

   ```ts
   interface ReadingPlace {
     noteId: string;
     contentRevision: string;   // StoredNote.updatedAt
     anchorId: string | null;   // nearest heading above the viewport top
     offset: number;            // px below that heading
   }
   ```

   - `NotesManager` reads `noteId` from the place instead of defaulting to
     `notes[0]` (falls back to `notes[0]` if that Note is gone), and clears
     the place when the placed Note is deleted. ✅
   - Heading ids are assigned **by index** (`sec-1`, `sec-2`, …) — index ids
     survive duplicate headings and Amharic text, and `contentRevision`
     guards against edits moving them. ✅ **Where changed:** not in the
     `h1/h2/h3` renderers as first planned but in a rehype plugin
     (`rehypeNoteAnchors.ts`). The renderers are memoised, so a counter
     declared in the component body is captured once and never reset —
     the smoke test's first run produced `sec-6…sec-10` on the second
     render. The plugin runs once per parse with fresh state, so ids are a
     pure function of the Markdown. The same defect existed for figure
     numbering (`figureCounter`), which now comes from the plugin too.
   - `useReadingPlace` records `{anchorId, offset}` on a frame-throttled
     scroll of the nearest scrolling ancestor (found from `contentRef`, not
     hard-coded), measured from the Note body's top so the hub header
     never leaks into offsets. ✅
   - Restore after mount, again after `document.fonts.ready`, two
     `requestAnimationFrame`s and a 600 ms late pass, clamped to
     `scrollHeight`; the passes stop the moment the learner scrolls. If
     `contentRevision` differs or the anchor is missing: restore the Note
     only, start at the body top, and replace the stale place. ✅
   - Viewport changes: record only; never restore on resize. ✅
2. **Return after a jump.** Before an outline jump, the current place is
   snapshotted (`markReturnPoint`); a **Return to reading** pill (sticky,
   inside the Note card, labelled with the departure heading) stays until
   used, dismissed, or the Note changes — not a timed toast. Pure helpers
   `pickAnchor` / `resolvePlace` are unit-tested (`readingPlace.test.ts`). ✅
3. **Compact outline.** **On this page** is a Base UI `Popover` from the
   action bar (`OnThisPage.tsx`, `modal={false}`, shown only when a Note
   has ≥ 2 headings); headings are collected from the DOM in a layout
   effect keyed on `note.id` + `updatedAt`. Not another permanent column
   (ADR-0006). ✅
4. **Optional manual bookmark.** **Mark my place** — the guide's landmark —
   only if 1–3 prove insufficient. Not built.

Tested (jsdom): duplicate headings, Amharic headings, an edited Note, a
deleted Note, a missing anchor, switching Notes. Owed on devices: slow font
load and narrow ↔ wide viewport changes (the anchor+offset model is designed
for them, but only a browser can show whether the late passes are enough).

Report revision: describe this as a *reading-continuity feature*, not a
"zero-dependency outline fix".

---

## 6. Fundamentals the report skipped

### 6a. Modal focus and shortcut ownership — **Incomplete**

`Modal.tsx` sets `role="dialog"`, `aria-modal`, `aria-label` and handles
Escape (`:148-155, :174-176`) but does **no initial focus, no containment, no
restoration**, and does not inert the page behind it. Keyboard and
screen-reader users can Tab straight out of every dialog in the app.

Shortcut ownership is broken in two places:

- `FlashcardView.tsx:87-103` registers a **window** `keydown` listener with no
  editable-target guard and no modal guard. With the explainer open over a
  Drill: Space/Enter flip the card underneath; **ArrowRight on the last card
  calls `finishDrill()` and records an Attempt** (`:105-113, :161-170`).
  `App`'s early return (`App.tsx:248-254`) does not own that listener.
- `App`'s own guard only knows `openModal | confirmDeleteSubjectId |
  explainTermData`. Hub-local modals (Generate Notes/Quiz/Exam, the edit
  form) and `confirm()` are invisible to it, so **keys `1`–`5` still switch
  hubs while a Generate modal is open**, unmounting it mid-generation.

Next action (Phase 1):

1. **Spike (½ day): rebuild `Modal` on the `@base-ui/react` Dialog already in
   the repo** (`ui/dialog.tsx`, used by the command palette). It provides
   initial focus, trap, restoration, `inert`/scroll lock and Escape. Keep the
   FLIP morph by animating the Popup element with WAAPI exactly as today. If
   the open/close lifecycle fights the morph, fall back to a hand-rolled
   trap (~60 lines: focus first focusable or the panel, cycle Tab, restore
   `document.activeElement` on close, set `inert` on `#root`'s siblings).
   Base UI is a dependency already; this does not touch ADR-0004's "no
   animation library".
2. **One modal registry.** `Modal` (and `CommandDialog`) register open state
   in a tiny external store; `useAnyModalOpen()` is consulted by `App`'s
   listener and by the Drill. This makes ownership explicit regardless of
   where focus is.
3. **Move the Drill's keys off `window`.** Attach `onKeyDown` to the Drill
   root, make the card surface `tabIndex={0}` and focus it on mount (an
   accessibility win in itself: the card becomes keyboard-flippable), and
   ignore `e.defaultPrevented` and editable targets. Keys pressed inside a
   dialog no longer reach the Drill at all.
4. Replace the four remaining `window.confirm` calls
   (`QuizzesManager.tsx:110`, `ExamsManager.tsx:171`, `ExamTakingView.tsx:249`,
   `AnalyticsView.tsx:78`) with the shared `confirm()` so they, too, are
   registered modals.

**Acceptance test:** open the explainer during a Drill; type, press Space,
Enter, ← and →; nothing below the dialog changes and no Attempt is recorded.
Tab never leaves the dialog; closing returns focus to the word/control that
opened it.

### 6b. Browser scrolling and zooming — **Decided: option A (2026-09-08)**

> **Decision:** option A. `touch-action: pan-y pinch-zoom` on the card
> surface; horizontal swipe navigates; Need Practice / Mastered! are the
> rating controls; no vertical rating swipe. Implemented behind one constant
> (`ALLOW_VERTICAL_RATING` in `FlashcardView.tsx`) that the reducer, the tint
> previews, the hint copy and `touch-action` all key off, so the decision can
> be revisited without re-plumbing. Device verification still owed.

`touchAction: 'none'` on the card surface (`FlashcardView.tsx:528`) is a
tradeoff, not a win over "hijacking": it disables browser panning **and
pinch-zoom** on an `h-80` region that is most of a phone's viewport. A
learner who lands a thumb on the card cannot scroll the page.

Recommended default (the review's): `touch-action: pan-y pinch-zoom`,
horizontal swipe for navigation, the existing **Need Practice / Mastered!**
buttons as the primary rating controls, and **no vertical rating swipe by
default**. The browser then claims vertical pans and fires `pointercancel`,
which the reducer treats as "commit nothing".

Options for the vertical swipe the product currently advertises ("Swipe up
for hard, down for easy", `:610`):

| Option | Effect | Cost |
|---|---|---|
| **A. Remove vertical rating swipe** (recommended) | Native scroll/zoom everywhere; rating by buttons | Loses a designed gesture; update hint copy |
| B. `pan-y pinch-zoom` on the front face, `none` on the back face only | Keeps rating swipe where it lives | Two behaviours on one card; page still traps when flipped |
| C. Keep `none`, add explicit top/bottom margins to scroll by | No behaviour change | Does not fix zoom; still traps |

Whatever is chosen: **Hypothesis requiring device testing** on iOS Safari
and Android Chrome, including diagonal starts and a pinch during a settle.

### 6c. Reduced motion must cover JavaScript effects — **Incomplete**

`fireConfetti()` (`utils/confetti.ts`) has no reduced-motion guard; every
other effect does. Put `if (prefersReducedMotion()) return;` **inside the
utility** so no caller can forget. Also `finishDrill` is reachable from the
keyboard (§6a), so the guard matters beyond touch.

Call confetti **celebration** (the rare/first-run tier of the motion budget).
It is not evidence of fidgetability and no more repetitive motion should be
added to match the article.

Housekeeping in the same commit: the card settle uses a literal
`'transform 260ms cubic-bezier(…)'` (`:525-527`) against DEVELOPING.md's
"components reference `var(--dur-*)`, never literal milliseconds"; move it
to a class / token. Gate the pulse ring to touch (§3).

---

## 7. Verification protocol

The strategy is the repo's own: **make the interface the test surface** by
extracting pure logic, then use a short human device matrix for what only
devices can show.

> **Update (2026-09-09):** this section was written when the repo had no
> jsdom, and the throwaway harness recommended in §9.6 has since been
> promoted. `jsdom` + `@testing-library/react` are devDependencies; a file
> opts in with `// @vitest-environment jsdom` (`FlashcardView.test.tsx`).
> The layering and when to use each layer is in
> [DEVELOPING.md §Testing](../DEVELOPING.md). Pure extraction remains the
> default — jsdom is for behaviour that only appears when the real component
> is driven. What follows below is unchanged, and still describes the node
> layer.

Unit tests (vitest, node):

- `flashcardGesture.test.ts` ✅ — second pointer ignored; `lostpointercapture`
  commits nothing; interrupted settle keeps axis/offset; tap during settle
  does not flip; distance and velocity commits; rating commits only on
  release.
- `segmentTerm.test.ts` ✅ — English, `café`, `ተማሪ፡መጽሐፍ`, digits/hyphens,
  context window bounds (both the Segmenter and the regex fallback).
- `readingPlace.test.ts` ✅ — anchor picking, revision mismatch → top,
  missing anchor → top, clamp, store persistence and return-point rules.
- `rehypeNoteAnchors.test.ts` ✅ — ids by document order through the real
  unified pipeline: duplicates, Amharic, raw HTML headings, h4 ignored,
  figure numbering; plus source guards that `NoteViewer` wires the plugin
  and keeps no render-scoped counter.
- `aiGenerator.test.ts` ✅ — `fallback.kind` for 401 / 429 / 404 / no-server /
  missing-key; abort still throws; `signal` reaches `fetch`.
- `designSystem.test.ts` — assert `confetti.ts` imports
  `prefersReducedMotion` (cheap text guard, same style as the CSS guards).

Device matrix (required before any item is marked **Verified on devices**):

| Surface | What to exercise |
|---|---|
| iOS Safari (phone) | Long-press vs native selection; scroll/zoom on the card; two-finger contact during a drag; pinch during a settle; `pointercancel` paths |
| Android Chrome (phone) | Same, plus back-gesture edge conflicts with horizontal swipe |
| Desktop mouse + trackpad | Text selection on the Note (no banner, no ring); settle interruption by click |
| Keyboard only | §6a acceptance test; Tab order inside every dialog; focus restoration |
| VoiceOver / NVDA | Dialog announcement; the card is focusable and its state is announced |
| `prefers-reduced-motion: reduce` | Confetti absent; morphs absent; nothing else regresses |

Commands, as always: `npm run lint`, `npm test`, `npm run build`.

---

## 8. Corrections to the report

Replace the report's verdict column with these rows.

| Report claim | Corrected status | Evidence |
|---|---|---|
| Pull-to-refresh: delightful kinetic detail ✅ | **Incomplete — unfinished functionality** | `NotesManager.tsx:339-342`, `NoteViewer.tsx:575`; dead guard; fires on desktop selection |
| Multi-touch guard vs interruption: "both correct, different intent" | **Incomplete** | no `pointerId` ownership; state reset at `FlashcardView.tsx:218-220` |
| Pointer capture gives exclusive ownership | **Incorrect** | capture is per-pointer |
| Pulse ring = touch-content proxy | Press acknowledgment; proxy **Incomplete** | ring shows no term |
| Flashcard tint / label = proxy | Outcome preview — fine | — |
| Modal FLIP = proxy | Spatial continuity — partial | in-panel buttons bypass the exit morph |
| "We do not have video scrubbing" ✅ | **Not applicable** | — |
| Attribution architecture ✅ end-to-end | Service **Implemented; source-reviewed + tested**; UI cancellation **Incomplete**; failure reason **Incomplete** | `ExplainTermModal.tsx:33`; Cancel disabled during generation; every fallback says "unreachable" |
| Offline banner "ahead of App Switcher blur" | Different concern; **Not applicable** | provenance ≠ concealment |
| Outline = zero-dependency "find your place" fix | **Incomplete**; reading-continuity feature | hub unmount, local `selectedNoteId` |
| Modal accessibility ✅ | **Incomplete** | no focus management |
| Keyboard ownership ✅ | **Incomplete** | Drill window listener; App unaware of hub-local modals |
| `touch-action: none` beats browser hijacking | Tradeoff; **Decision needed** | disables pan and zoom on the card |
| Reduced motion ✅ comprehensive | **Incomplete for JS effects** | `confetti.ts` |
| Confetti = fidgetability | Celebration; not fidgetability | — |

---

## 9. Sequencing

| Phase | Work | Why here | Effort |
|---|---|---|---|
| **1 — Stop lying, take ownership** | §1 remove refresh · §6a modal focus + registry + Drill keys off `window` + `confirm()` migration · §4a explainer abort · §6c confetti guard | Every item is a correctness or accessibility defect visible today; none depends on anything else | ~2–3 days |
| **2 — Predictable control** | §2 gesture reducer with ownership + interruption · §6b `touch-action` decision · §3 segmentation, proxy chip, single Explain path · §4a Cancel in generate modals · §4b fallback reason + banner actions | Builds on the registry (Phase 1) and the reducer is the test surface for the device pass | ~4–5 days |
| **3 — Return learners to their place** | §5 reading place store, restoration, Return-to-reading, On-this-page popover | Needs the Notes surface quiet (Phase 1) and nothing else; largest new behaviour | ~3–4 days |
| **4 — Polish** | in-panel exit morph via `useModalClose()` · pulse ring gating · settle duration token · optional Regenerate note · optional server-side abort · optional Mark my place | Decorative or optional; only after the above is **Verified on devices** | as time allows |

### Definition of done

Phase 1 — **Implemented; source-reviewed** (branch `arena/01a0809f-temari`)
- [x] No pull-to-refresh code remains; text selection on a Note shows no banner.
- [x] Every dialog takes focus on open, traps Tab, restores focus on close (`Modal` on Base UI Dialog; verified in a throwaway jsdom harness, not yet on devices).
- [x] §6a acceptance test passes by construction: the Drill's key handler is scoped to its own element, so a focus-trapped dialog never delivers keys to it; hub shortcuts consult `isAnyModalOpen()`. Guarded by `src/components/ui/keyboardOwnership.test.ts`. Device verification still owed.
- [x] Closing the explainer aborts its request; no error is painted for an abort.
- [x] Confetti does not run under reduced motion.
- [x] Zero `window.confirm` calls in `src/` (all four now use the shared `confirm()`, which stacks and registers correctly; Escape is arbitrated by `isTopmostModal`).

Also landed with Phase 1 because the rebuilt `Modal` made them free: in-panel Cancel/Done buttons close through `ModalCloseButton` (Phase 4's "in-panel exit morph via `useModalClose()`"), and `ApiKeySettingsModal` no longer short-circuits to `null` while closed, so its exit animation and focus restoration run.

Phase 2 — **Implemented; source-reviewed** (branch `arena/01a0809f-temari`)
- [x] A second finger cannot move, finish or reset a drag; `lostpointercapture` commits nothing (`flashcardGesture.test.ts`, 31 cases).
- [x] Grabbing a settling card continues from its live position without a snap; a tap mid-settle does not flip (unit-tested; device verification owed).
- [x] Page scrolls and pinch-zooms with a thumb on the card (§6b option A: `touch-action: pan-y pinch-zoom`; vertical pans arrive as `pointercancel`, which commits nothing).
- [x] Long-press shows the candidate term above the finger (`.term-proxy-chip`) and highlights its range (`.term-range-highlight`); generation starts only on Explain, for both mouse selection and long-press. Ring is touch-only. Timer cleared on Note change and unmount.
- [x] `ተማሪ፡መጽሐፍ` segments to two terms; `café` is one (`utils/segmentTerm.ts` on `Intl.Segmenter`, Unicode-aware regex fallback; context is ±120 chars around the term).
- [x] Every generation can be cancelled ("Stop waiting" in `GenerationProgress`; Cancel enabled during generation as "Stop and close"; `AbortController` per run; abort paints no error). An offline draft names the reason (`GenerationResult.fallback` via `diagnoseConnectionError`) and offers the matching action: **Open Provider settings** for `missing-key`/`bad-key`/`unknown-model`, **Retry** for transport failures, **Try again** for limits. Copy says "stop waiting" — the server does not yet abort upstream.

Also landed with Phase 2: the settle transition moved from a literal `260ms` to `.flashcard-motion` on `var(--dur-panel)` with a reduced-motion override; rating buttons restyled as the primary controls; `OfflineBanner` no longer claims "No AI Provider was reachable" anywhere.

Phase 3 — **Implemented; source-reviewed** (branch `arena/01a0809f-temari`)
- [x] Switch hub and back: same Note, same position (jsdom: remount restores `sec-3 + 40px` exactly; "after fonts load" relies on the `fonts.ready` pass — device verification owed).
- [x] Reload: same Note and position within the tab session (`sessionStorage`, keyed by Subject).
- [x] Outline jump shows **Return to reading**; it returns to the departure position and the pill disappears; Dismiss removes it without moving.
- [x] Edited Note → body top with the place replaced; missing anchor → top; deleted Note → place cleared, `notes[0]` shown; switched Note → top, stale return point dropped.

Also landed with Phase 3: figure numbering moved into the same rehype plugin, fixing "Fig. N" drifting upward on every re-render.

Mock-exam regression pass (pre-PR request) — **Implemented; source-reviewed**; see §9b.
- [x] Time expiry submits and records exactly once; manual Submit works after it.
- [x] Enter on the Submit confirm submits; Delete/Leave confirms keep the safe default focus.
- [x] Retake: hidden when there are no questions; keeps Subject, mix, provenance, a fair time limit; "(Retake)" once; options reshuffled.
- [x] Hub switch / hotkeys / palette / tab close ask before discarding a live exam; Leave button exists; mid-grade unmount records nothing.

---

## 9b. Mock-exam regression pass (2026-09-08)

**Status: Implemented; source-reviewed** — jsdom-smoked end to end (35
checks across two harnesses: expiry, Enter-to-confirm, retake, Subject switch,
Leave, hub-switch guard, mid-grade unmount). Device verification owed only
for the `beforeunload` prompt, which jsdom cannot show.

Requested before the PR closes: "look at the mock exam feature for
regressions, and why Retake and Submit are not working." Findings, in
learner-task order.

| Learner task | Intended | Observed (before) | Root cause | Fix |
|---|---|---|---|---|
| Time runs out | Answers are graded and recorded | Timer reads **00:00**, nothing happens; every **Submit Exam** afterwards is swallowed too | Two copies of the "already submitted" latch. The countdown path set `submittedRef = true` *and then* called `handleSubmitExam`, whose first line saw the latch and returned. Pre-existing on `main` (not a Phase 1–3 regression) and invisible until an exam actually expired. | One latch, owned by `handleSubmitExam`; the countdown just calls it. Source-guarded: the test counts `submittedRef.current = true` occurrences and fails on anything but one. |
| Confirm a submit with the keyboard | Enter submits | Enter closes the dialog and nothing happens | Base UI focuses the first tabbable control, which in this chrome is the **Close** (X) button. Correct default for destructive confirms; wrong for the one the learner just asked for. | `confirm({ initialFocus: 'confirm' })` for Submit only. Delete and Leave keep the safe default (asserted). `Modal` gained an `initialFocus` ref passthrough. |
| Retake a seeded / legacy Attempt | Same paper again | **Retake Exam** button renders and does nothing | `onRetake` was always passed; the handler returned early when `examQuestions` was empty. The seeded "Midterm Practice" attempt has no questions. | Button is omitted when there is nothing to retake. |
| Retake, then submit | Attempt filed under the exam's Subject | Filed under **whatever Subject is active at submit time** | `ExamTakingView` received `activeSubject.id/name` live; the header switcher stays reachable mid-exam. Confirmed in jsdom: switch → submit → wrong `subjectId`. | Subject captured into `takingExam` at start; retakes use the Attempt's own Subject. |
| Retake fidelity | Same conditions | 15-minute limit regardless of original; `cognitiveMix` / `knowledgeUnitTargeted` dropped; title accreted "(Retake) (Retake)"; MCQ positions identical | Retake built a minimal `takingExam`. | `retakeTimeLimit()` reconstructs the smallest offered limit covering the original sitting (22 min → 25); provenance carried; "(Retake)" once; options reshuffled with a fresh seed (grading is by string). |
| Leave an exam | Possible, with a warning | No Leave/Cancel control at all; `onCancel` prop was never rendered | — | **Leave** button → destructive confirm → `onCancel()`, nothing recorded. |
| Switch hub / press 1–5 / palette during an exam | Warned first | Exam unmounted silently; answers gone, nothing recorded | Hubs are conditionally mounted and the exam is hub-local state; navigation had no way to know. | New `workInProgress` registry (`src/components/ui/workInProgress.ts`): the exam registers for its lifetime (grading included); `App.handleTabChange` confirms before switching; `beforeunload` prompt while registered. Source-guarded that every hub switch goes through `handleTabChange`. |
| Leave mid-grade | Nothing half-recorded | Stale grade could still call `onCompleted` after unmount | No abort on the grading request | `AbortController` per grade, aborted on unmount; abort records nothing. |
| Grading falls back locally | Honest provenance | `gradedOffline` unset; `topicsToReview: ['Key Principles Review']` (invented) | — | `gradedOffline: true`; topics = the topics actually missed; `timeSpentSeconds` recorded on that path too. |
| Results with no topic list | Honest empty state | "Flawless performance!" shown for a 0% Attempt with no topic list | Empty list treated as "no gaps" | Flawless copy only when every question was correct; otherwise points at the breakdown. |

Not changed, noted for later:

- `timeLimitMinutes` is still not stored on the Attempt; `retakeTimeLimit`
  reconstructs it. Storing it is a one-field `StoredAttempt` addition when
  the store next changes shape.
- The server's grading route has no upstream timeout; a hung Provider hangs
  the grading screen until the browser gives up. Same class as the
  "server does not abort upstream" note in §4a.
- Short-answer offline grading is a shared-word heuristic (`offline.ts`);
  the results view shows `gradedOffline`, which is the honest minimum.

### Learnings for the working model

1. **Idempotency guards must have exactly one owner.** A latch checked in
   two places is a latch that will eventually be set by the wrong one. The
   test now counts owners.
2. **"Button does nothing" is a class, not a bug.** Three instances here
   (expired Submit, seed Retake, keyboard Enter on confirm) had three
   different causes and one symptom. The audit column that catches them is
   *failure cases*, not *intended behaviour* — the plan's own report format
   (§7) but applied to a feature nobody had asked about.
3. **Time-bound work needs state above the hub.** Same lesson as reading
   continuity (§5): anything that must survive navigation, or veto it,
   cannot live in hub-local state. `workInProgress` is the third tiny
   registry (after `modalRegistry` and `readingPlace`); if a fourth appears,
   they should share one module.
4. **Live-read identity is a bug waiting for a second tab.** Anything
   recorded at the *end* of a long interaction must capture its identity at
   the *start* (Subject here; Note revision in §5).
5. **Default focus is policy.** "First tabbable control" is the right
   default for a dialog that can destroy something, and the wrong one for a
   dialog the learner opened to say yes. Make the choice at the call site,
   and keep the destructive default when unsure.
6. **jsdom paid for itself again.** All three "does nothing" bugs and the
   wrong-Subject filing reproduced in the harness in under a second each;
   none was visible from reading the code in review. The harness recipe
   lives under `.cache/smoke/` (git-ignored). **Promoted (2026-09-09):** the
   repo now has a real jsdom setup (`jsdom` + `@testing-library/react`, opted
   into per file), and it immediately caught one this plan had not found — a
   stale closure that dropped the *last* Flashcard's rating from the recorded
   Attempt, so a learner who mastered every card was told 80% and had 80%
   stored while the summary screen showed 100%. See `FlashcardView.test.tsx`
   and DEVELOPING.md §Testing.

---

## 10. Anti-plan

- **No new gestures.** Nothing in this plan adds a swipe, a pull, or a press.
- **No new permanent navigation column** (ADR-0006). The outline is a popover.
- **No animation library** (ADR-0004). Base UI Dialog is a focus/a11y
  primitive already in the bundle, not motion.
- **No fidget toys.** Confetti is celebration; leave it at that.
- **No "AI" copy on anything a model did not produce.** Same rule as the
  streak fix: if the app cannot observe it, it may not claim it.

## References

- Rauno Freiberg, *Invisible Details of Interaction Design* — https://rauno.me/craft/interaction-design
- The critical assessment this plan implements (forwarded review of the interaction-design report)
- `docs/ui-plan-spatial-consistency.md` — WS-5 (gestures) is superseded in part by §2 here
- `docs/ui-audit-taste-skill.md` — the "fabricated data" precedent (§1) and the open pulse-ring backlog item (§3)
- ADR-0001 (store boundaries, §5), ADR-0004/0005 (motion, §6), ADR-0006 (no sidebar, §5)
- `src/services/ai/aiGenerator.test.ts` — the attribution evidence the report correctly credits (§4)

# UI Plan — Editorial system canon, landing realignment, and note export

> Live plan (see [docs/README.md](./README.md)): WS-5 and WS-7 are gated
> go/no-go spikes. Archive this document, linking the ADR or code that settles
> them, once that decision is made.

Status: **WS-1/2/3/4/6 shipped** · WS-5 (Paged.js) and WS-7 (pdfcn reports)
remain gated spikes (go/no-go needed — see those sections) · Date: 2026-09-07
· Branch: `arena/01a07d66-temari`
Supersedes: an earlier shell/export plan (not committed to this repository),
written under the wrong assumption that neo-brutalism was the brand — it is
retired; see below.

**Shipped:** the editorial system is canonised in
[ADR-0010](./adr/0010-editorial-design-system.md) with surface tokens + a
regression guard test; the landing page is re-skinned to editorial; the dead
`shadow-neo-*` / `btn-neo` CSS is deleted; note print/PDF is hardened with a
print stylesheet, masthead and page numbers plus a Markdown download; and the
shell gained a `Kbd`, a `?` shortcut overlay, an imperative `confirm()`, and a
toast system. **Not started (gated):** WS-5 Paged.js and WS-7 pdfcn — both
need a licence/client-side spike decision.

This document reassesses the three forwarded libraries — **Cladd**, **pdfcn**,
**kugiri** — against Temari *as it is intended to be*, after the redesign.
The earlier pass treated the neo-brutalist hard-shadow prototype as the brand
and recommended pushing it into `/app`. That was backwards.

## What changed in our understanding

The design history (GitHub PRs) is explicit:

- **PR #15 — "Modern Academic Editorial design system."** Introduced shadcn-style
  primitives, semantic CSS tokens (`bg-card`, `bg-muted`, `text-foreground`,
  `text-muted-foreground`), and a single accent (Academic Amber `#D97706`).
  It *"eliminated `border-3` / `shadow-neo` / `font-black`"* from Notes,
  Analytics, Quizzes, Flashcards and the shared states.
- **PR #16 — "port the editorial design language to all five tabs."** Drove
  retired tokens (`shadow-neo`, `border-2 border-slate-900`, `bg-[#FAF8F5]`,
  `bg-yellow-300`, `font-black`) to **0 across `src/`** outside the diagram SVG
  internals, and defined the shared vocabulary:

  | Element | Treatment |
  |---|---|
  | Panel | `bg-card border border-border/80 rounded-2xl shadow-xs` |
  | Page title | `font-editorial text-2xl font-bold tracking-tight` |
  | Eyebrow | `ተማሪ` (amber) · CATEGORY · Subject |
  | Accent | `amber-600` / `amber-500/10`; emerald, rose, sky at the same ~10%-tint recipe, all `dark:`-aware |
  | Numbers | `font-mono tabular-nums` |
  | Controls | `<Button>` / `<Badge>` primitives, never hand-rolled neo buttons |

  The diagram **SVG internals keep their own figure grammar** — no shadows,
  hairline strokes, editorial type (WS-7 of the spatial plan).
- **What was deliberately left as a follow-up (PR #16 note):** the dead
  `.shadow-neo-*` and `.btn-neo` / `.btn-kinetic` utilities in `index.css`, and
  ADR-0005 still documents them.
- **The only neo-brutalist surface still shipping is the landing page**
  (`src/components/landing/LandingPage.tsx`), merged later in PR #18
  (cursor-reactive ASCII hero). The README tagline and "Mermaid" wording are
  also stale.

So the job is **not** to adopt a new look and **not** to push neo-brutalism in.
It is to (1) finish and *canonise* the editorial system that already won,
(2) realign the landing page and remove the dead CSS, and (3) solve the actual
underlying problems (export/PDF, dense-control craft) using solutions that fit
the editorial direction — which turns out to be a better match for two of the
three libraries than neo-brutalism ever was.

---

## 1. The libraries, re-assessed against the editorial system

### Cladd — now a philosophical match; still don't install it wholesale

Cladd's core idea — **"surfaces, not shadows,"** recessed/raised surfaces that
auto-bump on nesting, one sizing scale, imperative `useDialog`/`useToast`
hooks, application-grade controls (MIT, React 19, Tailwind v4)
[cladd](https://github.com/cladd-ui/cladd) · [cladd.io](https://cladd.io/) ·
[surfaces](https://cladd.io/react/foundations/surfaces/) ·
[about](https://cladd.io/about) — is *exactly* the editorial grammar PR #16
landed: hairline borders, whisper shadows, depth from tint/border. Our
`bg-muted/60` hub track → `bg-background` field → `bg-card` panel →
`bg-popover` floating menu **is** an unspoken Cladd-style surface ramp.

**Verdict: borrow the model, don't take the package.** Reasons:

1. **Cladd ships a defined visual identity that isn't ours** — a baked-in blue
   accent and dark-first theming. Ours is Academic Amber + warm paper +
   Playfair + Ethiopic. Importing the provider would set a competing accent
   and theme we'd override on every surface.
2. **We already run a component layer**: shadcn-style primitives in
   `src/components/ui/*` built on `@base-ui/react`. A second, opinionated kit
   across the same surfaces creates two grammars — the exact problem PR #16
   fixed. Ground rule: *accept dependencies, don't create them.*
3. The valuable parts are **patterns**, not code: a nesting-aware surface
   model, a single sizing scale, a `Shortcut`/Kbd element, imperative
   confirm/toast. All cheap to own in our tokens.

**Recommendation:** formalise *our* surface ramp (WS-1) and sizing/Kbd (WS-6)
using Cladd as the reference. Optionally evaluate a Cladd component for one
**new** dense surface behind an ADR — but do not retrofit the shell.

### pdfcn — the print engine question changes under editorial; still not for notes

pdfcn is an MIT, shadcn-style set of copy-in PDF components (tables, forms,
graphs, signatures, QR, page header/footer/number, key-value…) built on the
Takumi and Forme renderers, which turn JSX into PDF via Rust/WASM
[pdfcn](https://github.com/shadcn-labs/pdfcn) · [pdfcn.dev](https://www.pdfcn.dev/) ·
[trade-offs](https://www.opensourcealternatives.to/item/pdfcn) ·
[components](https://allshadcn.com/components/pdfcn-beautiful-shadcn-style-pdf-components-for-react/).

The editorial direction makes print/PDF *more* important, not less — study
notes are academic documents. But pdfcn still cannot render the two things
that make our notes ours:

- **No math/LaTeX component** — notes run KaTeX (`remark-math` +
  `rehype-katex`).
- **No freeform/interactive SVG** — our figures are custom editorial SVG
  (`FigureRenderer`), with a teacher-walkthrough mode. There is no
  "render this SVG" block, and the renderers don't execute our figure code.
- It renders through Rust/WASM / Node and the docs lean server-side; a path
  that only works on the Node deploy and silently differs on Netlify is not
  acceptable.

**Verdict: do not put notes through pdfcn.** The right export for notes is the
browser's print pipeline, which renders KaTeX, SVG, web fonts and our CSS
natively — and which Paged.js can upgrade to full academic typesetting
(WS-5). Keep pdfcn only as a **gated spike for structured, math/figure-free
reports** (Exam results / Planner) and only if it runs client-side (WS-7).

### kugiri — still skip for the app; a small landing-only flourish is now on-brand

kugiri (区切り) splits text into the exact line/word/grapheme boxes the browser
painted and hands them back to WAAPI/CSS for reveal animations; ~7.5 kb gzip,
no dependencies, MIT, `Intl.Segmenter`-based
[kugiri](https://github.com/edoardolunardi/kugiri).

Under the editorial redesign the nuance is the same but the conclusion
softens slightly:

- **Never on note/editable/selectable text** — per-word spans break selection,
  find-in-page, copy, and the long-press "Explain with AI" term lookup.
- **The app shell stays off-limits** — ADR-0005: high-frequency and
  keyboard-initiated actions never animate.
- **The landing hero is the one budgeted novelty tier.** The editorial
  re-skin (WS-2) is a natural moment for a restrained headline reveal. But a
  CSS/WAAPI reveal on already-wrapped elements achieves the editorial look
  without a dependency; Amharic is space-separated like English, so kugiri's
  headline `Intl.Segmenter` edge doesn't apply to our Ethiopic text. Default
  to no dependency; reach for kugiri only if reveal-on-wrap fidelity proves
  to matter (ADR + reduced-motion override in the same commit).

---

## 2. The underlying problems and their real solutions

The forwarded tools are answers to three underlying needs. Where they don't
fit, here is what does — ranked by how well it serves the editorial system.

### Problem A — depth/elevation consistency → an editorial surface ramp (not shadows)

PR #16's panels are consistent, but nesting depth is still expressed ad hoc.
We already have the materials for a proper **surface system**, editorial-style
(depth from tint + hairline + whisper shadow, à la Cladd, but in our tokens):

| Level | Role | Existing material |
|---|---|---|
| L0 page | warm paper / app background | `--background`, body `#FAF8F5` |
| L1 recessed well | hub tab track, inputs, code blocks | `bg-muted/60`, `bg-background` field on `muted` |
| L2 raised panel | note card, manager panels, cards | `bg-card border-border/80 rounded-2xl shadow-xs` |
| L3 floating | dropdown, popover, tooltip, command palette | `bg-popover border rounded-xl shadow-md` |
| L4 overlay | modal/dialog | `Modal` surface |

Each step *up* lightens/raises slightly; a **Cut/recessed** step (the tab
track, an input) darkens/insets. Formalise these as semantic classes
(`surface-panel`, `surface-well`, `surface-floating`, `surface-overlay`) plus
a small `--surface-*` token set, so nesting "auto-bumps" the way Cladd does,
but with our amber/paper identity. This is the single most leveraged craft
improvement and it needs no dependency.

### Problem B — note export/PDF → native print first, Paged.js for academic typesetting

Today export is a bare `window.print()` (`NoteViewer.tsx:347`) with three print
rules (`index.css:711`). Good news: **Chrome 131+ now natively supports the
core Paged-Media features** — `@page` margins/size, `:first`, `:left/:right`,
all 16 margin boxes, `counter(page)/counter(pages)`, named pages, breaks,
orphans/widows [doppio comparison](https://doppio.sh/guide/css-paged-media-vs-pagedjs).
So a proper print stylesheet (WS-4) gives real margins, page numbers, running
titles and break control with **zero runtime**, working on Netlify and offline.

For the genuinely academic layer that native CSS still lacks — **running
headers from the note title (`string-set/string()`), real footnotes for our
`[[n]]` citations (`@footnote`/`float: footnote`), cross-reference page numbers
(`target-counter()`), a table-of-contents with dot leaders** — the
polyfill is **Paged.js**: it chunks content into page boxes in the browser
following the W3C Paged Media spec, so KaTeX, our SVG figures, web fonts and
the editorial CSS all flow through real pages, client-side (Netlify-safe),
with a live paginated preview [doppio](https://doppio.sh/guide/css-paged-media-vs-pagedjs)
[Paged.js](https://www.pagedjs.org/). This is the purpose-built,
on-brand answer for "export a beautiful study note PDF" — it preserves the
editorial design rather than rebuilding the document in a foreign component
kit. (Licence note: Paged.js is open-source/AGPL-licensed for the polyfill
with a hosted API offered commercially; **we run the client-side polyfill
ourselves and never call the API**, but confirm licence fit before shipping.)
Vivliostyle is the alternative engine but has weaker running-element/footnote
support for our case [Vivliostyle comparison](https://github.com/mrombout/asciihero/issues/55).

Optionally, the **Node/self-hosted** deployment can add a headless-Chromium
route that prints the *same* CSS server-side for one-click download, reusing
all of this and guaranteeing KaTeX/SVG fidelity — clearly unavailable on
Netlify, where the browser print/Paged.js path serves.

Also add a **Download .md** button (Blob + `<a download>`), ~15 lines, portable
source that works everywhere offline.

### Problem C — dense-control craft & feedback → own it: Kbd, sizing scale, confirm, toast

- **Kbd / Shortcut element.** Shortcuts exist (hub keys `1–5`, `Cmd/Ctrl+K`,
  `Escape`) but the only hint is one hand-rolled inline `<kbd>`
  (`App.tsx:325`). Add a shared `Kbd` on the control-height scale and a
  shortcut overlay (`?`). No document-tab shortcuts (`Cmd+T/Cmd+W`) — we have
  hub tabs + list→detail, no open-document tabs.
- **Imperative confirm + toast.** We have a unified `Modal` but hand-manage
  booleans (`confirmDeleteSubjectId`, `openModal`) and have **no toast
  system** — copy/refresh/offline errors surface inconsistently. Add a small
  `useConfirm()` over `Modal` and a minimal `role="status"`/`aria-live` toast
  (panel-tier timing, reduced-motion aware, never on the keyboard hot path).
  Keep `OfflineBanner` as the persistent offline label (toasts mustn't be the
  only offline indicator).

---

## 3. Workstreams

Effort: S < half day, M 1–2 days, L spike.

### WS-1 — Canonise the editorial design system — ✅ shipped (ADR-0010, `surface-*` tokens, `designSystem.test.ts`)
The vocabulary exists in PR #16 but is nowhere in the repo, so it drifts.
- Write **ADR-0010 — Modern Academic Editorial design system** capturing:
  surface ramp L0–L4 + recessed wells (Problem A), the 10%-tint accent recipe,
  Playfair/Inter/JetBrains-Mono/Abyssinica type roles, `tabular-nums` figures,
  hairline/`shadow-xs`/no-hard-shadow rule, diagram figure grammar.
- Encode the ramp as tokens + semantic classes in `index.css`; replace
  ad-hoc nesting with them.
- Promote PR #16's throwaway SSR token check into a tiny **design-system
  regression test** (render key screens; assert retired tokens absent,
  editorial tokens present).
- **Acceptance:** one ADR + one token set + a test that fails if a
  `shadow-neo`/`font-black`/hard-border token reappears in app chrome.

### WS-2 — Re-skin the landing page to editorial — ✅ shipped (`landing/*`; ASCII palette retuned to amber-first)
`LandingPage.tsx` is the sole neo-brutalist surface.
- Keep the **ASCII hero field** (it's the budgeted novelty and is on-brand
  technically/editorially — but move its palette to TEMARI paper/ink/amber,
  retire `shadow-neo-teal/amber` and `border-2 border-[#0F172A]`).
- Convert panels, buttons, cards, and the skip-link to editorial primitives
  (`Card/Button/Badge`, `surface-panel`, `font-editorial`, eyebrow pattern).
- Respect the landing guardrails (`docs/archive/ui-plan-landing-page.md`): imports no
  study code, touches no storage, copy uses CONTEXT.md nouns, numbers from
  code.
- Optional restrained headline reveal (CSS/WAAPI; reduced-motion; kugiri only
  if justified — see §1).
- **Acceptance:** zero `shadow-neo`/`btn-neo`/`font-black` in `landing/*`;
  landing and `/app` read as one product; `npm run lint/test/build` green.

### WS-3 — Retire the dead neo-brutalist CSS — ✅ shipped (`shadow-neo-*` / `btn-neo` deleted; ADR-0005 motion block updated)
After WS-2, `.shadow-neo-*` and `.btn-neo`/`.btn-kinetic` have no consumers.
- Delete them from `index.css`; update ADR-0005's motion-budget notes to point
  at the editorial press-feedback vocabulary instead.
- **Acceptance:** grep for `shadow-neo|btn-neo|btn-kinetic` returns nothing;
  build/tests green.

### WS-4 — Harden note export — ✅ shipped (print stylesheet, masthead, page numbers, force-light, break control; Download .md)
Pure CSS + one button; zero runtime; Netlify/offline-safe.
- `@page` margins/size; margin boxes for **page number** and a running title;
  `:first` masthead (title, Subject, date, source, tags, wordmark).
- `print-color-adjust: exact` for callout tints and the amber highlight; force
  light tokens under print so dark mode never prints a near-black page.
- `break-inside: avoid` on figures/SVG, callouts, `pre`, table rows,
  `.katex-display`; `break-after: avoid` on headings; orphans/widows.
- Hide the action bar, Explain tooltip, pulse ring (`no-print`). (The
  pull-to-refresh banner was removed in `ui-plan-truthful-interaction.md` §1.)
- Add **Download .md**.
- **Acceptance:** Chromium "Save as PDF" shows margins, page numbers,
  masthead, preserved colour, unsplit figures/code; dark mode prints light;
  .md download works offline; identical on Netlify and Node.

### WS-5 — Optional: Paged.js academic typesetting for long notes — ⛳ spike, not started (gated)
Spike only after WS-4, for notes where citations/footnotes matter.
- Lazy-load the Paged.js polyfill behind an "Export typeset PDF" affordance;
  produce paginated preview then print. Map `[[n]]` citations to real
  footnotes; running header = note title; optional dot-leader TOC.
- Gate on: client-side operation (Netlify parity), bundle cost behind a
  dynamic import, AGPL licence sign-off, reduced-motion/print parity.
- **Acceptance to proceed:** footnotes/running headers render client-side
  with KaTeX + SVG figures intact; otherwise keep WS-4 native output.

### WS-6 — Shell craft: Kbd, shortcut overlay, confirm, toast — ✅ shipped (`kbd.tsx`, `ShortcutsOverlay`, `confirm.tsx`, `toast.tsx`; wired into App + note flows)
Per Problem C. Add `Kbd`, a `?` shortcut overlay (instant on keyboard open),
`useConfirm()`, and a toast; wire real shortcuts only where actions exist.
- **Acceptance:** every shortcut has a visible Kbd; destructive confirms go
  through one hook; transient feedback announced to assistive tech; no new
  dependency; keyboard paths stay instant (ADR-0005).

### WS-7 — Optional: structured-report PDF spike (pdfcn) — ⛳ spike, not started (gated)
For math/figure-free artefacts (Exam Attempt results, Planner summary).
- Timebox a pdfcn (Takumi/Forme) prototype for one report; answer in writing:
  does it render **in-browser via WASM** (Netlify-viable)? bundle cost behind
  a lazy chunk? can it theme to paper/amber/ink + wordmark?
- Fallback: a print-optimised report view reusing WS-4 CSS (works everywhere).
  Never route note export (math/figures) through pdfcn.

---

## 4. Anti-plan (don't do these)

- **Don't reinstall neo-brutalism** and don't push `shadow-neo-*` into `/app`;
  that's the retired prototype.
- **Don't `npm install @cladd-ui/react` across the shell** — its blue/dark
  identity competes with amber/paper and we already have a component layer.
  Borrow the surface/sizing/hook patterns; consider one Cladd component only
  for a new dense surface behind an ADR.
- **Don't render notes to pdfcn** — no KaTeX, no custom SVG. Use the browser
  print pipeline (WS-4) and optionally Paged.js (WS-5).
- **Don't split selectable/editable text with kugiri** (breaks selection, find,
  copy, long-press Explain). Landing hero only, and prefer CSS/WAAPI.
- **Don't invent document tabs / `Cmd+T`/`Cmd+W`** — we have hub tabs and
  list→detail.
- **Don't ship anything Netlify can't run** without a labelled fallback;
  gate Paged.js/pdfcn on client-side operation and licence.
- **Don't animate the high-frequency/keyboard layers** (ADR-0005); every
  animation ships its `prefers-reduced-motion` override.

## 5. Sequencing & definition of done

1. **WS-1** canon (ADR-0010 + tokens + regression test) — locks the language.
2. **WS-2** landing re-skin → **WS-3** delete dead CSS — finishes the redesign.
3. **WS-4** export hardening (+ .md) — highest user-facing value, no deps.
4. **WS-6** Kbd/overlay/confirm/toast.
5. Gate **WS-5** (Paged.js) and **WS-7** (pdfcn reports) on their spikes.

**Done when:** one editorial system is documented (ADR-0010) and enforced by a
test; landing and `/app` match; no dead neo CSS remains; note → PDF preserves
math, figures, callouts, colour, page numbers and masthead with light-mode
print and offline .md download; shortcuts are discoverable; confirm/toast are
consistent and accessible; Netlify and Node behave identically and offline
output stays labelled.

**Guardrails:** new runtime dependency or port → ADR first (ADR-0002/0005
precedent). Follow DEVELOPING.md "how to add a feature"; keep `studyStore`
and the `ai` module deep; surface `GenerationResult.source` on any new AI
surface.

## References
- Cladd — [github](https://github.com/cladd-ui/cladd) · [cladd.io](https://cladd.io/) · [surfaces](https://cladd.io/react/foundations/surfaces/) · [about](https://cladd.io/about)
- pdfcn — [github](https://github.com/shadcn-labs/pdfcn) · [pdfcn.dev](https://www.pdfcn.dev/) · [trade-offs](https://www.opensourcealternatives.to/item/pdfcn) · [components](https://allshadcn.com/components/pdfcn-beautiful-shadcn-style-pdf-components-for-react/)
- kugiri — [github](https://github.com/edoardolunardi/kugiri)
- Paged Media / Paged.js — [doppio comparison](https://doppio.sh/guide/css-paged-media-vs-pagedjs) · [Paged.js](https://www.pagedjs.org/) · [Vivliostyle notes](https://github.com/mrombout/asciihero/issues/55)

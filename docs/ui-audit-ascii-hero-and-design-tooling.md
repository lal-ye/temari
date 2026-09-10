# Design Review — the ASCII hero, and the three proposed libraries

- Status: **Proposal, for discussion**
- Date: 2026-09-10
- Scope: `src/components/landing/*`, `src/index.css`, `index.html`, `docs/adr/0004|0005|0006|0009|0010`, `docs/ui-plan-landing-page.md`
- Commit audited: `8b37173` ("refactor(landing): redesign landing page to cognitive study engine")
- Author: Arena agent session `arena/01a08b3b-temari`

---

## 0. How to read this document

Two questions were put to the review:

1. **The ASCII hero is not ported correctly.** It looks wrong, it is not alive the
   way the reference preview is, and it behaves completely differently on mobile
   and desktop. Design better primitives while keeping the core idea.
2. **Can `shadergradient`, StyleX and Astryx elevate the whole product** without
   drifting from the design language?

Both are answered below. Every factual claim carries either a `file:line`
citation or a verification command. Claims are tagged:

| Tag | Meaning |
|---|---|
| **[V]** | Verified by running a command in this checkout. The command is given. |
| **[C]** | Computed — deterministic arithmetic from values in the code. Formula shown, re-runnable. |
| **[R]** | Reasoned from a spec or from a read of third-party source. Source linked. |
| **[U]** | Unchecked. Stated as a hypothesis, not a fact. |

**What I could not check.** This sandbox has no browser binary (`chromium`,
`google-chrome`, `firefox` all absent; `npx playwright install chromium` fails
with `Download failure, code=1`), so I could not generate screenshots or sample
pixels myself. The owner later supplied eight screenshots; they are integrated
in **§0.3** as **[S]** evidence. Because the attachments rendered inline but were
not persisted to the workspace, the [S] claims are *visual reads*, not measured
values — the arithmetic in §2/§3 remains the measured half. Remaining owed:
real-device touch testing of the coarse-pointer path (A5), which no desktop
screenshot can show.

Everything that *was* run, and what it returned:

```
npm test      → 20 files, 317 tests passed
npm run lint  → tsc --noEmit, clean
npm run build → built in 8.55s
```

---

## 0.1 Errata — corrections applied after peer review

This document was reviewed against the public `main` source. The review was
right on five points and wrong on two. Both are recorded here so the reasoning
is auditable, and the body text below has been corrected in place.

### Accepted — my errors, now fixed in the body

| # | What I claimed | What is actually true | Verified by |
|---|---|---|---|
| E1 | "the CTA hover changes **nothing** except `active:scale-[0.99]`" | **Wrong.** The inline `style` sets only `backgroundColor` and `color` (`LandingPage.tsx:127-130`). There is no inline `borderColor`, so `hover:border-[#E33E33]` (`:126`) **does** apply. The border recolours on hover; the fill and text do not. | `sed -n '126,131p' src/components/landing/LandingPage.tsx` |
| E2 | "Academic Amber `#D97706` is the **only direction that reads as light**" | **Wrong, and worse than a wording slip.** On paper every ink is *darker* than the paper — `#D97706` at α = 1.0 composites to only **2.97:1**, so it can never read as "lighter". See the corrected table in §3 Layer 2. | Appendix A script |
| E3 | "peak target ≈ 3.5:1" in amber | **Arithmetically impossible.** `#D97706` on `#F8F7F4` tops out at **2.97:1 at any alpha**. `#E33E33` needs **α ≈ 0.898** to reach 3.5:1 — effectively opaque. The "warm reveal" option does not work at the target I set. | Appendix A script |
| E4 | "for `#111113` on `#F8F7F4` that is α ≈ 0.24" (for a 1.6:1 rest) | **Wrong value.** The α that yields 1.6:1 is **0.215**, not 0.24. | Appendix A script |
| E5 | "At rest the field is invisible"; "on touch the field is **permanently** invisible" | **Overstated.** Both are *computed* contrast results, not observed ones — this report has no screenshots (§0). The field does render; the claim that survives is "computed contrast of 1.27–1.47:1 predicts it will not be perceived". | §0 |
| E6 | The 1.6:1 / 3.5:1 targets | **Not from our design system.** They are proposed implementation decisions and are now labelled as such, with the contract expressed as a test range rather than a magic number. | — |
| E7 | "build-time OG image via shadergradient ≈ 0.5 d" | **Underestimated.** Rendering an R3F/WebGL canvas outside a browser needs headless WebGL or a real browser in CI. Demoted to *optional, not obviously cheap*. | — |
| E8 | `FieldProgram` abstraction and all three `AsciiSurface` modes | **Overbuilt for one consumer.** Both deferred; see the revised §3. | — |

### Rejected — claims in the review that the source contradicts

| # | Claim | What the source says | Verified by |
|---|---|---|---|
| X1 | *"`App.tsx` creates nav items with only `id`, `label`, and `icon`; no `shortLabel` values are supplied"* — offered as **Miss 1**, a mobile bottom-bar bug | **False.** `App.tsx:195-201` supplies `shortLabel` for **all five** items: `'Notes'`, `'Quizzes'`, `'Exams'`, `'Progress'`, `'Planner'`. `HubTabs.tsx:134` (`item.shortLabel ?? item.label`) therefore never falls through. There is no bug to fix. Separately, the review's suggested replacement sets `label: 'Mock Exams'` — `glossary.test.ts:49` asserts `App.tsx` contains no case-insensitive `"mock"`, so applying that patch would **break a currently-passing test**. | `grep -n shortLabel src/App.tsx src/components/nav/HubTabs.tsx` |
| X2 | *"`StoredNote.updatedAt` is optional in `types.ts`, while `useReadingPlace` expects `contentRevision: string`"* — offered as **Miss 5**, a reading-continuity bug | **False.** `types.ts:23` declares `updatedAt: string` — **required** — on `StoredNote`. The optional `updatedAt?: string` at `types.ts:12` belongs to the **`Subject`** interface, which is a different type. `NoteViewer.tsx:564` passing `note.updatedAt` is type-correct and `tsc --noEmit` is clean. | `sed -n '1,30p' src/types.ts` |
| X3 | The report should be judged against *"the actual `improve-ui` skill"* | **No such skill is in this repository.** `skills-lock.json` locks **60** skills; `improve-ui` is not one of them, and neither are `taste-skill` or `redesign-skill` (those two are external, referenced only in `docs/ui-audit-taste-skill.md`). The scope critique is still worth answering on its merits — see §0.2 — but it is not a contract this repo carries. | `python3 -c "import json;print('improve-ui' in json.load(open('skills-lock.json'))['skills'])"` → `False` |

### Partly accepted

- **Miss 2 (`index.html` body class) — accepted, and it was a genuine miss.**
  `index.html:17` is `<body class="bg-slate-50 text-slate-900 antialiased
  selection:bg-teal-500 selection:text-white min-h-screen">`. Slate and teal are
  the retired neo-brutalist palette; ADR-0010 wants warm paper, ink and amber.
  Added as finding **A10**.
- **Miss 3 (PDF export) — the observation is true, the framing is not.**
  `handlePrint` does call `window.print()` (`NoteViewer.tsx:408-410`). But the
  control is labelled `Print / PDF` with `title="Print or Export PDF"` (`:689-692`)
  — not "Export PDF" — and ADR-0010 §6 *chose* the browser print pipeline by name,
  with the Paged.js typesetting spike listed as the deferred alternative. It is a
  documented tradeoff outside this report's declared scope, not an unflagged gap.
- **Splitting the mobile findings** — accepted in substance. A6 is now labelled
  as **three separately-fixable defects**, because "the canvas owns a different
  box" and "the glyph size tracks host area" have different fixes.

### One real gap the review surfaced indirectly

`tsconfig.json` contains **no `strict` flag** (`grep -c strict tsconfig.json` → 0).
X2 was a false alarm, but it was only checkable by hand *because* `strictNullChecks`
is off — an actual `string | undefined` passed where `string` is expected would
compile silently today. That is a latent class of bug across all 108 source files
and is worth its own ticket, independent of anything in this document.

---

## 0.2 On scope

The review's structural objection — nine findings, three library evaluations,
docs governance, fonts, a11y and product ideas in one document — is fair as
criticism of *shape*, and §6 is now the answer to it: a strict sequence where
**Phase 1 alone** (token contract + landing recomposition) is the single
highest-leverage change and can ship without any of the rest.

It is worth being precise about why the document is wide, though. The stated
brief was two questions — "is the port correct" and "should we take these three
libraries" — plus an explicit instruction to *look at the current documentation
of the codebase*. The governance drift is not padding: it is the cause. Four
written commitments in ADR-0009/0010 and the landing plan are contradicted by
`LandingPage.tsx`, and the ASCII hero was tuned against a page that those
commitments described. Fixing the renderer without fixing the contract would
produce the same drift again on the next pass.

What I have cut: the two deferred abstractions (E8), and the claim that the
OG-image path is cheap (E7).

---

## 0.3 Device evidence — what the screenshots changed

After review, the owner supplied eight screenshots (desktop 1440×900 full-page
and hover, 1920×1080, ultrawide 2560×1080, iPad viewport and full-page, iPhone
14 viewport and full-page). They are cited below as **[S]**. **Honesty note:**
the attachments rendered inline but were **not persisted to the workspace**
(`/home/user/uploads/` does not exist), so no pixel-level sampling was
possible; [S] claims are visual reads, not measured values.

### What the screenshots CONFIRM

| Report claim | Screenshot evidence |
|---|---|
| A3 — field buried on desktop | 1440×900: glyphs only in the 40px padding/gutter. 1920 and 2560: also in the outer margins beyond `max-w-[1700px]`, exactly as the box model predicts. |
| A6(a) — mobile canvas spans the document | iPhone 14 full-page: the field runs the whole scroll length, including a band below the PROVIDERS bar at the document bottom. |
| A8 — hover-only content, mouse works | 1440×900 hover: the REMEMBER card inverts to black and swaps to the full prompt with the `COGNITIVE_L01` footer row. The interaction exists and works — for a pointer only. |
| §1 fonts — wordmark is an uncontrolled fallback | The ተማሪ mark renders as a brush/marker-style Ethiopic face, visually unrelated to the app header's `font-ethiopic` ተ tile. |

### What the screenshots CORRECT

1. **A1's visibility framing was wrong twice.** First (original) I called the
   resting field "invisible"; then (errata E5) "predicted not to be perceived".
   The screenshots show the resting field **is** perceived — but via the **hue**
   channel: the red diagonal stripes read as a quiet pink texture while the grey
   glyphs vanish. WCAG luminance contrast (1.27–1.47:1) measures the grey, not
   the hue. Corrected statement: *the resting field reads as a soft red-stripe
   watermark — visible enough to look unfinished, too quiet to look designed.*
   A1's body text below is updated to match.

2. **The spotlight works; the palette starves it.** In the hover shot the cells
   near the cursor light up **red**, not black — the "glow" mechanism the
   reference has is already functioning in our code. It appears on only 1-in-4
   cells because `COGNITIVE_PALETTE` has three near-black slots
   (`asciiFieldMath.ts:29`). This demotes the knockout lens from "the only
   viable option" (errata E3) to "one of two options", and promotes a **palette
   rebalance** — three warm slots, one dark — to the cheapest fix in the
   document. See A11 and the revised Layer 2.

### What the screenshots ADD

3. **Composition, not just contrast.** The desktop left panel is roughly half
   empty paper: wordmark top-left, pitch and CTAs mid-left, and a large blank
   region below. And each Bloom card at rest is mostly void, because its footer
   row is `opacity-0` until hover. Both are visible in every viewport. See A12.

---

## 1. Where the project is (the journey, from our own docs)

Read in order, the docs describe a product that has already made the hard
design decision once, and then unmade it:

| Date | Artefact | What it decided |
|---|---|---|
| — | `CONTEXT.md` | A fixed vocabulary: Subject, Material, Note, Quiz, Drill, Exam, Attempt, Cognitive Level, Provider, BYOK, Offline generation. `_Avoid_` lists included. |
| — | `docs/adr/0004` | **No animation library.** "The platform. FLIP + WAAPI + CSS variables… if something genuinely can't be built without a library, write an ADR first." |
| — | `docs/adr/0005` + `DEVELOPING.md` "Motion budget" | Animation is *spent by frequency*, not taste. The landing hero sits in the "Rare / first-run" tier and is the **only** continuous animation allowed on the page. |
| — | `docs/adr/0006` | Header-only chrome. **No sidebar.** |
| 2026-09-07 | `docs/adr/0009` | Landing page at `/`, shell at `/app`, no router. **Port the hero hook, do not install `performative-ui`.** `/` chunk ~70 kB gzipped, containing none of the study code. |
| 2026-09-07 | `docs/adr/0010` | **Modern Academic Editorial** becomes the single visual language: warm paper `#FAF8F5`, ink `#0F172A`, one accent (Academic Amber `amber-600` / `amber-500/10`), hairline borders, `shadow-xs`, Playfair headings / Inter body / JetBrains Mono figures, **Ethiopic first-class**. Neo-brutalism retired. |
| 2026-09-07 | `docs/ui-plan-landing-page.md` | Six workstreams, WS-1…WS-6, all marked ✅ shipped. |
| 2026-09-10 | `8b37173` | The landing page is rewritten as "Variation 10 — Cognitive Study Engine": `#F8F7F4` / `#111113` / `#E33E33`, Syne 800 + Space Mono, hard `border-2`, uppercase terminal labels. |

**The headline structural finding, before anything about pixels:**

> Commit `8b37173` replaced the documented design language on the landing page
> with a second, undocumented one, and did not touch a single ADR, plan or
> README. It also silently broke four written commitments. This is not a taste
> disagreement — it is a governance gap, and it is the reason the hero "acts
> entirely differently", because the port was tuned for a page that no longer
> exists.

Written commitments broken by `8b37173`, each verifiable:

| # | Commitment | Where it is written | Where it broke | Check |
|---|---|---|---|---|
| 1 | "Academic Amber is the single accent" | `docs/adr/0010` §3 | Accent is `#E33E33` red, 13 occurrences | `grep -c '#E33E33' src/components/landing/LandingPage.tsx` |
| 2 | "Ethiopic is first-class… **not a fallback**" | `docs/adr/0010` §2; the `@font-face` comment at `src/index.css:9-19` explains *why* it is self-hosted | The wordmark ተማሪ is set in `'Syne', sans-serif` — Syne has no Ethiopic, so it falls back to the OS | `LandingPage.tsx:104-111` |
| 3 | "every number comes from code (`BLOOM_LEVELS`, `AI_PROVIDERS`)" | `DEVELOPING.md` module map, landing row; `docs/ui-plan-landing-page.md` §6.3 | `BLOOM_CARDS` hardcoded (`LandingPage.tsx:31-64`); `PROVIDERS: [GEMINI, OPENAI, CLAUDE, GROQ]` hardcoded (`LandingPage.tsx:218`) | Catalog has **7** providers incl. DeepSeek, OpenRouter, Custom/Ollama — `grep -n "id:" shared/aiCatalog.ts` |
| 4 | "Attribution is in both file headers **and on the page footer**" | `docs/adr/0009` §2 | There is no footer. `grep -n '<footer' src/components/landing/*.tsx` → nothing | |

Also stale, and now actively misleading to a new contributor:

- `DEVELOPING.md:22` still says the landing dir contains "the `AsciiField` canvas
  hero". `LandingPage.tsx:3` imports `AsciiHero`. `AsciiField.tsx` is now **dead
  code** — nothing imports it (`grep -rn "AsciiField" src/ --include=*.tsx`).
- `README.md` "Design language" still describes Playfair/Inter/JetBrains/amber
  and calls the page a re-skin of the editorial system.
- `index.html:7-8` and `metadata.json` both still describe the product as
  "neo-brutalist", which ADR-0010 retired.
- `docs/ui-plan-landing-page.md` marks WS-1…WS-6 ✅ shipped, but WS-3's section
  table (Nav / Hero / The loop / Cognitive levels / BYOK / Footer) no longer
  describes the page, and WS-2 item 4 ("on `(pointer: coarse)` the resting
  opacity is raised") is **no longer true** — see finding **A5**.

---

## 2. Concern 1 — the ASCII hero

### 2.1 What the reference actually is, and what the "preview" you are comparing against is

Source read directly from the repo, not from memory:

- hook: <https://raw.githubusercontent.com/vorpus/performativeUI/main/src/hooks/useAsciiField.ts>
- component: <https://raw.githubusercontent.com/vorpus/performativeUI/main/src/components/AsciiHero.tsx>
- stylesheet: `src/styles.css` in the same repo, `.pui-ascii` block
- the docs demo the preview shows: `docs/lib/meta.tsx`, slug `ascii-hero`

The demo you are looking at is, verbatim:

```tsx
<div style={{ position: "relative", minHeight: 280, padding: 36,
              overflow: "hidden", background: "#08080b" }}>
  <AsciiHero variant="bare" colorful baseOpacity={0.18}
             spotlightOpacity={0.9} spotlightRadius={10}
             style={{ position: "absolute", inset: 0 }} />
```

`LandingPage.tsx:72-79` copies those **five numbers exactly**. What it did not
copy — and could not, because it is not a prop — is **`background: "#08080b"`**.
And `colorful` in the reference resolves to
`DEFAULT_PALETTE = ["#a78bfa", "#ec4899", "#67e8f9", "#fbbf24"]`, four bright
saturated colours.

Our `colorful` resolves to `COGNITIVE_PALETTE = ['#E33E33', '#111113', '#C22B22', '#36363B']`
(`asciiFieldMath.ts:29`) — one red and **three near-black inks** — because the
page behind it is paper, not night.

> ### The root cause, in one sentence
> **The reference is a light-on-dark effect; we ported the numbers onto a
> dark-on-light page, which inverts the lighting model — so the same
> `baseOpacity`/`spotlightOpacity` pair that produces "a faint field that
> glows colour where you point" now produces "an invisible fog that turns into
> a hard black blob where you point".**

That single inversion explains most of "ugly" *and* most of "not alive". The
rest is arithmetic.

### 2.2 Findings

Each finding is: claim → evidence → how to check it.

---

#### A1 — At rest the field's *luminance* contrast is 1.27–1.47:1; what is seen is the hue channel, and it reads as an unfinished watermark. **[C] + [S]**

Alpha compositing, `result = src·a + dst·(1−a)`, then WCAG relative luminance:

| Palette slot | at α = 0.18 over `#F8F7F4` | composited | contrast vs page |
|---|---|---|---|
| `#E33E33` | | `#F4D6D1` | **1.27:1** |
| `#111113` | | `#CECECC` | **1.47:1** |
| `#C22B22` | | `#EED2CE` | **1.33:1** |
| `#36363B` | | `#D5D4D3` | **1.38:1** |

For reference, the same α = 0.18 on the reference's own dark demo surface gives
1.20–1.45:1 — so **the reference is equally faint at rest**. That is the point
of a hero background. The difference is what happens when you hover (A2).

*Caveats, stated honestly:* canvas text is antialiased, so only the core of each
glyph reaches the composited colour; edge pixels are lighter. 1.47:1 is
therefore an **upper bound** on luminance contrast. The field is `aria-hidden`
so this is not a WCAG 1.4.11 compliance failure.

**[S] correction (screenshots):** luminance contrast is not the whole story.
The red stripe slots *are* perceived at rest — hue carries visibility even at
1.27:1 — while the grey slots vanish. The screenshots show exactly this split:
a soft pink diagonal stripe over near-nothing. The defect is therefore not
"invisible" but *unresolved*: the field reads as a faint watermark rather than
a designed surface, and the effect is carried by one lucky hue instead of by
the contrast model §3 proposes.

Reproduce: the compositing + luminance script is in **Appendix A**.

---

#### A2 — The spotlight's polarity is inverted: it lights up *darkness*, not colour. **[C]**

| | peak (α = 0.9) | composited | contrast |
|---|---|---|---|
| Temari, `#111113` on `#F8F7F4` | dark ink on paper | `#28282A` | **13.73:1** |
| Reference, `#fbbf24` on `#08080B` | bright amber on near-black | `#E3AD22` | **9.78:1** |

Our spotlight is *stronger* in raw contrast terms. It just reads as a **hard
near-black blob with a soft rim** rather than as illumination, because on a
light surface "brighter" means "closer to paper" and there is nowhere to go —
the only direction available is *darker*. The reference gets its glow because
dark-on-dark has somewhere to go: toward the accent hue.

**This is the single highest-leverage fix in the document**, and it is not a
palette swap. On paper the "glow" has to be produced by *removing* ink (a
knockout/vignette toward paper) or by a warm hue at high chroma — not by adding
more ink. See §2.4.

---

#### A3 — On desktop the field is 83.5% covered by opaque panels. **[C]**

`LandingPage.tsx:70` — root is `p-5 sm:p-8 lg:p-10`; `:92` — grid is
`h-full w-full max-w-[1700px] gap-6 lg:gap-10`. Both grid children stretch to
full row height. Both carry `bg-[#F8F7F4]/90 backdrop-blur-xs`
(`:99`, `:157`, `:189`, `:215`).

| Viewport | panels cover | field visible at full α |
|---|---|---|
| 1280×800 | 81.6% | 18.4% |
| **1440×900** | **83.5%** | **16.5%** |
| 1600×900 | 84.3% | 15.7% |
| 1920×1080 | 80.1% | 19.9% |
| 2560×1440 | 61.2% | 38.8% |

So on a laptop **five sixths of the hero is behind a 90%-opaque,
backdrop-blurred panel**, and the remaining sixth is the 40px page padding and
the 40px gutter. The bleeding 10% comes through at an *effective* α of
`0.18 × 0.10 = 0.018` — i.e. composited contrast ≈ 1.03:1. Indistinguishable
from the paper.

The reference demo has no panels over the field at all. **This, more than any
rendering detail, is why ours looks dead.**

---

#### A4 — The dominant animation is an 8.3-second colour blink, not the 4.5-second wave. **[C]**

Two time-varying terms reach each cell:

- `waveAt` (`asciiFieldMath.ts:61`) — `0.15·sin(x·0.18 + t·1.4)·cos(y·0.22 − t·1.1)`,
  period `2π/1.4` = **4.49 s**.
- `paletteIndexAt` (`asciiFieldMath.ts:123`, formula at `:129`) — `(x·0.1 + y·0.07 + t·0.12) % len`,
  so a given cell changes palette slot every `1/0.12` = **8.33 s**.

In the reference all four slots are bright, so the drift reads as colour
shimmer. In ours, three of four slots are near-black, so what the eye gets is:
*each cell is faint pink for ~8 s out of every 33 s, grey the rest of the time.*
That is a slow stochastic blink, and it masks the wave rather than reinforcing
it. Combined with A1 (you can barely see the glyphs) the wave — which is
mathematically strong, spanning ~10 of the ramp's 69 steps — never registers.

---

#### A5 — On touch devices the field can never leave its resting alpha, and the plan's fix was dropped. **[V]**

`useAsciiField.ts` **does** implement the mobile answer:

```ts
// useAsciiField.ts:100-103
const coarsePointer = … matchMedia('(pointer: coarse)').matches;
const baseOpacity =
  coarsePointer && coarsePointerOpacity !== undefined ? coarsePointerOpacity : baseOpacityOpt;
```

But **no caller ever passes `coarsePointerOpacity`**:

```
grep -rn "coarsePointerOpacity" src/
→ useAsciiField.ts:30 (doc comment), :47 (type), :73 (destructure),
  :103 (use), :332 (deps)      # zero call sites
```

`AsciiHero.tsx:26-42` does not pass it; `LandingPage.tsx:72-79` does not pass it.
So on a phone: α rests at 0.18 (invisible per A1), and the only mechanism that
ever raises α is `mousemove` — which a phone never fires. `docs/ui-plan-landing-page.md`
WS-2 item 4 states "on `(pointer: coarse)` the resting opacity is raised". **It
isn't.** The feature is implemented and unwired.

---

#### A6 — Mobile renders a different grid, a different glyph size, and a different page model. **[C] + [V]**

**Three separately-fixable defects**, not one. (a) is a composition bug with a
layout fix; (b) is a renderer bug with a density-policy fix; (c) is a lifecycle
bug with a stability fix. They are listed together because they compound, but
each can and should be fixed on its own:

**(a) The canvas spans a different box.** `LandingPage.tsx:70`:
`min-h-screen lg:h-screen lg:overflow-hidden`. On `lg` the hero is exactly one
viewport and **cannot scroll**. Below `lg` it is `min-h-screen` and the document
scrolls — so the absolutely-positioned canvas (`:78`, `inset: 0`) spans the
**entire scroll length**, not the viewport. Same component, two different
geometries. This alone is enough to make it "act entirely differently".

**(b) The `MAX_CELLS` clamp makes glyph size viewport-dependent.**
`useAsciiField.ts:139-147` is an addition of ours — the reference has no density
clamp at all. It scales the font *up* until cells ≤ 7000, so bigger surfaces get
bigger glyphs:

| Surface | CSS box | effective glyph | grid |
|---|---|---|---|
| iPhone 14, first screen | 390×844 | **12 px** | 54×61 |
| iPhone 14, document ~2100 px | 390×2100 | **13 px** | 50×140 |
| iPad | 820×1180 | **15 px** | 91×68 |
| Laptop | 1440×900 | **17 px** | 141×46 |
| Ultrawide | 2560×1080 | **24 px** | 177×39 |

A **2× glyph-size swing** between phone and laptop. The field is fine noise on
mobile and chunky blocks on desktop. On a 390px-wide phone the clamp engages
above a document height of **1789 px** — so the same phone changes glyph size
*as content grows*.

*Assumption, stated:* the table uses a monospace advance of `0.6em`
(`cellW = fontSize·0.6`, the reference's own fallback at
`useAsciiField.ts` in the reference source). `measureText('M')` in a real
browser may differ by a few percent. **The 2× ratio holds for any fixed
advance**, because the clamp is a function of area, not of metrics.

**(c) It re-seeds on resize.** `resize()` ends with
`baseField = seedField({ cols, rows })` (`useAsciiField.ts:154`). On mobile the
browser UI chrome showing/hiding changes viewport height → `ResizeObserver`
fires (`:273`) → the whole field is re-randomised and re-laid-out **while the
visitor is scrolling**. On desktop, `h-screen` + `overflow-hidden` means this
never happens.

---

#### A7 — The "LAUNCH ENGINE" button's hover state does not work. **[V]**

`LandingPage.tsx:126-131`:

```tsx
className="… bg-[#111113] text-[#F8F7F4] … hover:bg-[#E33E33] hover:border-[#E33E33] hover:text-[#F8F7F4] …"
style={{ backgroundColor: '#111113', color: '#F8F7F4' }}
```

**[R]** An inline `style` declaration beats any author-level rule regardless of
specificity (CSS Cascade, "Origin, Importance and Specificity": inline styles
outrank author stylesheets). So `hover:bg-[#E33E33]` and `hover:text-[#F8F7F4]` can never win.

**Correction after review (E1).** The inline `style` sets only `backgroundColor`
and `color` — there is **no** inline `borderColor`, so `hover:border-[#E33E33]`
*does* apply. The border recolours on hover. What is broken is the **fill and
the label**, which stay `#111113`/`#F8F7F4`. Net effect on the primary CTA: a
2px outline shifts from ink to red over an unchanged black button — a weak,
ambiguous hover on the most important control on the page, not an absent one.
Same dead pattern on the Bloom tag at `:196` (`style={{ color: '#E33E33' }}`
alongside `group-hover:text-[#E33E33]`, harmless but dead).

The inline styles are redundant duplicates of the Tailwind classes in every
case. Deleting them fixes the hover.

---

#### A8 — The six Bloom cards are not operable by keyboard. **[V]**

`LandingPage.tsx:185-191` — each card is a plain `<div>` with `onClick`,
`cursor-pointer` and a `title` attribute. No `role`, no `tabIndex`, no key
handler, no visible focus state. Consequences:

- A keyboard visitor cannot reach the six cards at all, and gets no focus ring.
- `title` is not exposed reliably and never appears on touch — so the
  `shortSnippet → fullPrompt` swap at `:201` (`isHovered ? … : …`) is
  **hover-only content**: invisible on phones and to keyboard users.
- `docs/ui-plan-landing-page.md` WS-4 promised "Focus order: nav links, primary
  CTA, secondary CTA, then sections." There is no nav, and the cards are not in
  the order.

`DEVELOPING.md`'s "Motion budget" rule 1 is blunter than any a11y rule: *"any
keyboard-initiated action → None, ever."* The premise is that keyboard paths are
first-class. Here they do not exist.

---

#### A9 — Two components wrap the same hook; one is dead. Threading and rounding regressions. **[V]**

- `AsciiField.tsx` (33 lines) and `AsciiHero.tsx` (70 lines) both wrap
  `useAsciiField`. Only `AsciiHero` is imported. `AsciiField.tsx` is unreachable
  code, and `DEVELOPING.md:22` still points at it.
- `AsciiHero.tsx:33` defaults `fontFamily` to `'Space Mono', monospace`. ADR-0010
  §2 names **JetBrains Mono** as the figure/code face. Space Mono is loaded
  (`index.html:15`) *only* for the landing page — a second mono face, and the
  reason `index.html` grew.
- `useAsciiField.ts:219` draws at `Math.round(x·cellW), Math.round(y·cellH)`.
  The reference draws at unrounded `x·cellW`. With `cellW ≈ 7.2` the rounding
  produces column pitches of 7,7,8,7,7,7… — a periodic comb artefact in what is
  supposed to be a uniform monospace grid. It was added as an "optimisation";
  it is a fidelity regression.
- `frameMs` default is **60** (`useAsciiField.ts:79`) = **16.7 fps**. The
  reference default is **50** = **20 fps** (`docs/ui-plan-landing-page.md` §1
  records the choice: "throttled to 60ms"). So our port is *slower* than the
  thing it was criticised for never stopping. At 16.7 fps a 4.5 s wave is ~75
  frames — but with A1's contrast you perceive stutter, not breathing.
- `draw()` calls `canvas.getBoundingClientRect()` **every frame**
  (`useAsciiField.ts:158`), a forced layout read inside the render loop, even
  though the `ResizeObserver` already knows the box.

---

#### A10 — `index.html` still paints the retired neo-brutalist palette before React mounts. **[V]**

Added after review — this was a genuine miss in the first draft of this document.

`index.html:17`:

```html
<body class="bg-slate-50 text-slate-900 antialiased selection:bg-teal-500 selection:text-white min-h-screen">
```

`slate` and `teal` are the neo-brutalist palette that ADR-0010 retired. The
consequences are real even though React and `index.css` override most of it:

- **First paint and any pre-hydration flash** is slate-50, not warm paper — and
  `index.css:161-165` sets `body { background-color: #FAF8F5 }` (line 163), so the two
  disagree until the stylesheet lands.
- **Text selection** is hard-set to `bg-teal-500`/`text-white` here, while
  `LandingPage.tsx:70` sets `selection:bg-[#E33E33]`/`selection:text-[#F8F7F4]`
  and ADR-0010 wants amber. Three selection colours are declared in three
  places; the most specific wins per element, which is not a decision anyone made.

Fix: `<body class="min-h-screen antialiased">` and let `index.css` and the token
layer own colour. One-line change, and it removes a source of drift that no
component-level guard test can catch.

---

#### A11 — The spotlight already works; the palette starves it to 1-in-4. **[S]**

Added from the owner's 1440×900 hover screenshot. In it, the cells near the
cursor light up **red** at high alpha — the reference's "glow" is demonstrably
present in our code, under a pointer. What the same screenshot shows is that the
glow only appears where a cell's palette slot happens to be the single warm one.

`COGNITIVE_PALETTE = ['#E33E33', '#111113', '#C22B22', '#36363B']`
(`asciiFieldMath.ts:29`) is three near-black inks and one red, and
`paletteIndexAt` (`asciiFieldMath.ts:123-131`) cycles slots diagonally. So under
the spotlight, ~3 of every 4 lit cells darken (the blob of A2) and only ~1 in 4
glows warm. The mechanism is right; the input distribution is wrong.

This is the cheapest fix in the document, because it is a data change, not a
code change — swap the slot mix so warm hues dominate and one dark slot remains
for depth:

```ts
// starved: 1 warm / 4          // rebalanced: 3 warm / 4
['#E33E33','#111113','#C22B22','#36363B']   →   ['#E33E33','#C22B22','#D97706','#36363B']
```

With three warm slots, the `paletteIndexAt` drift reads as the reference's hue
shimmer instead of a grey flicker, and the spotlight reveals warm glyphs on ~3
of 4 cells. Pair it with the Layer 2 rest-band so the same warm hues sit quiet
at rest and bright under the pointer. It does not replace the contrast preset —
it fixes *which* hues the preset modulates.

#### A12 — The page's owned regions are mostly empty paper. **[S]**

Two composition defects visible in every viewport:

1. **The desktop left panel is ≈ half blank.** The wordmark sits top-left, the
   pitch and CTAs sit mid-left, and a large region below the buttons is empty
   paper (`LandingPage.tsx:97-148` uses `justify-between` with the pitch block
   `my-auto`). The panel "owns" its region, per the fix for A3, but then leaves
   most of it unused — the field cannot fill it because the panel is opaque.
2. **Each Bloom card at rest is mostly void.** The footer row
   (`COGNITIVE_L0x` + arrow) is `opacity-0` until hover (`:205`), so a resting
   card is a tag, one clipped line, and a large empty middle
   (`flex flex-col justify-between`, `:189`).

Neither is a contrast problem; both are density problems. The fixes are small
and local: give the left panel one more resident element (the plan's five-step
loop row, or the attribution footer the ADR already requires), and render the
card footer row dimmed at rest rather than hidden. These are exactly the kind of
change that becomes a one-line token/class diff once §4 Step 1 lands.

---

### 2.3 Summary of the diagnosis

Nothing in the *idea* is wrong. Canvas + character ramp + cursor ripple +
spotlight is a good hero, it is dependency-free, it fits the motion budget's
novelty tier, and ADR-0009's decision to port rather than install was right.

What is wrong is that the port is **a set of magic numbers with no model behind
them**. `0.18`, `0.9`, `10`, `60`, `7000`, `1.8`, `0.12` were tuned against one
specific dark 280px demo panel and then reused against a light full-viewport
page with 90%-opaque panels over it. There is no primitive that says *"this
field must be legible on the surface it sits on"* — so the moment the surface
changed, every number silently went wrong at once.

The screenshots add the corollary: the *mechanisms* (cursor ripple, spotlight,
wave) all work — the hover shot proves it. What fails is the **inputs** to those
mechanisms (a 1-in-4 warm palette, a 0.18 rest alpha, an 83.5%-covered box) and
the **composition** around them. So the fix order is: inputs and composition
first (cheap, data-level), renderer second, new primitives last.

That is the actual answer to "design better primitives": **not a better
renderer, a contract.**

---

## 3. Proposed foundation — the `AsciiSurface` primitive stack

Four layers. The core idea (canvas field, char ramp, cursor ripple, spotlight,
pause-when-hidden, static-under-reduced-motion) is kept **entirely intact**.
What changes is that the numbers become *derived* instead of *chosen*.

### Layer 1 — `fieldPrograms.ts` — **DEFERRED, do not build yet** [E8]

> Review correctly flagged this as speculative. There is **one** shipped consumer
> of the field and one dead wrapper; there is no second behaviour to express.
> `seedField`, `waveAt`, `cursorTermsAt` and `paletteIndexAt` are already
> isolated and unit-tested in `asciiFieldMath.ts` — that is enough structure for
> now. Build the abstraction only when a second shipped use actually needs a
> different field, and keep it until then as a noted option:

*For the record, the shape it would take:*

```ts
export interface FieldProgram {
  /** Resting shape, seeded once per resize. [0,1]. */
  seed(nx: number, ny: number): number;
  /** Time term added each frame. Signed, small. */
  wave(x: number, y: number, t: number): number;
  /** Optional per-cell tint index, replacing the palette drift. */
  tint?(x: number, y: number, t: number): number;
}

export const stripeRadial: FieldProgram  = { /* today's behaviour, unchanged */ };
export const columnDrift:  FieldProgram  = { /* soft vertical rain */ };
export const contour:      FieldProgram  = { /* concentric rings, "study depth" */ };
```

Default stays `stripeRadial`, so **the shipped look does not change unless we
ask it to**. This is what makes the hero iterable in review instead of
re-litigated per PR.

### Layer 2 — `surfaceContrast.ts`: contrast is computed, not picked  ← *the fix for A1/A2*

This is the piece the port is missing. The field should declare a **target
contrast band** and derive its own ink and alphas from the surface it is
mounted in:

```ts
export interface AsciiContrastPreset {
  restInk: string;   restAlpha: number;
  peakInk: string;   peakAlpha: number;
}

/** Reads the mounted surface's own tokens and solves for alpha. */
export function contrastFor(surface: 'paper' | 'ink', accent: string): AsciiContrastPreset;
```

**[E6] The bands below are proposals, not values taken from our design system.**
Nothing in `docs/adr/0010` or `docs/ui-plan-landing-page.md` states a contrast
target for the field. They are implementation decisions to be ratified, and the
right way to pin them is a test on the *outcome*, not a constant in the
renderer:

```ts
const page = '#F8F7F4';
const { restInk, restAlpha, peakInk, peakAlpha } = contrastFor('paper', accent);

// present at rest, but never competing with copy
expect(compositeContrast(restInk, restAlpha, page)).toBeGreaterThanOrEqual(1.45);
expect(compositeContrast(restInk, restAlpha, page)).toBeLessThanOrEqual(1.9);
// unambiguously perceptible under the pointer
expect(compositeContrast(peakInk, peakAlpha, page)).toBeGreaterThanOrEqual(3);
expect(compositeContrast(peakInk, peakAlpha, page)).toBeLessThanOrEqual(5);
```

**The ceiling that makes this non-obvious. [C]** On a light surface, every ink
is *darker* than the paper — there is no alpha at which a hue becomes "lighter".
So "the pointer makes the field glow" has a hard upper bound, and it differs
enormously by hue. Solving `contrastFor` across the candidate accents on the
landing paper `#F8F7F4`:

| candidate ink | **max contrast** (α = 1.0) | α for 1.6:1 | α for 2.0:1 | α for 3.0:1 | α for 3.5:1 |
|---|---|---|---|---|---|
| `#F59E0B` amber-500 | **2.00:1** | 0.664 | 0.996 | impossible | impossible |
| `#D97706` Academic Amber | **2.97:1** | 0.444 | 0.644 | **impossible** | **impossible** |
| `#E33E33` Variation-10 red | 3.92:1 | 0.340 | 0.493 | 0.777 | 0.898 |
| `#C22B22` crimson | **5.35:1** | 0.293 | 0.421 | 0.644 | 0.730 |
| `#36363B` charcoal | 11.22:1 | 0.256 | 0.363 | 0.537 | 0.598 |
| `#111113` carbon | 17.61:1 | 0.215 | 0.304 | 0.450 | 0.501 |
| `#0F172A` app ink | 16.66:1 | 0.220 | 0.312 | 0.462 | 0.514 |

Three things fall out of that table, and one of them invalidates what this
document said before review:

1. **[E3] A warm reveal in Academic Amber cannot reach 3:1 on paper at any
   alpha** — it tops out at 2.97:1. My earlier claim that amber is "the only
   direction that reads as light" was wrong twice over: amber is darker than the
   paper, *and* it is the weakest of the warm candidates. `#F59E0B` is worse
   still at 2.00:1.
2. **If we keep a warm peak, the hue has to be deep.** `#C22B22` — already the
   third slot of `COGNITIVE_PALETTE` (`asciiFieldMath.ts:29`) — spans 1.6:1 at
   α 0.293 all the way to 5.35:1, which is the widest usable band of any accent
   here. `#E33E33` reaches 3.92:1 but needs α 0.898 to get to 3.5:1, i.e.
   essentially opaque, which is the blob problem again.
3. **The knockout lens is the option that sidesteps the ceiling entirely**,
   because it works by *removing* ink rather than adding a hue: under the
   pointer, drive α **toward zero** so the field thins out to near-paper, and
   draw the accent only as a thin ring at `rippleRadius` where a small area at
   full α is legible even for amber. On paper this reads as a lens, not a stain.

**Recommendation.** Sequence it by cost. **Step zero — the data-level fix from
A11:** rebalance the palette to three warm slots and raise the rest alpha into
the 1.45–1.9 band. This needs no new code and directly turns the existing,
working spotlight into a mostly-warm glow. **Then**, if the blob still reads as
a stain, prototype the knockout lens and a `#C22B22` warm reveal, choose one by
eye, and record the winner in the ADR. The decision is a two-line diff either
way, because both are expressed through the same preset.

All four numbers become pure functions → unit-testable in node, which is
exactly `DEVELOPING.md`'s "layer 1: pure logic" preference.

### Layer 3 — `useAsciiField` — four targeted fixes, not a rewrite

| Fix | Change | Fixes |
|---|---|---|
| **Density by cell size, not cell count** | Replace `MAX_CELLS = 7000` (`:139`) with a `targetCellPx` (default ≈ 9 CSS px) and let the count fall out. Cap the *frame cost* with an offscreen `OffscreenCanvas`/pre-rendered glyph atlas if needed, not by inflating the glyph. | A6(b) — one glyph size everywhere |
| **One pointer source** | Replace `window.addEventListener('mousemove')` (`:311`) with `pointermove` (covers mouse/touch/pen in one), and **wire `coarsePointerOpacity`** — the review's suggested `0.38` composites to **2.45:1** on `#F8F7F4`, a large step up from the current 0.18 → 1.47:1. Longer term derive it from the Layer 2 preset instead of typing it. | A5 |
| **Autonomous drift on coarse pointers — *gated, not default*** | A Lissajous path the spotlight follows when no pointer is present would make a phone hero feel alive. But it is a **new continuous animation**, so per ADR-0005 it must be listed in the motion budget's rare/first-run row and carry a `prefers-reduced-motion` off-switch. **Ship the static `coarsePointerOpacity` fix first**; add drift only if the phone hero still feels dead after that. | A5 (follow-up) |
| **Frame pacing** | Keep the throttle but make it a `fps` prop (default 20, matching the reference) and drop `getBoundingClientRect()` from the loop — take the rect from the `ResizeObserver` entry. | A9 |
| **Uniform grid** | Draw at `x·cellW` unrounded; round `cellW` **once** per resize instead. | A9 comb artefact |

Keep, unchanged: the `IntersectionObserver` + `visibilitychange` pause, the
`document.fonts.ready` re-measure, the reduced-motion single frame, the
alpha/fill state caching, `aria-hidden`.

### Layer 4 — `AsciiSurface`: one component, explicit composition

Delete `AsciiField.tsx` **and** `AsciiHero.tsx`. One component, three modes, no
inline-style/class duplication:

**Ship one variant.** [E8] Building `ambient | panel | band` together is
speculative generality for a page with one hero. Start with `band`, because it
is the variant that answers A3; add the others only when a real caller needs them.

```tsx
<AsciiSurface
  variant="band"          // the only variant for now
  surface="paper"         // drives contrastFor() → no alpha props at all
  accent="var(--landing-accent)"
  fps={20}
/>
```

`band` is a self-contained horizontal strip (≈ 240px) with its own surface. It
is the direct answer to A3: the field gets a **region it owns** instead of being
buried under 83.5% of the viewport. A full-bleed band under the wordmark, with
the panels starting below it, keeps the effect *and* keeps the panels readable.

Later, only on demand: `ambient` (behind content — which **requires** that the
content above it not be opaque, a composition rule that belongs in the
component's docblock) and `panel` (the reference's bordered card).

### What has to change if we do this

| Area | Change |
|---|---|
| **Code** | New: `fieldPrograms.ts`, `surfaceContrast.ts`, `AsciiSurface.tsx`. Deleted: `AsciiField.tsx`, `AsciiHero.tsx`. Edited: `useAsciiField.ts` (4 targeted fixes), `asciiFieldMath.ts` (keep the pure functions, add the derived-contrast ones), `LandingPage.tsx` (composition). |
| **Tests** (per `DEVELOPING.md` "Testing", layer 1 first) | Extend `asciiFieldMath.test.ts`: `contrastFor('paper', amber).restAlpha` lands in [0.20, 0.30]; `peakAlpha` composite ≥ 3:1; `densityFor(w,h,targetCellPx)` returns the *same* glyph size for 390×844 and 1440×900. New source guard `landingDesignSystem.test.ts`: every interactive element in `LandingPage.tsx` is a `<button>` or `<a>`; no `style={{…}}` on a node that also has a `hover:` class (catches A7 mechanically); no raw hex outside the token file. |
| **Docs** | `DEVELOPING.md:22` → `AsciiSurface`. `docs/ui-plan-landing-page.md` → mark WS-2 item 4 as *regressed in `8b37173`, restored in this change*. New **ADR-0011** if the accent/type direction changes (see §5). |
| **Motion budget** | Unchanged. The field stays the page's only continuous animation and still stops when hidden/off-screen/reduced-motion. The autonomous drift on coarse pointers must be listed in `DEVELOPING.md`'s rare/first-run row so it is not mistaken for a leak. |
| **Bundle** | Neutral. Zero new dependencies; `AsciiField.tsx` deletion is a small win. The `/` chunk is currently **76.03 kB gzipped** (`dist/assets/index-DYkw6yXJ.js`), consistent with ADR-0009's ~70 kB. Verified it contains no `recharts`, `katex`, `studyStore` or `AiGenerator` (grep count 0 for each). |
| **Risk** | Low and reversible. `stripeRadial` as the default program means the arithmetic is preserved; the visible change is contrast and composition, both of which are what we are trying to change. |

---

## 4. Concern 2 — the three proposed libraries

### 4.1 They are not three options for the same problem

This is the most important thing to say about the list. They operate at three
different layers, and only one of them is about *how the product looks*:

| Library | Layer | What it actually changes | Runtime cost |
|---|---|---|---|
| **shadergradient** | **Runtime rendering** | Adds a WebGL 3D gradient canvas | `three` + `@react-three/fiber` + `three-stdlib` + `camera-controls` |
| **StyleX** | **Build-time authoring** | How styles are *written and compiled* — atomic CSS out of `stylex.create()` | ~0 at runtime; one more build plugin |
| **Astryx** | **Component + token system** | Replaces the component layer and the token source | `@astryxdesign/core` + `@stylexjs/stylex` peer |

None of them answers the question that actually broke in `8b37173`: *what are
our tokens, and what stops a screen from inventing its own?*

**[V]** That question has a number attached to it:

```
grep -o '#[0-9A-Fa-f]\{6\}' src/components/landing/LandingPage.tsx | wc -l
→ 48
```

`#111113` ×20, `#F8F7F4` ×15, `#E33E33` ×13 — in **one 225-line file**. Across
`src/` the landing page is the worst offender by a factor of 2.5 over the next
file (`temariDiagramProfile.ts`, 19, and that one is a deliberate diagram-token
module). The design language is not under-versioned; it is **not in code at
all**. `index.css` defines `--surface-page`, `--surface-well`,
`--surface-panel`, `--surface-float` (`src/index.css:101-104`) and the landing
page uses **none of them**.

### 4.2 shadergradient — <https://github.com/ruucm/shadergradient#react>

**What it is.** MIT-licensed WebGL 3D gradient renderer (`ShaderGradient` +
`ShaderGradientCanvas`), driven by props or a `shadergradient.co/customize` URL.
Install (from the README):

```
npm i @shadergradient/react @react-three/fiber three three-stdlib camera-controls
```

**Compatibility.** Not the problem. The README's matrix says React 19 +
`@react-three/fiber` v9 + `three ≥ 0.158` is the supported Vite/React-19
combination; Temari is React 19 + Vite 6. It also ships `lazyLoad`, `threshold`
and `rootMargin` props, so it can be kept off the critical path.

**Cost.** **[V]** `npm view <pkg> dist.unpackedSize`:

| package | unpacked |
|---|---|
| `three` 0.186.0 | **20.4 MB** |
| `three-stdlib` 2.36.1 | **26.4 MB** |
| `@react-three/fiber` 9.7.0 | 2.19 MB |
| `camera-controls` 3.1.2 | 376 kB |
| `@shadergradient/react` 2.4.20 | 384 kB |

Unpacked ≠ shipped (three tree-shakes), but this is a **WebGL runtime**, not a
utility. Against a `/` chunk we have deliberately held at 76 kB gzipped, and
against ADR-0009's explicit finding that "the landing entry chunk is ~70 kB
gzipped and contains none of the study code", this is a different order of thing.

**Conflicts.** Four, all written:

1. `docs/adr/0004` rule 5 — *"No animation library… if something genuinely can't
   be built without a library, write an ADR first."*
2. `docs/ui-plan-landing-page.md` §6.2 — *"No new dependency."*
3. `docs/adr/0010` §4 — *"no Mermaid runtime"*; the whole diagram system exists
   because we chose native SVG over a rendering runtime.
4. `docs/adr/0005` — a continuously animating WebGL surface behind a *study
   workspace* is not in any tier of the motion budget. It would have to stop on
   `/app` anyway, which means paying for it on one page.

**It also does not solve the stated problem.** Swapping the ASCII field for a
shader gradient does not make the ASCII port better — it deletes the thing
ADR-0009 chose to port, and replaces a 1.3 kB hand-owned canvas with a WebGL
stack, for a *quieter* effect than the one we already have.

**The OG-image idea, corrected. [E7]** `docs/ui-plan-landing-page.md` §7 lists
the top follow-up as an Open Graph image, and **[V]** there is currently none —
`grep -c 'og:image' index.html` returns `0`, and `public/` holds only
`_redirects` and `fonts/`. This document originally proposed rendering one with
`ShaderGradient` in a build script at ≈ 0.5 d. **That estimate was wrong**: an
R3F/WebGL canvas does not render in plain Node, so the path needs headless WebGL
or a real browser in CI — real setup, and it puts a browser dependency in the
build for the sake of a static asset.

Revised order:

1. **Ship a static OG image first** — an SVG or a pre-rendered PNG of the
   wordmark on paper. No new dependency, no build-time browser.
2. If we later want a generated card, add a dedicated `/og` route and screenshot
   it in CI with Playwright.
3. Reach for `shadergradient` **only** if the asset specifically needs its look
   and the two options above are not enough.

> **Verdict: decline for the app runtime. For assets, static first;
> `shadergradient` is a later, optional choice — not a cheap win.**

### 4.3 StyleX — <https://stylexjs.com/docs/llm-resources>

**What it is, precisely.** The linked page is *documentation for LLM agents*,
not a component library. Its substance is that StyleX is a **build-time
compiler**: `@stylexjs/stylex` plus `@stylexjs/unplugin` in `vite.config.ts`
(placed **before** `@vitejs/plugin-react`), plus an `@stylex;` directive in the
CSS entry, plus optional `@stylexjs/eslint-plugin`. It converts
`stylex.create({...})` into deterministic atomic CSS with a defined merge order.

**Fit with what we have.** Temari is Tailwind 4 via `@tailwindcss/vite`, with
1092 lines of hand-written `index.css`, `cn()` + `tailwind-merge`
(`src/lib/utils.ts`), and 23 shadcn-style primitives in `src/components/ui/`.
Adding StyleX means:

- a second styling system in the same files,
- cascade-layer ordering to manage (the docs' own "StyleX precedence" section:
  *"use `useCSSLayers` to determine style precedence"*),
- `src/components/ui/designSystem.test.ts` — which reads `index.css` as text and
  asserts on it — needs to understand a second CSS output,
- every existing screen eventually migrated, or permanently mixed.

**What it buys us.** StyleX's real payoff is at Meta's scale: thousands of
components, deterministic merge semantics, no dead CSS. Temari is 108
`.ts`/`.tsx` files. And crucially, **StyleX does not make a design bolder** — it changes how
styles are authored, not what they are. It would not have prevented a single
finding in §2.2.

**But the diagnosis it implies is correct.** The property we actually want from
StyleX is *"one token source, and you cannot invent a hex"*. We can have that
for a fraction of the cost, because we already have the token file:

```css
/* index.css — promote what is already there, add what is missing */
:root {
  --color-page:    var(--surface-page);   /* exists, #FAF8F5 */
  --color-ink:     #0F172A;
  --color-accent:  /* DECIDE: amber #D97706 (ADR-0010) or red #E33E33 (8b37173) */
  --font-display:  'Playfair Display', Georgia, serif;
  --font-body:     'Inter', …;
  --font-mono:     'JetBrains Mono', …;
  --font-ethiopic: 'Abyssinica SIL', …;
}
```

…plus one source-guard test that fails when a component contains a raw hex
outside `index.css` / `figureTokens.ts` / `asciiFieldMath.ts`. That is the
StyleX benefit, at zero dependencies, zero build plugins, and it is the guard
that would have caught `8b37173` in CI.

> **Verdict: decline. Take the discipline, not the compiler.**

### 4.4 Astryx — <https://astryx.atmeta.com/docs/getting-started>

**What it is.** Meta's React 19 design system: `@astryxdesign/core` components,
themes as CSS custom properties, and a CLI (`astryx component`, `astryx docs
tokens`, `astryx template --skeleton`) that also writes `AGENTS.md`/`CLAUDE.md`
so agents learn the conventions.

**Compatibility.** **[V]** `npm view @astryxdesign/core peerDependencies` →
`react >=19.0.0`, `react-dom >=19.0.0`, `@stylexjs/stylex ^0.19.0`. Temari is on
React 19 ✅ — but **Astryx requires StyleX**, so §4.3 is not optional if we take
Astryx. Sizes: `@astryxdesign/core` 20.2 MB unpacked, `@astryxdesign/cli` 6.5 MB,
`@astryxdesign/theme-neutral` 191 kB.

**Direct collisions with decisions we have already made.** Astryx's migration
guide recommends, in order: *AppShell → TopNav → SideNav → page content →
mobile navigation*, then replacing *Button, IconButton, TextInput, Switch,
Selector, Tabs, Dialog, AlertDialog, Banner, Toast, Badge, Card, Table,
ListItem*, then *command palette, settings popover, destructive confirmation
dialogs*.

Temari already owns every one of those — 23 primitives in
`src/components/ui/` — and three of them are guarded by tests
(`keyboardOwnership.test.ts`, `modalRegistry.test.ts`, `designSystem.test.ts`).
And `SideNav` is a component we **deliberately removed**: `docs/adr/0006` is
titled *"Sidebar removal — header-only chrome; no sidebar."* Adopting a shell
whose recommended entry point is `AppShell` + `SideNav` is adopting an
architecture we wrote an ADR to leave.

**Its own docs describe our exact failure mode.** From the getting-started page:
*"If your project has existing global CSS, a legacy reset, or **Tailwind**,
declare the layer order explicitly and assign every stylesheet to a layer
deliberately: unlayered styles and later layers both override `astryx-base`
regardless of specificity."* And the migration guide's Cascade Layer Safety
section: *"This is the most common way an adoption breaks… Same CSS, opposite
outcome, and no error or warning when it happens."* Temari is 1092 lines of
**unlayered** `index.css` plus Tailwind 4 — precisely the configuration it warns
about.

**Its own framing of the work.** *"Treat migration as a product-shell and
workflow migration, not a global class replacement."* That is a multi-week
shell rewrite across five hubs, not a design upgrade.

**And it would not give us our look anyway.** The shipped themes are `neutral`,
`butter`, `chocolate`, `gothic`, `matcha`, `stone`, `y2k`. Warm paper `#FAF8F5`,
Academic Amber, an Ethiopic-first wordmark and Playfair headings is none of
them; the documented path is `astryx theme template` — *"fill in the annotated
template it writes"* — i.e. **we author the tokens ourselves**, which is the
thing `index.css` already contains.

**The one idea worth stealing, without the dependency.** `npx astryx init`
writes machine-readable agent docs; `astryx component Button --json` and
`astryx docs tokens` make the design system *queryable*. Temari already has the
human-readable half (`DEVELOPING.md`, `CONTEXT.md`, `docs/adr/`). We are missing
the machine-readable half: there is no single artefact that answers "what tokens
and primitives exist" without reading 1092 lines of CSS. A generated
`docs/design-tokens.json` + a line in `DEVELOPING.md` pointing agents at it
gets the benefit for about a day of work and no dependency.

> **Verdict: decline for the shell. Steal the "design system as a queryable
> artefact" pattern.**

### 4.5 What to do instead — the actual elevation plan

The bottleneck is not missing libraries. It is that the design language lives
in prose, so nothing stops a screen from reinventing it. Fix that, then spend
boldness where it is cheap.

**Step 1 — Token layer + guard (≈ 1 day, zero dependencies).**
Promote the tokens in §4.3 to first-class CSS custom properties; add
`--color-accent` as a **single** decision; convert `LandingPage.tsx`'s 48 raw
hexes to tokens; add a source-guard test that fails on a raw hex outside the
token files. **This is the change that makes "bolder" safe** — after it, a
boldness experiment is one variable, revertible in one line.

**Step 2 — Resolve the two design languages (a decision, not code).**
See the open question in §5. Whatever is chosen, it goes in an ADR
(`0011-display-identity.md`), and `README.md`, `index.html:7-8` and
`metadata.json` (both still say "neo-brutalist") get corrected.

**Step 3 — The `AsciiSurface` stack (§3).** The hero becomes legible, alive, and
identical across breakpoints.

**Step 4 — Carry the primitives into the app, where they earn their keep.**
Three concrete, small, on-language ideas — all reusing what Step 3 builds:

| Where | Idea | Reuses |
|---|---|---|
| `src/components/ui/EmptyState.tsx` | A tiny `AsciiSurface mode="panel"` (≈ 120×80) breathing behind the empty state, so an empty Subject feels *idle*, not broken. Static under reduced motion. | Layer 2 + 4 |
| `src/components/analytics/AnalyticsView.tsx` | The Bloom-mastery matrix as an ASCII-density heatmap: cell glyph = accuracy, cell tint = cognitive level. It is the same maths, it is a **figure** in ADR-0010's sense (no charting runtime), and it makes the app's most distinctive data legible. | Layer 1 |
| `src/components/landing/LandingPage.tsx` | A `mode="band"` divider between sections, so the field is a recurring motif rather than a one-off hero. | Layer 4 |

**Step 5 — OG image via shadergradient at build time (§4.2).** Closes the
top follow-up in `docs/ui-plan-landing-page.md` §7.

**Step 6 — Font hygiene, which is now a real cost.** **[V]** `index.html:15`
requests **8 families / 29 declared instances** in one render-blocking
`<link rel="stylesheet">`: Abyssinica SIL 1, Noto Serif Ethiopic 4, Playfair
Display 5, Plus Jakarta Sans 5, Inter 4, JetBrains Mono 4, Space Mono 4, Syne 2.
Three problems, all provable by reading two files:

- **Duplication.** `src/index.css:21-28` self-hosts Abyssinica SIL with a
  `unicode-range`, and `index.html` also downloads it from Google.
- **Contradiction.** `src/index.css:33-41` deliberately declares Playfair
  Display as `local()` only, with the comment *"it is Latin-only, decorative,
  and not worth a render-blocking download"* — while `index.html` downloads 5
  Playfair instances render-blocking.
- **Three body faces.** `src/index.css:1020` sets `--font-sans: 'Geist Variable'`
  (from `@import "@fontsource-variable/geist"`, line 2) and `html { @apply
  font-sans }` (lines 153-154), while `body` (line 162) sets
  `'Inter', 'Plus Jakarta Sans', …`. Whichever wins, one of them is dead weight.
- **Space Mono and Syne exist only for the landing page** (`grep -rl 'Space Mono'
  src/` → `AsciiHero.tsx`, `LandingPage.tsx`, `index.css`). If Step 2 lands on
  the editorial language, both leave, and the canvas field goes back to
  JetBrains Mono per ADR-0010 §2 — which also removes a font-readiness race,
  since JetBrains Mono is already needed by the app.

---

## 5. Open questions for the group

These are decisions, not implementation details, and §4 Step 2 is blocked on the
first one.

1. **Which design language is canonical — and is the landing page allowed to
   differ from the app?** ADR-0010 says Modern Academic Editorial is *the*
   single language; `8b37173` shipped a second one. Three honest options:
   **(a)** revert the landing to editorial (amber/Playfair/paper) and keep the
   ASCII field as a texture — smallest change, restores consistency, arguably
   loses the energy;
   **(b)** promote Variation 10 (red/Syne/Space Mono) to a documented
   *marketing-only* language, amend ADR-0010 to say so explicitly, and keep the
   app editorial — this is what the page currently implies, but it needs writing
   down and it needs the CTA→shell transition (`Root.tsx:26-37` `AppLoading`
   renders the *editorial* header) to not look like a bug;
   **(c)** move the whole product to Variation 10 — largest change, contradicts
   ADR-0010's core reasoning (a dense five-hub study workspace is exactly what
   the loud language competed with).
   *My recommendation: (b), with the accent reduced to a single token so the
   two languages share a spine.*
2. **Is `#E33E33` the accent, or is Academic Amber?** This is one variable once
   Step 1 lands. It should not be answered by whichever file was edited last.
3. **Is the ASCII hero a hero or a texture?** §3 Layer 4's `mode="band"` assumes
   it owns a region. If the group wants it full-bleed instead, then the panels
   must stop being 90%-opaque (A3), which is a bigger visual change.
4. **Do we want a machine-readable design-token artefact** (§4.4), given we
   already maintain `DEVELOPING.md` + `CONTEXT.md` + 10 ADRs by hand?

---

## 6. Sequencing and effort

| # | Work | Depends on | Effort | Risk | Reversible? |
|---|---|---|---|---|---|
| 0 | **Palette rebalance (3 warm / 1 dark) + rest alpha into 1.45–1.9 band** [A11, S] — data-only, no code | — | 0.25 d | Low | Yes |
| 0b | Left-panel resident element + Bloom card footer dimmed-at-rest [A12, S] | — | 0.5 d | Low | Yes |
| 1 | Token layer + hex guard test | — | 1 d | Low | Yes |
| 2 | ADR-0011 display identity + README/`index.html`/`metadata.json` corrections | Q1, Q2 | 0.5 d | Low | Yes |
| 3 | `surfaceContrast.ts` + contrast-band tests | 1 | 1 d | Low | Yes |
| 4 | `useAsciiField` four fixes (density, pointer, pacing, grid) | — | 1.5 d | Medium | Yes |
| 5 | `AsciiSurface` + delete `AsciiField`/`AsciiHero` + `landingDesignSystem.test.ts` | 3, 4 | 1 d | Low | Yes |
| 6 | Landing recomposition (`variant="band"`, real `<button>`s, footer + attribution, catalog-driven provider list, `BLOOM_LEVELS`-derived cards) | 5 | 1 d | Low | Yes |
| 7 | Font hygiene **+ `index.html` body class (A10)** | 2 | 0.5 d | Low | Yes |
| 8 | In-app primitives (EmptyState, Bloom heatmap) — *optional* | 5 | 2 d | Low | Yes |
| 9 | Static OG image (SVG/PNG) — *optional; `shadergradient` only later* | 2 | 0.5 d | Low | Yes |
| — | `fieldPrograms.ts` abstraction — **deferred** until a 2nd consumer exists [E8] | — | — | — | — |
| — | `AsciiSurface` `ambient`/`panel` variants — **deferred** until a caller needs them [E8] | — | — | — | — |
| — | Autonomous spotlight drift on coarse pointers — **gated** on the motion budget, only if the phone hero still feels dead | 4 | 0.5 d | Medium | Yes |
| — | Enable `strict` in `tsconfig.json` (latent `string \| undefined` class of bug across 108 files) — **own ticket, out of scope here** | — | ~1 d + fixes | Medium | Yes |
| — | **StyleX** | — | — | — | **Declined** |
| — | **Astryx** | — | — | — | **Declined** |
| — | **shadergradient in the app** | — | — | — | **Declined** |

### If we only do one thing

**Step 0 — the palette/rest-alpha rebalance.** It is the single cheapest change (data-only, ≈ a quarter day) and the screenshots show it converts an already-working spotlight into a mostly-warm glow.

**Step 1 — the token layer plus the hex guard.** It is the only change that
makes every other change cheap and safe: once `--landing-accent` exists, the
contrast preset (step 3), the ADR decision (step 2), the recomposition (step 6)
and any future boldness experiment all become one-variable diffs instead of
48-hex edits. It is also the change that would have caught `8b37173` in CI.

Steps 1–7 then land the whole of Concern 1 plus the safe half of Concern 2 in
about a week, with no new runtime dependency and no ADR except the one we owe
anyway. Steps 8–9 are optional. The three declined libraries stay declined.

---

## 7. Implementation log

Phases are executed in the order of §6. Status is updated as work ships.

> Note on hashes: the working sandbox re-clones this repository between
> sessions, and unpushed local commits do not survive that — the working-tree
> files do. The phase work therefore collapsed into the single commit
> `add9c40` (branch `arena/01a08b3b-temari`, pushed to origin, so it is
> stable). The per-phase commits recorded while each phase landed are gone;
> their content is all in `add9c40`, and each phase's verification below was
> run against the working tree at the time it landed.

| Phase | §6 row | Status | Commit | Verified by |
|---|---|---|---|---|
| 0 | 0 | **Done** | `add9c40` | `asciiFieldMath.test.ts` (warm-majority palette), entry chunk unchanged |
| 0b | 0b | **Done** | `add9c40` | visual (rest-state footer now dimmed; left panel has attribution) |
| 1 | 1 | **Done** | `add9c40` | `landingDesignSystem.test.ts`: no raw hex, no inline style object, no div-button, derived providers/Bloom, `font-ethiopic` wordmark |
| 2 | 2 | **Done** | `add9c40` | `docs/adr/0011-…md`; README/DEVELOPING/index.html/metadata de-neo-brutalised |
| 3 | 3 | **Done** | `add9c40` | `surfaceContrast.test.ts` (12 tests): WCAG contrast, alpha bisection round-trip, amber ceiling → deep fallback, REST/PEAK bands |
| 4 | 4 | **Done** | `add9c40` | `asciiFieldMath.test.ts` `gridFor` (4 tests): same glyph size phone↔laptop |
| 5 | 5 | **Done** | `add9c40` | `landingDesignSystem.test.ts`: scans `AsciiSurface.tsx`, fails if either wrapper returns; solved alphas rest 1.60:1 / peak 3.50:1 / coarse 1.90:1 |
| 6 | 6 | **Done** | `add9c40` | band composition: wordmark masthead → 240px bordered band → panels below; nothing overlaps the field; 22 files / 339 tests, `tsc` clean |
| 7 | 7 | **Done** | `b3c28b9` | Font hygiene: Google link 8 families/29 instances → 5/19 (Abyssinica self-hosted duplicate, unreachable Noto Serif Ethiopic, dead Syne and all unused italics removed); contradictory Playfair `local()` `@font-face` removed (ten components render `.font-editorial`, so the download stays); dead `html { @apply font-sans }` and `.font-syne` removed. Body face unchanged — no visual drift. |
| — | perf (user-reported ~5 s landing→app stall) | **Done** | `b3c28b9` | `Root.tsx` warms the app chunk at idle (`requestIdleCallback`, 4 s timeout) while the visitor reads the landing, so the CTA swaps from cache instead of starting a ~337 kB-gzip download at click time. Deliberate revision of ADR-0009's "never downloads until the CTA click" prose — the measured guardrail (entry chunk ~77 kB, zero study code) is unchanged and re-verified: `recharts`/`katex`/`studyStore`/`AiGenerator` grep counts 0/0/0/0. |
| 8 | 8 | **Done** | `4a0cca4` | `bloomHeat.test.ts` (6 tests): ramp extremes + monotone, matrix alignment in BLOOM_LEVELS order, null cells, busiest-topic ranking; EmptyState breath covered by guard scan + tsc |
| 9 | 9 | **Done** | `7d53f94` | `public/og.png` (1200x630, 93 kB) rendered by `scripts/generate-og.py` and viewed before wiring; guard test asserts og:image meta + asset existence |

Checks after each phase (run in-sandbox after a fresh `npm install`):
`npm test` → 23 files / 346 passed · `npm run lint` (`tsc --noEmit`) → clean ·
`npm run build` → `/` entry `index-B06KbjPo.js` 77.80 kB gzip, containing no
`recharts`/`katex`/`studyStore`/`AiGenerator` (ADR-0009 guardrail holds).

Still owed: real-device touch test of the coarse-pointer path (A5), and a visual
pass on the recomposed hero once a browser is available.

---

## Appendix A — verification commands

Everything below was run in this checkout at `8b37173` with a clean `npm install`.

```bash
# Baseline
npm test        # 20 files, 317 tests passed
npm run lint    # tsc --noEmit, clean
npm run build   # built in 8.55s

# A3 / bundle guardrail (ADR-0009)
ls dist/assets                       # index-DYkw6yXJ.js 241.17 kB / gzip 76.03 kB
for s in recharts katex studyStore AiGenerator; do
  grep -c "$s" dist/assets/index-DYkw6yXJ.js; done      # 0 0 0 0

# A5 — coarsePointerOpacity has no call sites
grep -rn "coarsePointerOpacity" src/

# A7 — inline style defeating hover
sed -n '124,132p' src/components/landing/LandingPage.tsx

# A8 — cards are divs
sed -n '185,192p' src/components/landing/LandingPage.tsx

# A9 — dead component
grep -rn "AsciiField" src/ --include=*.tsx

# §4.1 — token discipline
grep -o '#[0-9A-Fa-f]\{6\}' src/components/landing/LandingPage.tsx | wc -l   # 48

# §4.2 — dependency weight
npm view three @react-three/fiber three-stdlib camera-controls \
  @shadergradient/react dist.unpackedSize

# §4.4 — peer requirements
npm view @astryxdesign/core peerDependencies
```

**Errata checks (§0.1)** — the commands that settled each disputed point:

```bash
# E1 — the CTA hover: no inline borderColor, so the border DOES recolour
sed -n '126,131p' src/components/landing/LandingPage.tsx

# X1 — shortLabel IS supplied for all five nav items (claimed "Miss 1")
grep -n "shortLabel" src/App.tsx src/components/nav/HubTabs.tsx
# and the review's proposed label 'Mock Exams' would break a passing test:
grep -n "not.toContain('mock')" src/components/ui/glossary.test.ts   # line 49

# X2 — StoredNote.updatedAt is REQUIRED, not optional (claimed "Miss 5")
sed -n '1,30p' src/types.ts        # :12 optional on Subject; :23 required on StoredNote

# X3 — there is no `improve-ui` skill locked in this repo
python3 -c "import json;s=json.load(open('skills-lock.json'))['skills'];\
print(len(s), 'improve-ui' in s)"                                  # 60 False

# A10 — index.html body class
grep -n "<body" index.html                                         # line 17

# the strict-mode gap
grep -c strict tsconfig.json                                       # 0
```

The colour/density arithmetic (A1, A2, A3, A4, A6, and the whole Layer 2
ceiling table) is ~60 lines of plain Node: alpha compositing
`src·a + dst·(1−a)`, WCAG relative luminance `0.2126R + 0.7152G + 0.0722B` over
sRGB-linearised channels, the `MAX_CELLS` clamp transcribed from
`useAsciiField.ts:139-147`, and a bisection solver for "what α hits target
contrast T". Say the word and I will commit it as `docs/analysis/ascii-field.mjs`
so every number in this document is re-runnable rather than quoted.

## Appendix B — sources

**Our codebase**

- `src/components/landing/LandingPage.tsx` · `AsciiHero.tsx` · `AsciiField.tsx` · `useAsciiField.ts` · `asciiFieldMath.ts`
- `src/index.css` (1092 lines) · `index.html` · `metadata.json` · `src/Root.tsx`
- `src/components/ui/*` (23 primitives) · `src/components/ui/designSystem.test.ts` · `glossary.test.ts` · `keyboardOwnership.test.ts`
- `shared/aiCatalog.ts` · `src/types.ts:56` (`BLOOM_LEVELS`)

**Our docs**

- `CONTEXT.md` · `DEVELOPING.md` · `README.md`
- `docs/adr/0004` (no animation library) · `0005` (motion budget) · `0006` (sidebar removal) · `0009` (route split, port-not-install) · `0010` (editorial design system)
- `docs/ui-plan-landing-page.md` · `docs/ui-plan-editorial-shell-export.md` · `docs/ui-plan-spatial-consistency.md` · `docs/ui-audit-taste-skill.md`

**Reference implementation** (read from source, not from the rendered site)

- <https://raw.githubusercontent.com/vorpus/performativeUI/main/src/hooks/useAsciiField.ts>
- <https://raw.githubusercontent.com/vorpus/performativeUI/main/src/components/AsciiHero.tsx>
- <https://raw.githubusercontent.com/vorpus/performativeUI/main/demo/js/ascii-hero.js>
- `src/styles.css` (`.pui-ascii`, `.pui-ascii--panel`) and `docs/lib/meta.tsx` (slug `ascii-hero`) in <https://github.com/vorpus/performativeUI>
- Preview the owner compared against: <https://vorpus.github.io/performativeUI/#/components/ascii-hero>

**Owner-supplied screenshots ([S] evidence, §0.3)**

`ultrawide-2560x1080-viewport.png` · `desktop-1920x1080-fullpage.png` ·
`desktop-1440x900-fullpage.png` · `desktop-1440x900-hover2.png` ·
`tablet-ipad-viewport.png` · `tablet-ipad-fullpage.png` ·
`mobile-iphone14-viewport.png` · `mobile-iphone14-fullpage.png`

**Proposed libraries**

- shadergradient — <https://github.com/ruucm/shadergradient#react> (README: install, compatibility matrix, props, MIT)
- StyleX — <https://stylexjs.com/docs/llm-resources> (installation guide: `@stylexjs/unplugin` + `@stylex` directive + `useCSSLayers`; "StyleX precedence" troubleshooting)
- Astryx — <https://astryx.atmeta.com/docs/getting-started> (install, React ≥ 19 + StyleX peer, themes, CLI, Tailwind cascade-layer warning) and <https://astryx.atmeta.com/docs/migration> (recommended order, Tailwind v4 coexistence, Cascade Layer Safety)

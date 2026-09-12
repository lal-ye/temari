# Temari documentation

This file is the guide to the docs: what exists, what each document is for, and
how to add or retire one. It is the only documentation link from the
[repository README](../README.md).

## Where to look

| If you want to know… | Read |
|---|---|
| what a product term means | [`CONTEXT.md`](../CONTEXT.md) — the glossary; use its nouns exactly |
| why something is built the way it is | the [ADRs](#decisions-adrs) below |
| where code goes, and how to add a feature | [`DEVELOPING.md`](../DEVELOPING.md) |
| what is being worked on | the [in-flight plans](#in-flight-plans) below |
| why a past change happened, in detail | [`archive/`](./archive/) |

Three documents are authoritative: the glossary, the working rules, and the
ADRs. Everything else is scaffolding for open work, or history.

## Canonical

| Document | What it holds |
|---|---|
| [`CONTEXT.md`](../CONTEXT.md) | The project glossary: the product nouns, used exactly. |
| [`DEVELOPING.md`](../DEVELOPING.md) | Module map, ground rules, testing layers, how to add a feature. |

### Decisions (ADRs)

A decision gets one small file — context → decision → consequences. Later
decisions amend or supersede earlier ones rather than restating them, so read
them in order.

| ADR | Decision |
|---|---|
| [0001](./adr/0001-study-store-deep-module.md) | one deep Study-Store module |
| [0002](./adr/0002-ai-generation-port.md) | AI generation behind one port (HTTP + offline adapters) |
| [0003](./adr/0003-shared-ai-provider-catalog.md) | one shared AI Provider catalog |
| [0004](./adr/0004-native-css-view-transitions.md) | native CSS View Transitions instead of react@canary |
| [0005](./adr/0005-motion-budget-and-spatial-consistency.md) | the motion budget: frequency, not taste |
| [0006](./adr/0006-sidebar-removal.md) | header-only chrome; no sidebar |
| [0007](./adr/0007-source-material-resolver.md) | one pure Source-Material resolver shared by Quiz and Exam generation |
| [0008](./adr/0008-cognitive-level-aware-exam-generation.md) | Cognitive-Level-aware Exam blueprints |
| [0009](./adr/0009-landing-page-route-split.md) | landing page at `/`, study shell at `/app`, no router |
| [0010](./adr/0010-editorial-design-system.md) | Modern Academic Editorial design system (surface ramp, type, accent) |
| [0011](./adr/0011-landing-display-variant.md) | the landing page as a documented display variant (token spine, guarded) |

## In-flight plans

A plan or audit is scaffolding. It may restate the code and argue freely while
the work is open; once it ships, the durable part must be an ADR (or an
amendment to one) and the document moves to [`archive/`](./archive/).

| Document | Status | Leaves this table when |
|---|---|---|
| [`ui-plan-truthful-interaction.md`](./ui-plan-truthful-interaction.md) | Phases 1–3 implemented; device verification owed | the device pass is done and any durable decisions have an ADR |
| [`ui-plan-editorial-shell-export.md`](./ui-plan-editorial-shell-export.md) | WS-1/2/3/4/6 shipped; WS-5 (Paged.js) and WS-7 (pdfcn) are gated go/no-go spikes | the spikes resolve |

## Archived

[`archive/`](./archive/) holds point-in-time documents that produced a shipped
change. They are useful for background and rationale, and wrong wherever they
describe code that has since moved on. Each carries a dated banner at the top.

| Document | Outcome |
|---|---|
| [`ui-audit-ascii-hero-and-design-tooling.md`](./archive/ui-audit-ascii-hero-and-design-tooling.md) | Produced [ADR-0011](./adr/0011-landing-display-variant.md). Work complete; only the real-device touch test is owed. |
| [`ui-audit-taste-skill.md`](./archive/ui-audit-taste-skill.md) | Findings all fixed. Its remaining backlog is listed in the banner at the top. |
| [`ui-plan-landing-page.md`](./archive/ui-plan-landing-page.md) | Superseded by [ADR-0009](./adr/0009-landing-page-route-split.md) and [ADR-0011](./adr/0011-landing-display-variant.md). |
| [`ui-plan-spatial-consistency.md`](./archive/ui-plan-spatial-consistency.md) | Produced [ADR-0005](./adr/0005-motion-budget-and-spatial-consistency.md); its Zen Mode was later retired by [ADR-0006](./adr/0006-sidebar-removal.md). |

Other artifacts: [`figure-gallery.html`](./figure-gallery.html) is a reference
gallery of the diagram grammar; [`wireframe-interactive-notes.html`](./wireframe-interactive-notes.html)
and [`screenshots/`](./screenshots/) predate the editorial redesign and are
historical.

## Adding, changing and retiring documents

1. **A decision is an ADR.** If a discussion reaches a durable "we do it this
   way", write the ADR — not a design doc that sits forever.
2. **A plan or audit is scaffolding, not a record.** Keep it in `docs/` only
   while its work is open. When it ships, add a dated banner, move it to
   `archive/`, and link the ADR that absorbed it.
3. **Facts live in one place.** Link to the ADR or the code instead of copying
   tables of rules into a second document that can drift.
4. **Naming.** `adr/000N-slug.md` for decisions, `ui-plan-<area>.md` for plans,
   `ui-audit-<subject>.md` for audits; archived documents keep their names under
   `archive/`.
5. **Keep the [repository README](../README.md) small.** It is the front door —
   what Temari is, how to run it — and links here for everything else. Add new
   material to this index, not there.

## Deployment guides

- [Render: one service, branch-first deployment](./RENDER.md) — recommended.
- [Netlify Functions](./NETLIFY.md) — optional alternative.

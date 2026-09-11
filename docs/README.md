# Temari documentation

Where a document lives says what it is worth.

## Canonical — current and authoritative

| Document | What it holds |
|---|---|
| [`CONTEXT.md`](../CONTEXT.md) | The project glossary. The product nouns, used exactly. |
| [`DEVELOPING.md`](../DEVELOPING.md) | Module map, ground rules, testing layers, how to add a feature. |
| [`docs/adr/`](./adr/) | The architectural decisions, and why they were made. |

**ADRs are the only long-lived decision record.** Each one is a small file
(context → decision → consequences). Later decisions amend or supersede earlier
ones; they are never restated in a second document that can drift.

## In flight — plans, alive only while their work is open

| Document | Status | Leaves this table when |
|---|---|---|
| [`ui-plan-truthful-interaction.md`](./ui-plan-truthful-interaction.md) | Phases 1–3 implemented; device verification owed | the device pass is done and any durable decisions have an ADR |
| [`ui-plan-editorial-shell-export.md`](./ui-plan-editorial-shell-export.md) | WS-1/2/3/4/6 shipped; WS-5 (Paged.js) and WS-7 (pdfcn) are gated go/no-go spikes | the spikes resolve |

A plan or audit is scaffolding. It may restate the code and argue freely while
the work is open; once it ships, the durable part must be an ADR (or an
amendment to one), and the document moves below.

## Archived — historical, not current specs

[`archive/`](./archive/) holds point-in-time documents that produced a shipped
change. They are useful for background and rationale, and wrong wherever they
describe code that has since moved on.

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

## Rules for adding a document here

1. **A decision is an ADR.** If a discussion reaches a durable "we do it this
   way", write the ADR — not a design doc that sits forever.
2. **A plan or audit is scaffolding, not a record.** Keep it in `docs/` only
   while its work is open. When it ships, add a dated banner, move it to
   `archive/`, and link the ADR that absorbed it.
3. **Facts live in one place.** Link to the ADR or the code instead of copying
   tables of rules into a second document that can drift.

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
| [0012](./adr/0012-netlify-byok-functions.md) | Netlify deployment with BYOK Functions (Superseded by ADR-0014) |
| [0013](./adr/0013-render-single-service.md) | one Render service, branch validated before merging (Superseded by ADR-0014) |
| [0014](./adr/0014-expo-web-and-android.md) | one Expo app for web and Android; the standalone web app retires |

## In-flight plans

A plan or audit is scaffolding. It may restate the code and argue freely while
the work is open; once it ships, the durable part must be an ADR (or an
amendment to one) and the document moves to [`archive/`](./archive/).

| Document | Status | Leaves this table when |
|---|---|---|
| — (none in flight) | — | — |

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
| [`ui-plan-truthful-interaction.md`](./archive/ui-plan-truthful-interaction.md) | Web-era interaction plan; the web app retired under [ADR-0014](./adr/0014-expo-web-and-android.md). |
| [`ui-plan-editorial-shell-export.md`](./archive/ui-plan-editorial-shell-export.md) | Web-era editorial/export plan; the web app retired under [ADR-0014](./adr/0014-expo-web-and-android.md), WS-5/WS-7 undecided. |
| [`NETLIFY.md`](./archive/NETLIFY.md) | Deployment path deleted with the web tree; Netlify never had a working deploy. |
| [`RENDER.md`](./archive/RENDER.md) | Deployment path deleted with the web tree; the Render service was suspended. |
| [`WEB-RETIREMENT-PLAN.md`](./archive/WEB-RETIREMENT-PLAN.md) | Shipped via PRs 0, A, B, C (2026-09-30); durable part absorbed by [ADR-0014](./adr/0014-expo-web-and-android.md). |

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

## Mobile prototype planning

- [Android feasibility prototype](./ANDROID-PROTOTYPE-PLAN.md) — M0 device startup/navigation passed; M1 export implemented; [M2 checkpoint B](./mobile/M2-READER-SPIKE.md) complete (2026-09-30): asset checkpoint passed its installed offline device test (2026-09-24), the reader-spike checklist passed on-device with one bug found, fixed in PR #31 and re-verified. Section 0 is historical.

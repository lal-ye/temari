# ADR-0006: Remove the sidebar in favour of header navigation and a command palette

- Status: Accepted
- Date: 2026-09-05
- Supersedes the Zen Mode decision in [ADR-0005](./0005-motion-budget-and-spatial-consistency.md)

## Context

A Cmd/Ctrl+K command palette was added during the taste-skill audit
(`docs/ui-audit-taste-skill.md`) as a keyboard fast path alongside the sidebar.
With that in place the sidebar was asked to justify roughly 19rem of permanent
horizontal space — about a fifth of a 1280px viewport — on every screen.

The sidebar held four things:

1. Hub navigation (5 items).
2. The active-subject switcher.
3. Two "smart utility" buttons (Pomodoro, provider settings).
4. The study streak widget.

Only the first is genuinely replaced by a palette. The rest is persistent
context and ambient state, which a palette cannot carry because it is closed
almost all of the time.

## Decision

Remove the sidebar. Relocate everything it held rather than dropping it.

| Was in the sidebar | Now |
| --- | --- |
| Hub navigation | `HubTabs` in the header on `lg`+, `HubBottomBar` on mobile |
| Active subject `<select>` | `SubjectSwitcher` popover in the header |
| Add subject | Inside the `SubjectSwitcher` popover |
| Pomodoro, provider settings | Command palette, plus the existing header key button |
| Study streak card | `StreakPill` in the header |

**Zen Mode is retired.** It existed to collapse the sidebar; with no sidebar
there is nothing to collapse, and the content area is now permanently at the
width Zen Mode used to reveal. `UserSettings.zenMode` is kept and marked
`@deprecated` so settings persisted by earlier versions still parse.

## Consequences

### What this is good for

- The content area gains the full viewport width on every screen, permanently.
- Mobile navigation improves rather than degrades: the hamburger drawer cost
  two taps and hid the current location; the bottom bar costs one and always
  shows it.
- The layout shell simplifies from an animated CSS grid to a flex column.

### What it costs, honestly

- **The header is now dense.** It carries brand, subject, five tabs, streak,
  search, model picker and settings. Progressive disclosure keeps it viable
  (tab labels collapse to icons below `xl`, the search label collapses below
  `xl`, the model picker hides below `md`, the streak hides below `sm`), but it
  is a busier header than before and worth watching if anything else is added.
- **Subject switching is one click deeper.** It was a visible `<select>`; it is
  now a popover. Accepted because the header cannot show a full-width control,
  and the popover displays more per subject than the native option list did.
- **The streak lost its progress bar and message line.** The message survives in
  the tooltip and the accessible name rather than being deleted, but it is no
  longer glanceable. If streaks matter more later, Analytics is the right home
  for the full widget.
- **The palette is keyboard-only.** Touch users have no Cmd+K, which is exactly
  why the bottom bar is not optional and why the two "smart utilities" also
  remain reachable from the header.

### Preserved

The sliding active indicator from ADR-0005 survives, rotated from y to x. It is
still one continuous element that travels between tabs, still lifted into its
own `view-transition-name` group so the platform morphs it, still suppressed on
the keyboard path, and still disabled under `prefers-reduced-motion`.

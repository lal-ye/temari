# ADR-0007: Consolidate generation source resolution into a pure Source-Material module

- Status: Accepted
- Date: 2026-09-06

## Context

`QuizzesManager` and `ExamsManager` each carry an identical ~15-line block that
resolves the raw Material text to hand to generation:

- a `sourceOption` toggle (`'subjectNotes' | 'customText'`),
- an optional `selectedNoteId` (single note vs. aggregate-all-notes),
- a `customMaterial` textarea fallback,
- empty result → inline error message.

The duplication drifted already (slightly different error wording). NotesManager
was considered as a third site but takes pasted/PDF text directly and shares
nothing. An earlier, broader design (a `MaterialSelection` value object with
offline flags, ordering rules, and corruption errors) was reviewed and
discarded: it duplicated nothing that actually exists and was speculative.

## Decision

Extract the duplicated block into a small pure module,
`src/services/sourceMaterial.ts`:

- `resolveSourceMaterial(request, subjectNotes)` is a **pure function**.
  `subjectNotes` is pre-filtered by `useNotes()` (subject scoping stays in the
  Study-Store, ADR-0001).
- Result is a discriminated union: `{ ok: true, text, noteIds }` or
  `{ ok: false, error }` — no exceptions, no side effects.
- One canonical empty-selection error message (the per-manager wording split
  disappears).
- v1 ships the resolver with tests only; the two managers migrate in a
  follow-up so the interface is proven before callers depend on it.
- No caching. Re-resolution cost is trivial; a cache was deferred explicitly.

## Consequences

- One place defines how "which text do we generate from" works; the deletion
  test passes — remove the module and the logic reappears in both managers.
- Pure interface = trivial tests (no storage, no React).
- Aggregate note order is the caller-provided order (store insertion order),
  documented, not re-sorted.

## Notes for future reviews

Do not re-suggest the broader offline-flag/ordering/corruption
`MaterialSelection` shape without a real third caller needing it. Do not add a
cache before profiling shows re-resolution cost.

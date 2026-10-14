# Temari (ተማሪ)

Temari is an AI study companion. A learner organises study content under
Subjects, generates Notes, Quizzes and Exams from raw Material, practises them,
and reviews graded Attempts in Analytics and the Planner.

The current Expo prototype supports an offline Library, imported Notes (Markdown,
math, Amharic and editorial diagrams), native/web Quizzes and Drill history,
credential-free import/export, Gemini BYOK Explain, and a small-PDF transcription
flow. Android stores study data in SQLite and keys in SecureStore; web uses
IndexedDB and memory-only keys. No accounts, sync or backend server.

Full Exam-taking, Planner, analytics dashboards and editing remain outside the
Android prototype scope. Imported Attempts and Study Tasks are preserved in
backups even where there is no editing screen. See the
[completion record](./docs/mobile/PORT-COMPLETION.md) for implemented features,
automated evidence and the still-required physical-device acceptance checklist.

## Setup

Requires Node.js 22.22.3 and Bun 1.3.9 (see `.nvmrc` and `.bun-version`).

```bash
bun install --frozen-lockfile
```

The product is one Expo app (`apps/mobile`) over two packages
(`packages/core`, `packages/reader-core`). Run it with `expo start` from
`apps/mobile`; installable APKs come from the `Android APK` workflow
(see `docs/mobile/EAS-BUILD.md`). The standalone web app retired under
[ADR-0014](./docs/adr/0014-expo-web-and-android.md).

### Commands

```bash
bun run test              # core + reader tests
bun run test:adapters     # browser persistence/import/credential adapters
bun run typecheck:all     # typechecks plus the core/reader boundary seals
bun run check:mobile      # Android export + reader assets
bun run check:web         # production Expo web export + offline shell
bun run test:web          # browser end-to-end tests (install Playwright Chromium first)
bun run web               # Expo web development
bun run preview:web       # preview the production export
```

## Documentation

Everything else — the glossary, architecture decisions, working rules,
in-flight plans and archived history — lives in
[docs/README.md](./docs/README.md).

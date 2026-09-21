# Portable Android export v1

The Android prototype uses a separate `temari-portable` envelope. It is not the
existing generic browser backup. The v1 contract is implemented in
`packages/core/src/portable.ts` and is deliberately credential-free.

```json
{
  "format": "temari-portable",
  "schemaVersion": 1,
  "exportedAt": "2026-09-21T10:00:00.000Z",
  "data": {
    "subjects": [],
    "notes": [],
    "quizzes": [],
    "attempts": [],
    "tasks": []
  },
  "preferences": { "theme": "neobrutalist" }
}
```

Only `preferences.theme` is exported. Provider keys, legacy `apiKey`, provider
models, custom URLs, tokens and transient UI state are excluded by construction.
The exporter does not scan or rewrite learner-authored note text.

The current M1 web action is export-only. Native file picking, preview UI,
replace-library confirmation, SQLite transactions and mobile re-export belong to
the later native persistence milestone. The pure parser and legacy migration are
already testable before any native write path exists.

The parser rejects unsupported schema versions, corrupt JSON, unknown fields,
invalid dates/enums/scores, duplicate IDs, dangling Subject references, and
bounded-size violations. It accepts the current version-1 browser backup only
through `migrateLegacyBackup`, which discards credential-bearing settings and
returns a warning for the caller to show.

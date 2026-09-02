# Bolt's Journal - Critical Learnings

## 2025-05-20 - NoteViewer Markdown Re-parsing
**Learning:** `formatMarkdown` in `NoteViewer` parses text line-by-line and executes multiple regexes. Triggering selection/highlighting state changes (`onMouseUp`) causes re-renders that re-parse the full document text unless `useMemo` is used.
**Action:** Always memoize expensive document/text transformation functions when component local state updates frequently.

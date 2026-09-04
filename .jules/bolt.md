# Bolt's Journal

## 2025-05-20 - Defensive Copying for In-Memory Storage Caches
**Learning:** When caching parsed `localStorage` objects in memory within a client-side storage service, returning raw references allows caller functions to mutate state directly in memory without persisting to `localStorage`.
**Action:** Always return defensive copies (`[...array]` or `{ ...object }`) when serving cached items to prevent caller mutation from desynchronizing in-memory cache and `localStorage`.

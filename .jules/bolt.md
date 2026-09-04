## 2025-09-04 - React useMemo Invalidation from Unmemoized Storage Calls

**Learning:** Calling synchronous LocalStorage getters directly in component render bodies (e.g., `StorageService.getAttempts()`) creates brand-new array/object references on every single render pass. Passing these newly allocated references into `useMemo` dependency arrays completely invalidates `useMemo` caching, causing heavy pure functions to re-calculate on every render alongside redundant synchronous JSON parsing I/O.

**Action:** Always consume storage data via reactive state hooks (`useStudyData()`) or memoize LocalStorage reads to preserve reference equality across renders.

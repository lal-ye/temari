/**
 * Single-active-request guard (checkpoint B Phase 4.1, per the Phase-4
 * review): check-and-set BEFORE starting work, clear only by the owning id,
 * clear-all on invalidation — so the guard can never stick after an error
 * path or a missed clear, which would wedge the session forever.
 *
 * Pure: no DOM, storage, network or timer APIs. Shared by the Explain
 * session handler and the native link-confirm handler so both paths run the
 * identical single-flight semantics (the duplicate-tap bug class).
 */
export interface SingleFlightGuard {
  /** True while any request is in flight. */
  isActive(): boolean;
  /** Atomically claim the slot for `id`; false when something is active. */
  checkAndSet(id: string): boolean;
  /** Release the slot, but only if `id` still owns it (no clobbering a newer
   * request that took over after an invalidation). */
  clear(id: string): void;
  /** Release unconditionally (invalidation: Close, blur, note change). */
  clearAll(): void;
}

export function createSingleFlightGuard(): SingleFlightGuard {
  let active: string | null = null;
  return {
    isActive: () => active !== null,
    checkAndSet(id) {
      if (active !== null) return false;
      active = id;
      return true;
    },
    clear(id) {
      if (active === id) active = null;
    },
    clearAll() {
      active = null;
    },
  };
}

import type { StudyBackend, StudySnapshot } from './studyRepository';

/**
 * The test backend (ADR-0001's in-memory StorageAdapter role — the second of
 * exactly two adapters; the other is SQLite in apps/mobile). Stores the
 * snapshot as serialized JSON so every load crosses a real deserialize
 * boundary, mirroring the production backend: non-JSON-safe state fails here
 * instead of at the device.
 */
export function createInMemoryBackend(): StudyBackend {
  let stored: string | null = null;
  return {
    load: () => Promise.resolve(stored === null ? null : (JSON.parse(stored) as StudySnapshot)),
    persist: (snapshot) => {
      stored = JSON.stringify(snapshot);
      return Promise.resolve();
    },
  };
}

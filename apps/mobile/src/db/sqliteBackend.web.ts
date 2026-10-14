/** IndexedDB replaces SQLite on web, without WASM/COOP/COEP hosting requirements.
 * A single readwrite transaction commits the snapshot. Revision checks reject a
 * stale browser tab instead of silently overwriting another tab's work. */
import type { StudyBackend, StudySnapshot } from '@temari/core';

type Row = { schemaVersion: 1; revision: number; snapshot: StudySnapshot };
export function createSqliteBackend(dbName = 'temari-library', factory?: IDBFactory): StudyBackend {
  let connection: Promise<IDBDatabase> | null = null;
  let revision = 0;
  function open(): Promise<IDBDatabase> {
    if (!connection) connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = (factory ?? indexedDB).open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore('library');
      request.onerror = () => reject(new Error('Browser storage could not be opened. Check private browsing/storage permissions.'));
      request.onblocked = () => reject(new Error('Close other Temari tabs and reload to upgrade browser storage.'));
      request.onsuccess = () => {
        request.result.onversionchange = () => { request.result.close(); connection = null; };
        resolve(request.result);
      };
    }).catch((error) => { connection = null; throw error; });
    return connection;
  }
  return {
    async load() {
      const db = await open();
      return new Promise<StudySnapshot | null>((resolve, reject) => {
        const tx = db.transaction('library', 'readonly');
        const request = tx.objectStore('library').get('current');
        tx.onabort = () => reject(new Error('Could not read browser library. Reload to retry.'));
        tx.oncomplete = () => {
          const row = request.result as Row | undefined;
          if (!row) { revision = 0; resolve(null); return; }
          if (row.schemaVersion !== 1 || !Number.isSafeInteger(row.revision) || !row.snapshot) {
            reject(new Error('Unsupported or corrupt browser library. Nothing was changed.')); return;
          }
          revision = row.revision;
          resolve(row.snapshot);
        };
      });
    },
    async persist(snapshot) {
      const db = await open();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('library', 'readwrite');
        const store = tx.objectStore('library');
        const request = store.get('current');
        let stale = false;
        request.onsuccess = () => {
          if ((request.result?.revision ?? 0) !== revision) { stale = true; tx.abort(); return; }
          store.put({ schemaVersion: 1, revision: revision + 1, snapshot } satisfies Row, 'current');
        };
        tx.oncomplete = () => { revision += 1; resolve(); };
        tx.onabort = () => reject(new Error(stale
          ? 'The library changed in another tab. Reload before making changes.'
          : 'Browser storage write failed. Nothing changed; free some storage and retry.'));
      });
    },
  };
}

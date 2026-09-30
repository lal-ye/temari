// Compat shim: the AI catalog lives in @temari/core (moved 2026-09-30, web
// retirement PR A). The server and web tree keep importing
// '../shared/aiCatalog' until PR B deletes them; new code imports
// '@temari/core/aiCatalog'.
export * from '@temari/core/aiCatalog';

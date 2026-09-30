// Compat shim: domain types live in @temari/core (moved 2026-09-30, web
// retirement PR A). The web tree keeps importing '../types' until PR B
// deletes it; new code imports '@temari/core/types'.
export * from '@temari/core/types';

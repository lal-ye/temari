import { getStudyStore } from '../studyStore';
import { createAiGenerator, type AiGenerator } from '@temari/core';

// Compat shim: the AI port lives in @temari/core (moved 2026-09-30, web
// retirement PR A). Only the store-wired singleton stays behind — the
// package is deliberately store-free — until PR B deletes the web tree.
export * from '@temari/core';
export const ai: AiGenerator = createAiGenerator({
  getSettings: () => getStudyStore().settings,
});

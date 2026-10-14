import { defineConfig } from 'vitest/config';
// Only platform-neutral or web adapter tests; no accidental React Native imports.
export default defineConfig({ test: { include: ['apps/mobile/src/**/*.test.ts'], environment: 'node' } });

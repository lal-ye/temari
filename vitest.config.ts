import { defineConfig } from 'vitest/config';

/**
 * The web/server suite owns the repository's default test command. Pure core
 * tests are included deliberately; native tests stay in the Expo workspace so
 * they cannot accidentally require a browser environment or Render's Node
 * build.
 */
export default defineConfig({
  test: {
    include: [
      'src/**/*.test.{ts,tsx}',
      'server/**/*.test.{ts,tsx}',
      'packages/core/**/*.test.{ts,tsx}',
    ],
    exclude: ['apps/mobile/**', 'node_modules/**'],
  },
});

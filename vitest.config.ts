import { defineConfig } from 'vitest/config';

/**
 * The web app is retired (PR B): the suite is the two packages. Native tests
 * stay in the Expo workspace so they cannot accidentally require a browser
 * environment.
 */
export default defineConfig({
  test: {
    include: [
      'packages/core/**/*.test.{ts,tsx}',
      'packages/reader-core/**/*.test.{ts,tsx}',
    ],
    exclude: ['apps/mobile/**', 'node_modules/**'],
  },
});

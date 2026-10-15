import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  // These are full end-to-end flows (import, offline restart, Drill, export) over a
  // production Expo export, not unit tests. They were timed out at 30s on a loaded
  // machine even though every flow completes, so the budget is set above measured
  // runtime rather than tuned down to hide a real hang.
  testDir: './tests/web', timeout: 180_000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {},
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile-chromium', use: { ...devices['Pixel 7'] } },
  ],
  webServer: { command: 'node scripts/serve-web.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});

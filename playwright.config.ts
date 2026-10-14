import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/web', timeout: 30_000, fullyParallel: false, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure',
    launchOptions: process.env.CHROMIUM_EXECUTABLE ? { executablePath: process.env.CHROMIUM_EXECUTABLE, args: ['--no-sandbox', '--disable-dev-shm-usage'] } : {},
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: { command: 'node scripts/serve-web.mjs', url: 'http://127.0.0.1:4173', reuseExistingServer: !process.env.CI },
});

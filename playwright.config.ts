import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT || 3100);
const baseURL = process.env.BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './tests/e2e',
  globalSetup: './tests/e2e/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['list']] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Chromium-based mobile emulation (touch + mobile viewport) so local runs
    // need no WebKit system deps. Real iOS/Safari coverage runs in CI (P11).
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  // When BASE_URL is provided (e.g. pointing at a running docker compose), don't
  // spin up our own server; otherwise build + start the app for the test run.
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: `pnpm build && pnpm start -p ${PORT}`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 240_000,
        env: {
          DATABASE_URL:
            process.env.DATABASE_URL ||
            'postgresql://onemorerep:devpassword@localhost:5432/onemorerep?schema=public',
        },
      },
});

// End-to-end test of the web build against the LOCAL Supabase stack.
//
// Run it with `npm run test:e2e`, which puts the local stack's connection
// details into the environment (scripts/local.sh). The build reads them, and
// the build refuses any stack that isn't local (src/lib/config.ts).
import { defineConfig, devices } from '@playwright/test';

const SITE = 'http://127.0.0.1:4330';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One shared database.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: [['list']],
  use: {
    baseURL: SITE,
    locale: 'de-CH',
    timezoneId: 'Europe/Zurich',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1',
    url: SITE,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

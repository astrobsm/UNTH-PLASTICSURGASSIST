import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/**
 * Fail fast, and here rather than in globalSetup: Playwright starts `webServer`
 * BEFORE globalSetup runs, so a missing build otherwise surfaces as a 60-second
 * "timed out waiting for webServer" with the real cause buried in its stderr.
 */
if (!process.env.E2E_BASE_URL) {
  const required = ['dist/index.html', 'dist/sw.js', 'dist/tesseract/eng.traineddata.gz'];
  const missing = required.filter((f) => !existsSync(path.join(ROOT, f)));
  if (missing.length) {
    throw new Error(
      `\nOffline e2e needs a production build. Missing: ${missing.join(', ')}\n` +
        `  Run:  npm run e2e:build      (build + test)\n` +
        `  Or:   npm run build && npm run e2e\n\n` +
        `The suite deliberately tests the BUILT app: the service worker is disabled\n` +
        `in dev, so offline behaviour cannot be exercised through 'npm run dev'.\n`
    );
  }
}

/**
 * Playwright config for the offline (PWA) end-to-end suite.
 *
 * These tests run against a PRODUCTION BUILD served by `vite preview`. That is
 * not incidental: the service worker is disabled in dev (see vite.config.ts),
 * so `npm run dev` can never exercise offline behaviour.
 *
 *   npm run build && npm run e2e     # or just: npm run e2e:build
 *
 * First run on a new machine also needs the browser binary:
 *   npx playwright install chromium
 */
export default defineConfig({
  testDir: './e2e',
  // Serial by design: every test installs a service worker and fills the Cache
  // API with multi-megabyte wasm. Parallel workers race over that and thrash
  // memory for no wall-clock gain.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  // Service-worker install + precache of ~15 MB is the floor for every test.
  timeout: 180_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:4173',
    trace: 'retain-on-failure',
    video: 'off',
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  // Only start a server if one isn't already up, so you can keep `npm run
  // preview` running in another terminal while iterating on a test.
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: 'npx vite preview --port 4173 --strictPort',
        url: 'http://localhost:4173',
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});

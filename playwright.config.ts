import { defineConfig, devices } from '@playwright/test';
import { loadLocalEnv } from './scripts/db/env';

// P2-WP2: Playwright's own processes do not load .env.local (Next does, for `next dev`), and the
// session helper must sign cookies with the same JURAH_SESSION_SECRET the server verifies with.
// Values already in the environment win. Nothing is printed.
loadLocalEnv();

// D-020 / BACKEND-PLAN §6: the backend is pinned EXPLICITLY — postgres when a database URL is
// configured, otherwise mock — so no e2e run walks a backend by accident. (reuseExistingServer
// reuses whatever already listens on :3100; stop a server started with the other backend first.)
const BACKEND = (process.env.JURAH_DATABASE_URL ?? '').trim() !== '' ? 'postgres' : 'mock';

// Verification 9, 11 and 12 run here: the 390 / 834 / 1440 × rtl / ltr matrix and the role walks.
// WPfinal (D-039): against the Postgres backend a page render costs 4–7 s from Kuwait to the ap-south-1
// pooler (~370 ms per seam call), where Phase 1's mock rendered in ~0.1 s. The default 5 s `expect`
// after a navigation then times out while the navigation is still in flight (E3's switch, F0's open
// button — the error snapshots show the loading state, not a refusal). These are CEILINGS, not
// assertions, and they move only for the postgres backend; the mock keeps Phase 1's defaults.
// Assertions that pass their own explicit `timeout` are untouched.
const LATENCY = BACKEND === 'postgres' ? { timeout: 180_000, expect: { timeout: 30_000 } } : {};

export default defineConfig({
  ...LATENCY,
  testDir: './tests/e2e',
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:3100', trace: 'retain-on-failure' },
  projects: [
    { name: 'phone-390', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 } } },
    { name: 'tablet-834', use: { ...devices['Desktop Chrome'], viewport: { width: 834, height: 1194 } } },
    { name: 'desktop-1440', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `JURAH_DATA_BACKEND=${BACKEND} npx next dev -p 3100`,
    url: 'http://localhost:3100/ar',
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      ...Object.fromEntries(Object.entries(process.env).filter((e): e is [string, string] => typeof e[1] === 'string')),
      JURAH_DATA_BACKEND: BACKEND,
      JURAH_SESSION_SECRET: (process.env.JURAH_SESSION_SECRET ?? '').trim(),
    },
  },
});

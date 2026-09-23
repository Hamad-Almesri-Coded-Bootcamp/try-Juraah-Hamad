/**
 * The integration project (P2-WP1): tests/integration/** against the REAL database over
 * JURAH_DATABASE_URL — never part of `npm run verify` (which stays mock-only). One file at a time
 * (the files share one database and each re-seeds it in beforeAll). Without the URL every file
 * prints one loud NOT-A-PASS line and FAILS (tests/integration/setup.ts) — a skipped integration
 * run is never green.
 */
import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { loadLocalEnv } from './scripts/db/env';

const here = import.meta.dirname;

// .env.local must be in process.env BEFORE any worker imports lib/config, which captures
// AGENT_TOKEN / JOB_TOKEN / BOT_TOKEN as module constants. setup.ts's own loadLocalEnv() runs after
// its imports (seed.ts → lib/config) have already evaluated, so on its own the agent routes saw an
// empty token and answered 401 to every correct bearer. The workers inherit this process's env.
loadLocalEnv();

export default defineConfig({
  resolve: { alias: { '@': path.resolve(here, '.') } },
  test: {
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    fileParallelism: false,
    // Latency-bound, not logic-bound: every seam call is one withSession transaction of ~6 round trips
    // to the Supabase pooler (ap-south-1), ~370 ms from Kuwait, and one masked-name lookup has a median
    // of ~755 ms. E-13 (400 timed lookups) takes ~310 s; E-21 and E-49 ~35 s each. At 30 s they timed
    // out, and because vitest does not cancel in-flight SQL the abandoned loops then held the pool and
    // the lookup rate limit, failing E-14 and E-49 as knock-ons (VERIFICATION.md, integration runs 1-4).
    // The sample counts are unchanged; only the ceiling moves.
    testTimeout: 600_000,
    hookTimeout: 120_000,
    globals: false,
  },
});

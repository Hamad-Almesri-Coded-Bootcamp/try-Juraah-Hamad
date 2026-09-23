/**
 * Integration harness (P2-WP1). Loads .env.local, then per test FILE: re-seeds the database in
 * beforeAll through scripts/db/seed.ts's own exported runSeed() (one transaction, truncate first),
 * and closes the pool afterwards.
 *
 * The owner's standing rule: a check that passes because its input does not exist is worse than
 * no check. So when JURAH_DATABASE_URL is absent every file prints ONE loud line and FAILS — every
 * test in it is reported failed, never skipped, never green.
 */
import { afterAll, beforeAll } from 'vitest';
import { loadLocalEnv } from '../../scripts/db/env';
import { runSeed } from '../../scripts/db/seed';
import { closeSql, databaseUrl, getSql } from '../../lib/db/client';

loadLocalEnv();

export const NOT_A_PASS = '!! integration skipped — JURAH_DATABASE_URL not set — NOT A PASS';

beforeAll(async () => {
  if (!databaseUrl()) {
    console.error(NOT_A_PASS);
    throw new Error(NOT_A_PASS);
  }
  await runSeed(getSql());
});

afterAll(async () => {
  await closeSql();
});

/**
 * Verification 13 — the mock data diffed against docs/Seed Dataset.md record by record.
 *
 * This check may never pass by absence (owner, Gate 0b). While `lib/data/mock/seed.ts` does not exist it
 * prints a loud SKIPPED line that is NOT a pass and exits 0 only so WP0's empty app can build; the moment
 * the seed exists it is a hard failure until WP1 implements the diff in `scripts/seed-diff.impl.ts`, and
 * WP1's report must show it going red, then green. Even when implemented, an empty or thin fixture cannot
 * pass: the record counts below are the seed's own and are enforced as floors.
 */
import { existsSync } from 'node:fs';

/** Counts stated in docs/Seed Dataset.md (Gate 0b). The diff must find exactly these, no more, no fewer. */
export const SEED_COUNTS = {
  accounts: 11, patients: 4, caregivers: 8, prescriptions: 9, alerts: 3, settings: 3,
  messagingLinks: 5, pushSubscriptions: 4, refillRequests: 2, calendarSubscriptions: 1,
  auditEventTypesPresent: 23, // the contract lists 25 types; the seed's inventory supports 23. `prescription_discontinued`
  // (no row stated) and `caregiver_self_unlinked` (no record at all) are absent by design — change requests, never fabricated rows
} as const;

async function main() {
  if (!existsSync('lib/data/mock/seed.ts')) {
    console.log('!! seed diff — SKIPPED, NOT A PASS: lib/data/mock/seed.ts does not exist yet (WP1 creates it; this line must disappear at Gate 1)');
    return;
  }
  if (!existsSync('scripts/seed-diff.impl.ts')) {
    console.error('✗ seed diff — the mock seed exists but the diff is not implemented (scripts/seed-diff.impl.ts)');
    process.exit(1);
  }
  const impl = './seed-diff.impl.ts';
  const { runSeedDiff } = (await import(impl)) as { runSeedDiff: (counts: typeof SEED_COUNTS) => Promise<{ ok: boolean; table: string }> };
  const { ok, table } = await runSeedDiff(SEED_COUNTS);
  console.log(table);
  if (!ok) { console.error('✗ seed diff — the selected backend does not match docs/Seed Dataset.md (or, for --backend=postgres, JURAH_DATABASE_URL is not set — NOT A PASS)'); process.exit(1); }
  console.log('✓ seed diff — every record present at the stated values, no extra record');
}
main();

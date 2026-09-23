/**
 * The seed (docs/SCHEMA.md §4, Gate 1 #2): counts equal SEED_COUNTS and the mock's own store; every
 * table's digest equals the one computed from lib/data/mock/seed.ts's build*() functions (row by
 * row, column by column, seq included); two runs give an identical dump; the seed's
 * dose_status_recorded rows are all agent/system; exactly 23 distinct audit types.
 */
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { getStore, reset } from '@/lib/data/mock/store';
import { readFileSync } from 'node:fs';
import { runSeed } from '../../../scripts/db/seed';
import { compareDigests, digests, dumpAll } from '../../../scripts/db/dump';

/** SEED_COUNTS from scripts/seed-diff.ts, read from its source text: importing that module runs its
 * mock diff (a top-level main()), so the literal is parsed instead — same numbers, one source. */
const SEED_COUNTS: Record<string, number> = (() => {
  const src = readFileSync('scripts/seed-diff.ts', 'utf8');
  const block = /export const SEED_COUNTS = \{([\s\S]*?)\} as const;/.exec(src)?.[1] ?? '';
  const out: Record<string, number> = {};
  for (const m of block.matchAll(/(\w+):\s*(\d+)/g)) out[m[1] ?? ''] = Number(m[2]);
  if (Object.keys(out).length !== 11) throw new Error(`could not read SEED_COUNTS (got ${Object.keys(out).length} keys)`);
  return out;
})();

const TABLE_FOR: Record<string, string> = {
  accounts: 'accounts', patients: 'patients', caregivers: 'caregivers', prescriptions: 'prescriptions',
  alerts: 'interaction_alerts', settings: 'settings', messagingLinks: 'messaging_links',
  pushSubscriptions: 'push_subscriptions', refillRequests: 'refill_requests', calendarSubscriptions: 'calendar_subscriptions',
};

describe('seed', () => {
  it('row counts equal SEED_COUNTS, and doses/audit_events equal the mock store', async () => {
    for (const [key, table] of Object.entries(TABLE_FOR)) {
      const [row] = await getSql().unsafe(`select count(*)::int as n from ${table}`);
      expect(row?.n, table).toBe(SEED_COUNTS[key]);
    }
    reset();
    const store = getStore();
    const [d] = await getSql()`select count(*)::int as n from doses`;
    const [a] = await getSql()`select count(*)::int as n, count(distinct type)::int as types from audit_events`;
    expect(d?.n).toBe(store.doses.length);
    expect(a?.n).toBe(store.auditEvents.length);
    expect(a?.types).toBe(SEED_COUNTS.auditEventTypesPresent);
  });

  it('every table equals the transcription, row by row (digest)', async () => {
    const { ok, lines } = compareDigests(await digests(getSql()));
    expect(lines.filter((l) => l.startsWith('✗'))).toEqual([]);
    expect(ok).toBe(true);
  });

  it("every seeded dose_status_recorded is by 'agent' or 'system' (G1)", async () => {
    const rows = await getSql()`select distinct actor_role::text as r from audit_events where type = 'dose_status_recorded'`;
    expect(rows.map((r) => r.r).sort()).toEqual(['agent']);
  });

  it('no seeded untracked dose carries a status, and none has source ui', async () => {
    const [row] = await getSql()`select count(*) filter (where not tracked and status <> 'upcoming')::int as bad,
      count(*) filter (where not tracked)::int as untracked from doses`;
    expect(row?.bad).toBe(0);
    expect(row?.untracked).toBeGreaterThan(0);
  });

  it('re-running the seed yields an identical dump', async () => {
    const first = JSON.stringify(await dumpAll(getSql()));
    await runSeed(getSql());
    const second = JSON.stringify(await dumpAll(getSql()));
    expect(second).toBe(first);
  });
});

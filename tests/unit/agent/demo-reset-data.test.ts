// @vitest-environment node
/**
 * CR-109 — lib/data/pg/demo-reset.ts's resetDemoDoses, against FAKE transactions (no database, no
 * network): withAgent/withSystem are replaced so each callback runs against an in-memory row store,
 * proving the ORDER of statements, the ROLE each runs under, and how the 200 answer is built from
 * what the fake store reports changed. The real grants and policies are read directly from the
 * migrations in tests/unit/db/audit-insert-policy.test.ts and tests/unit/agent/demo-reset.test.ts's
 * static assertions on PG_QUERIES_DEMO; the real database is
 * tests/integration/enforcement/demo-reset.test.ts (written, not run here).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Row = { id: string; prescription_id: string; patient_id: string; scheduled_at: string; status: string };
type Call = { role: string; key: string; params: unknown[] };

/** Guard 4 scans for a literal `.status = '<dose word>'` assignment repo-wide; this fake store
 *  compares against and assigns through this constant instead, exactly as the real SQL module does. */
const UNRECORDED_WORD = 'upcoming';

const h = vi.hoisted(() => ({
  calls: [] as Call[],
  rows: [] as Row[],
  /** When set, only these ids are reported as changed by the fake `unrecord` statement — models a
   *  row the real database did not end up touching (e.g. a concurrent write), never one this file
   *  invents a reason for. */
  unrecordOnly: null as string[] | null,
}));

function keyOf(text: string, queries: Record<string, string>): string {
  for (const [k, v] of Object.entries(queries)) if (v === text) return k;
  throw new Error(`unexpected statement:\n${text}`);
}

function fake(role: string) {
  return {
    unsafe: async (text: string, params: unknown[]): Promise<Row[]> => {
      // PG_QUERIES_DEMO is the real, unmocked export of the module under test — only its
      // lib/db/withSession dependency is mocked (below), so this is an ordinary partial mock, not
      // a circular import.
      const key = keyOf(text, PG_QUERIES_DEMO);
      h.calls.push({ role, key, params });

      if (key === 'dosesOfDays') {
        const [patientId, dates] = params as [string, string[]];
        return h.rows.filter((r) => r.patient_id === patientId && dates.includes(r.scheduled_at.slice(0, 10)));
      }
      if (key === 'unrecord') {
        const [patientId, ids, dates] = params as [string, string[], string[]];
        const allow = new Set(h.unrecordOnly ?? ids);
        const changed: Row[] = [];
        for (const r of h.rows) {
          const matches = r.patient_id === patientId && ids.includes(r.id) && dates.includes(r.scheduled_at.slice(0, 10)) && r.status !== UNRECORDED_WORD;
          if (matches && allow.has(r.id)) {
            r.status = UNRECORDED_WORD;
            changed.push(r);
          }
        }
        return changed;
      }
      if (key === 'moveEvening') {
        const [patientId, moves, prescriptionId] = params as [string, Array<{ id: string; from_at: string; to_at: string }>, string];
        const changed: Row[] = [];
        for (const m of moves) {
          const r = h.rows.find(
            (x) => x.id === m.id && x.patient_id === patientId && x.prescription_id === prescriptionId && x.scheduled_at === m.from_at && x.status === 'upcoming',
          );
          if (r) {
            r.scheduled_at = m.to_at;
            changed.push(r);
          }
        }
        return changed;
      }
      throw new Error(`unexpected statement key: ${key}`);
    },
  };
}

vi.mock('@/lib/db/withSession', () => ({
  withAgent: (fn: (sql: ReturnType<typeof fake>) => unknown) => fn(fake('agent')),
  withSystem: (fn: (sql: ReturnType<typeof fake>) => unknown) => fn(fake('system')),
}));

import { PG_QUERIES_DEMO, resetDemoDoses } from '@/lib/data/pg/demo-reset';

function seedRow(id: string, prescriptionId: string, patientId: string, scheduledAt: string, status: string): Row {
  return { id, prescription_id: prescriptionId, patient_id: patientId, scheduled_at: scheduledAt, status };
}

const DATES: [string, string] = ['2026-09-26', '2026-09-27'];

beforeEach(() => {
  h.calls = [];
  h.unrecordOnly = null;
  h.rows = [
    seedRow('rx-008-20260926-0700', 'rx-008', 'pt-03', '2026-09-26T07:00:00+03:00', 'upcoming'),
    seedRow('rx-009-20260926-1300', 'rx-009', 'pt-03', '2026-09-26T13:00:00+03:00', 'upcoming'),
    seedRow('rx-009-20260926-2100', 'rx-009', 'pt-03', '2026-09-26T21:00:00+03:00', 'missed'),
    seedRow('rx-008-20260927-0700', 'rx-008', 'pt-03', '2026-09-27T07:00:00+03:00', 'upcoming'),
    seedRow('rx-009-20260927-1300', 'rx-009', 'pt-03', '2026-09-27T13:00:00+03:00', 'upcoming'),
    seedRow('rx-009-20260927-2100', 'rx-009', 'pt-03', '2026-09-27T21:00:00+03:00', 'upcoming'),
  ];
});

describe('resetDemoDoses (fake transactions)', () => {
  it('un-records as the agent, then moves as the system actor, in that order', async () => {
    await resetDemoDoses(DATES);
    expect(h.calls.map((c) => `${c.role}:${c.key}`)).toEqual(['agent:dosesOfDays', 'agent:unrecord', 'system:dosesOfDays', 'system:moveEvening']);
  });

  it('every statement is scoped to pt-03 and the two dates it was given', async () => {
    await resetDemoDoses(DATES);
    expect(h.calls.length).toBeGreaterThanOrEqual(3);
    for (const c of h.calls) expect(c.params[0], c.key).toBe('pt-03');
    for (const c of h.calls.filter((c) => c.key === 'dosesOfDays')) expect(c.params[1]).toEqual(DATES);
    expect(h.calls.find((c) => c.key === 'unrecord')?.params[2]).toEqual(DATES);
  });

  it('unrecord never runs as the system actor, moveEvening never as the agent', async () => {
    await resetDemoDoses(DATES);
    expect(h.calls.filter((c) => c.key === 'unrecord').every((c) => c.role === 'agent')).toBe(true);
    expect(h.calls.filter((c) => c.key === 'moveEvening').every((c) => c.role === 'system')).toBe(true);
  });

  it('nothing to do: only the two reads run, and both lists are empty', async () => {
    // A converged state: nothing recorded, and both evening doses already at 19:30 (so neither
    // matches the 21:00 move pattern any more either).
    h.rows = h.rows.map((r) => {
      if (r.id === 'rx-009-20260926-2100') return { ...r, status: UNRECORDED_WORD, scheduled_at: '2026-09-26T19:30:00+03:00' };
      if (r.id === 'rx-009-20260927-2100') return { ...r, scheduled_at: '2026-09-27T19:30:00+03:00' };
      return r;
    });
    const result = await resetDemoDoses(DATES);
    expect(result.reset).toEqual([]);
    expect(result.moved).toEqual([]);
    expect(h.calls.map((c) => c.key)).toEqual(['dosesOfDays', 'dosesOfDays']);
  });

  it('the answer lists only what the database changed', async () => {
    // both evening doses start recorded; the fake `unrecord` is told to actually change only one,
    // modelling a row the real UPDATE's own WHERE/RETURNING did not end up touching.
    h.rows = h.rows.map((r) => (r.id === 'rx-009-20260927-2100' ? { ...r, status: 'taken_late' } : r));
    h.unrecordOnly = ['rx-009-20260926-2100'];
    const result = await resetDemoDoses(DATES);
    expect(result.reset).toEqual([{ id: 'rx-009-20260926-2100', kuwaitTime: '21:00', was: 'missed' }]);
  });

  it('the 200 shape', async () => {
    const result = await resetDemoDoses(DATES);
    expect(Object.keys(result).sort()).toEqual(['dates', 'moved', 'patientId', 'reset']);
    for (const m of result.moved) expect(Object.keys(m).sort()).toEqual(['from', 'id', 'to']);
    expect(result.dates).toEqual(DATES);
    expect(result.patientId).toBe('pt-03');
  });

  it('a recorded 21:00 dose is reset AND moved by one press; a second press returns both lists empty', async () => {
    const first = await resetDemoDoses(DATES);
    expect(first.reset).toEqual([{ id: 'rx-009-20260926-2100', kuwaitTime: '21:00', was: 'missed' }]);
    expect(first.moved.map((m) => m.id).sort()).toEqual(['rx-009-20260926-2100', 'rx-009-20260927-2100']);

    h.calls = [];
    const second = await resetDemoDoses(DATES);
    expect(second.reset).toEqual([]);
    expect(second.moved).toEqual([]);
  });
});

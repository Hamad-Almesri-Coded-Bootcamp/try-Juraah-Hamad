// @vitest-environment node
/**
 * CR-109 — the pure half (lib/agent/demo-reset.ts, lib/agent/validate.ts's parseDemoResetBody) plus
 * static assertions on the SQL text in lib/data/pg/demo-reset.ts (importing that module runs no
 * statement and opens no connection: lib/db/client.ts's getSql() is lazy). The route through its
 * real route.ts is tests/unit/agent/demo-reset-route.test.ts; the fake-transaction data module is
 * tests/unit/agent/demo-reset-data.test.ts; the real database is tests/integration/enforcement/demo-reset.test.ts
 * (written, not run here).
 */
import { describe, expect, it } from 'vitest';
import { DEMO_RESET, demoResetDates, planDemoReset, type DemoDose } from '@/lib/agent/demo-reset';
import { parseDemoResetBody } from '@/lib/agent/validate';
import { PG_QUERIES_DEMO } from '@/lib/data/pg/demo-reset';

const OPEN = 'upcoming';
const ON_TIME = 'taken_on_time';
const LATE = 'taken_late';
const MISSED = 'missed';

function row(id: string, rx: string, patient: string, date: string, hhmm: string, status: string): DemoDose {
  return { id, prescriptionId: rx, patientId: patient, scheduledAt: `${date}T${hhmm}:00+03:00`, status };
}

/**
 * pt-03's real shape: rx-008 Eltroxin 07:00, rx-009 Calcium/D3 13:00 and 21:00, every day 09-25..28.
 * Every dose starts OPEN (an "already reset" baseline) so a test controls exactly which dose is
 * recorded, or moved, by overriding it explicitly — nothing is recorded by construction here.
 */
function pt03Rows(): DemoDose[] {
  const days = ['2026-09-25', '2026-09-26', '2026-09-27', '2026-09-28'];
  const out: DemoDose[] = [];
  for (const d of days) {
    out.push(row(`rx-008-${d.replace(/-/g, '')}-0700`, 'rx-008', 'pt-03', d, '07:00', OPEN));
    out.push(row(`rx-009-${d.replace(/-/g, '')}-1300`, 'rx-009', 'pt-03', d, '13:00', OPEN));
    out.push(row(`rx-009-${d.replace(/-/g, '')}-2100`, 'rx-009', 'pt-03', d, '21:00', OPEN));
  }
  return out;
}

/**
 * pt-01's rows on the same two dates, including one contrived row that names prescription 'rx-009'
 * at 21:00 (the same prescription and time as pt-03's evening dose) but a different id and a
 * different patientId — must never be touched: the plan filters on patientId, not on prescriptionId
 * or time alone.
 */
function pt01Rows(): DemoDose[] {
  return [
    row('rx-001-20260926-0800', 'rx-001', 'pt-01', '2026-09-26', '08:00', MISSED),
    row('rx-201-20260926-2100', 'rx-009', 'pt-01', '2026-09-26', '21:00', OPEN),
    row('rx-001-20260927-0800', 'rx-001', 'pt-01', '2026-09-27', '08:00', ON_TIME),
  ];
}

/** Mirrors resetDemoDoses's two steps against an in-memory snapshot, without any database. */
function press(doses: DemoDose[], dates: readonly string[]): DemoDose[] {
  let state = doses;
  const p1 = planDemoReset(state, dates);
  const resetIds = new Set(p1.reset.map((r) => r.id));
  state = state.map((d) => (resetIds.has(d.id) ? { ...d, status: OPEN } : d));
  const p2 = planDemoReset(state, dates);
  const toAtById = new Map(p2.moved.map((m) => [m.id, m.toAt]));
  state = state.map((d) => (toAtById.has(d.id) ? { ...d, scheduledAt: toAtById.get(d.id)! } : d));
  return state;
}

describe('DEMO_RESET', () => {
  it('is pt-03, rx-009 21:00 -> 19:30, in one constant', () => {
    expect(DEMO_RESET).toEqual({ patientId: 'pt-03', evening: { prescriptionId: 'rx-009', from: '21:00', to: '19:30' } });
  });
});

describe('demoResetDates', () => {
  it('today and tomorrow, across a month and a year end', () => {
    expect(demoResetDates('2026-09-26')).toEqual(['2026-09-26', '2026-09-27']);
    expect(demoResetDates('2026-09-30')).toEqual(['2026-09-30', '2026-10-01']);
    expect(demoResetDates('2026-12-31')).toEqual(['2026-12-31', '2027-01-01']);
  });
});

describe('planDemoReset', () => {
  const DATES = ['2026-09-26', '2026-09-27'];

  it('only pt-03: another patient’s recorded dose and its rx-009-at-21:00 decoy are never planned', () => {
    const p = planDemoReset([...pt03Rows(), ...pt01Rows()], DATES);
    const ids = new Set([...p.reset.map((r) => r.id), ...p.moved.map((m) => m.id)]);
    for (const d of pt01Rows()) expect(ids.has(d.id)).toBe(false);
    // and the check is not vacuous: pt-03's own rows on these dates ARE planned
    expect(ids.has('rx-009-20260926-2100')).toBe(true);
  });

  it('only today and tomorrow: recorded doses and 21:00 doses of yesterday and the day after are untouched', () => {
    const p = planDemoReset(pt03Rows(), DATES);
    const outOfRange = ['2026-09-25', '2026-09-28'];
    for (const r of p.reset) expect(outOfRange.some((d) => r.id.includes(d.replace(/-/g, '')))).toBe(false);
    for (const m of p.moved) expect(outOfRange.some((d) => m.id.includes(d.replace(/-/g, '')))).toBe(false);
  });

  it('21:00 -> 19:30 only when upcoming: a recorded 21:00 dose is reset, not moved; 13:00 and 07:00 never move; a dose already at 19:30 is not moved', () => {
    const rows = pt03Rows().map((d) => (d.id === 'rx-009-20260926-2100' ? { ...d, status: MISSED } : d));
    const p = planDemoReset(rows, DATES);
    expect(p.reset.find((r) => r.id === 'rx-009-20260926-2100')).toEqual({ id: 'rx-009-20260926-2100', kuwaitTime: '21:00', was: MISSED });
    expect(p.moved.find((m) => m.id === 'rx-009-20260926-2100')).toBeUndefined();
    expect(p.moved.find((m) => m.id === 'rx-009-20260927-2100')).toEqual({
      id: 'rx-009-20260927-2100', from: '21:00', to: '19:30',
      fromAt: '2026-09-27T21:00:00+03:00', toAt: '2026-09-27T19:30:00+03:00',
    });
    expect(p.moved.some((m) => m.id.endsWith('-1300') || m.id.endsWith('-0700'))).toBe(false);
    const already = rows.map((d) => (d.id === 'rx-009-20260927-2100' ? { ...d, scheduledAt: '2026-09-27T19:30:00+03:00' } : d));
    const p2 = planDemoReset(already, DATES);
    expect(p2.moved.find((m) => m.id === 'rx-009-20260927-2100')).toBeUndefined();
  });

  it('reset never produces a recorded status', () => {
    const rows = pt03Rows().map((d) => (d.id === 'rx-009-20260926-2100' ? { ...d, status: MISSED } : d));
    const p = planDemoReset(rows, DATES);
    for (const r of p.reset) {
      expect(Object.keys(r).sort()).toEqual(['id', 'kuwaitTime', 'was']);
      expect([ON_TIME, LATE, MISSED]).toContain(r.was);
    }
    expect(p.reset.some((r) => r.was === OPEN)).toBe(false);

    expect(PG_QUERIES_DEMO.unrecord).toContain("set status = 'upcoming'::dose_status_t, recorded_at = null, source = 'seed'::dose_source_t");
    for (const [name, text] of Object.entries(PG_QUERIES_DEMO)) {
      expect(text, name).not.toMatch(/taken_on_time|taken_late|missed/);
      expect(text, name).not.toMatch(/\b(delete|insert)\b/i);
      expect(text, name).not.toMatch(/audit_events/);
      expect(text, name).not.toMatch(/update\s+prescriptions/i);
      expect(text, name).toContain('p.patient_id = $1');
    }
    expect(PG_QUERIES_DEMO.moveEvening).toContain("'upcoming' = d.status");
    expect(PG_QUERIES_DEMO.moveEvening).toContain('iso_kw(d.scheduled_at) = m.from_at');
  });

  it('idempotent: a second press plans nothing and changes nothing', () => {
    const initial = [...pt03Rows(), ...pt01Rows()].map((d) => (d.id === 'rx-009-20260927-2100' ? { ...d, status: MISSED } : d));
    const afterFirst = press(initial, DATES);
    const secondPlan = planDemoReset(afterFirst, DATES);
    expect(secondPlan).toEqual({ moved: [], reset: [] });
    const afterSecond = press(afterFirst, DATES);
    expect(afterSecond).toEqual(afterFirst);
    const dose = afterFirst.find((d) => d.id === 'rx-009-20260927-2100')!;
    expect(dose.status).toBe(OPEN);
    expect(dose.scheduledAt).toBe('2026-09-27T19:30:00+03:00');
  });

  it('other prescriptions, patients and dates are untouched', () => {
    const initial = [...pt03Rows(), ...pt01Rows()].map((d) => (d.id === 'rx-009-20260927-2100' ? { ...d, status: MISSED } : d));
    const after = press(initial, DATES);
    const affected = new Set(['rx-009-20260926-2100', 'rx-009-20260927-2100']);
    for (const before of initial) {
      if (affected.has(before.id)) continue;
      expect(after.find((d) => d.id === before.id)).toEqual(before);
    }
    // and the two affected rows really did change, so the check above is not vacuous
    expect(after.find((d) => d.id === 'rx-009-20260926-2100')?.scheduledAt).toBe('2026-09-26T19:30:00+03:00');
    expect(after.find((d) => d.id === 'rx-009-20260927-2100')).toEqual(
      expect.objectContaining({ status: OPEN, scheduledAt: '2026-09-27T19:30:00+03:00' }),
    );
  });

  it('fail closed: a scheduledAt that is not a +03:00 Kuwait instant is never planned', () => {
    const bad: DemoDose[] = [
      { id: 'x1', prescriptionId: 'rx-009', patientId: 'pt-03', scheduledAt: '2026-09-26T21:00:00Z', status: MISSED },
      { id: 'x2', prescriptionId: 'rx-009', patientId: 'pt-03', scheduledAt: '2026-09-26 21:00:00+03:00', status: MISSED },
      { id: 'x3', prescriptionId: 'rx-009', patientId: 'pt-03', scheduledAt: 'not-a-date', status: MISSED },
    ];
    const p = planDemoReset(bad, DATES);
    expect(p.reset).toEqual([]);
    expect(p.moved).toEqual([]);
  });
});

describe('parseDemoResetBody', () => {
  it('body: none or {} only', () => {
    expect(parseDemoResetBody(undefined)).toEqual({ ok: true, value: {} });
    expect(parseDemoResetBody({})).toEqual({ ok: true, value: {} });
    for (const key of ['patientId', 'dates', 'status', 'doseId']) {
      const r = parseDemoResetBody({ [key]: 'x' }) as { ok: false; field: string; reason: string };
      expect(r.ok).toBe(false);
      expect(r.field).toBe(key);
      expect(r.reason).toBe('unknown_field');
    }
    for (const notObj of [[], null, 'x', 3, true]) {
      const r = parseDemoResetBody(notObj) as { ok: false; field: string; reason: string };
      expect(r.ok, JSON.stringify(notObj)).toBe(false);
      expect(r.reason, JSON.stringify(notObj)).toBe('not_an_object');
    }
  });
});

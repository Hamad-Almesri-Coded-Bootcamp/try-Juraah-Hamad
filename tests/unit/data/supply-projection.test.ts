/**
 * P2-WP3c — the Postgres projection for refills and the calendar read, proved WITHOUT a database
 * (this file runs in `npm run verify`, mock backend). The row literals below are the rows the exact
 * `PG_QUERIES_SUPPLY` text returned through the Supabase MCP connector, run as `jurah_app` under
 * each seeded session (docs/backend-notes/p2-wp3c.md §2 has the SQL and the raw output), in the
 * types the `postgres` driver hands back after the query's casts (float8 → number, to_char → text,
 * int → number, NULL → null). They go through the SAME functions lib/data/pg/reads-supply.ts uses,
 * and the result is compared with tests/fixtures/shapes.json and with the mock AS A STRING — key
 * order included (BACKEND-PLAN §6), never deep-equal.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { depletionFor } from '@/lib/engine/depletion';
import { toCalendarSubscriptionRead, toRefillLine, toRefillRequest } from '@/lib/data/shapes/reads-supply';
import { calendarSubscriptionRefusal, refillOverviewRefusal, refillRequestsRefusal } from '@/lib/data/refusals/reads-supply';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import { getCalendarSubscription, getRefillOverview, getRefillRequests } from '@/lib/data/mock-impl';
import type { Session } from '@/types/views';

type Row = Record<string, unknown>;
const fixture = shapes as unknown as Record<string, unknown>;

/** The overview row the SQL returns, filled in with the columns that are the same for every line. */
function rxRow(over: Row): Row {
  return {
    facility_name: 'x', dispensing_units_per_package: null, dispensing_total_quantity_dispensed: null,
    dispensing_dispense_date: null, dispensing_brand_actually_dispensed: null, duration_days: 30,
    dosing_pattern: 'daily', dose_per_administration: 1, needs_review: false, status: 'active', ...over,
  };
}

// pt-01 (حمد) — MCP output, `hamad|getRefillOverview|pt-01`.
const HAMAD_OVERVIEW: Row[] = [
  rxRow({ id: 'rx-001', patient_id: 'pt-01', sector: 'public', generic_name: 'Warfarin', brand_name: 'Marevan', frequency_per_day: 1, duration_days: 90, dispensing_units_per_package: 90, dispensing_total_quantity_dispensed: 90, dispensing_dispense_date: '2026-09-01', routed_to: 'public_pharmacy' }),
  rxRow({ id: 'rx-002', patient_id: 'pt-01', sector: 'private', generic_name: 'Ibuprofen', brand_name: 'Brufen', frequency_per_day: 3, duration_days: 7, dispensing_units_per_package: 21, dispensing_total_quantity_dispensed: 21, dispensing_dispense_date: '2026-09-19', routed_to: 'private_pharmacy' }),
  rxRow({ id: 'rx-003', patient_id: 'pt-01', sector: 'public', generic_name: 'Metformin', brand_name: 'Glucophage', frequency_per_day: 2, duration_days: 180, dispensing_units_per_package: 60, dispensing_total_quantity_dispensed: 60, dispensing_dispense_date: '2026-09-01', routed_to: 'public_pharmacy' }),
];
// pt-02 (فاطمة) — MCP output, `fatima|getRefillOverview|pt-02`: no brand, no dispensing, rx-006's
// frequency NULL, rx-006/rx-007 flagged (CR-040, OPEN — included, as the mock).
const FATIMA_OVERVIEW: Row[] = [
  rxRow({ id: 'rx-005', patient_id: 'pt-02', sector: 'public', generic_name: 'Prednisolone', brand_name: null, frequency_per_day: 1, duration_days: 60, dosing_pattern: 'alternate_day', routed_to: 'public_pharmacy' }),
  rxRow({ id: 'rx-006', patient_id: 'pt-02', sector: 'private', generic_name: '(unreadable)', brand_name: null, frequency_per_day: null, needs_review: true, routed_to: 'private_pharmacy' }),
  rxRow({ id: 'rx-007', patient_id: 'pt-02', sector: 'private', generic_name: 'Ciprofloxacin', brand_name: null, frequency_per_day: 2, duration_days: 7, needs_review: true, routed_to: 'private_pharmacy' }),
];
// pt-03 (سارة) — MCP output, `sara|getRefillOverview|pt-03`: rx-008 in mcg (never converted), rx-009 no dispensing.
const SARA_OVERVIEW: Row[] = [
  rxRow({ id: 'rx-008', patient_id: 'pt-03', sector: 'public', generic_name: 'Levothyroxine', brand_name: 'Eltroxin', frequency_per_day: 1, duration_days: 180, dispensing_units_per_package: 180, dispensing_total_quantity_dispensed: 180, dispensing_dispense_date: '2026-08-10', routed_to: 'public_pharmacy' }),
  rxRow({ id: 'rx-009', patient_id: 'pt-03', sector: 'private', generic_name: 'Calcium carbonate + vitamin D3', brand_name: null, frequency_per_day: 2, duration_days: 90, routed_to: 'private_pharmacy' }),
];
// `hamad|getRefillRequests|pt-01` and `sara|getCalendarSubscription|pt-03`.
const HAMAD_REQUESTS: Row[] = [
  { id: 'rf-01', status: 'requested', routed_to: 'public_pharmacy', patient_id: 'pt-01', requested_at: '2026-09-20T18:05:00+03:00', prescription_id: 'rx-003' },
  { id: 'rf-02', status: 'approved', routed_to: 'public_pharmacy', patient_id: 'pt-01', requested_at: '2026-08-20T09:00:00+03:00', prescription_id: 'rx-001' },
];
const SARA_CALENDAR: Row = { token: 'mock-token-cal-pt-03', ics_url: 'webcal://jurah.app/calendar/pt-03.ics', patient_id: 'pt-03' };

/** Exactly what lib/data/pg/reads-supply.ts does with the rows. */
const overview = (rows: Row[]) => (rows.length === 0 ? refillOverviewRefusal() : rows.map((r) => toRefillLine(r, depletionFor(r))));
const requests = (rows: Row[]) => (rows.length === 0 ? refillRequestsRefusal() : rows.map(toRefillRequest));
const calendar = (rows: Row[]) => (rows[0] ? toCalendarSubscriptionRead(rows[0]) : calendarSubscriptionRefusal());

const S: Record<string, Session | null> = {
  none: null,
  hamad: { subjectId: 'pt-01', role: 'patient' },
  fatima: { subjectId: 'pt-02', role: 'patient' },
  sara: { subjectId: 'pt-03', role: 'patient' },
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' },
  khalid: { subjectId: 'acc-10', role: 'reviewer' },
  dana: { subjectId: 'acc-11', role: 'admin' },
  naserPending: { subjectId: 'cg-03', pendingInvitationOnly: true },
  ...Object.fromEntries(['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07'].map((id) => [id, { subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' } as Session])),
};
async function mockAs<T>(who: string, fn: () => Promise<T>): Promise<string> {
  setScriptSession(S[who] ?? null);
  return JSON.stringify(await fn());
}

beforeEach(() => reset());

describe('WP3c — projection bytes against tests/fixtures/shapes.json', () => {
  it('getCalendarSubscription(pt-03) — the whole recorded shape', () => {
    expect(JSON.stringify(calendar([SARA_CALENDAR]))).toBe(JSON.stringify(fixture['getCalendarSubscription(pt-03)']));
  });

  it('getRefillOverview(pt-01) — the three seeded lines (the fourth is created by savePrescriptionDraft in the print-shapes run)', () => {
    const recorded = fixture['getRefillOverview(pt-01)'] as unknown[];
    expect(JSON.stringify(overview(HAMAD_OVERVIEW))).toBe(JSON.stringify(recorded.slice(0, 3)));
  });

  it('getRefillOverview(pt-01) — the created line: no dispensing → three explicit nulls, brand kept, public routing', () => {
    const created = rxRow({ id: 'rx-draft-10', patient_id: 'pt-01', sector: 'public', generic_name: 'Ibuprofen', brand_name: 'Brufen', frequency_per_day: 3, duration_days: 7, routed_to: 'public_pharmacy' });
    const recorded = fixture['getRefillOverview(pt-01)'] as unknown[];
    expect(JSON.stringify(overview([...HAMAD_OVERVIEW, created]))).toBe(JSON.stringify(recorded));
  });

  it('getRefillRequests(pt-01) — the two seeded rows (rf-03 is created by requestRefill in the print-shapes run)', () => {
    const recorded = fixture['getRefillRequests(pt-01)'] as unknown[];
    expect(JSON.stringify(requests(HAMAD_REQUESTS))).toBe(JSON.stringify(recorded.slice(0, 2)));
  });

  it('getRefillRequests(pt-01) — with the created row appended, the whole recorded shape', () => {
    const created = { id: 'rf-03', status: 'requested', routed_to: 'private_pharmacy', patient_id: 'pt-01', requested_at: '2026-09-21T09:15:00+03:00', prescription_id: 'rx-002' };
    expect(JSON.stringify(requests([...HAMAD_REQUESTS, created]))).toBe(JSON.stringify(fixture['getRefillRequests(pt-01)']));
  });
});

describe('WP3c — projection bytes against the mock under the same session', () => {
  it('فاطمة (pt-02): brandName absent (not null), depletion three nulls, rx-006 with no frequency', async () => {
    const pg = JSON.stringify(overview(FATIMA_OVERVIEW));
    expect(pg).toBe(await mockAs('fatima', () => getRefillOverview('pt-02')));
    expect(pg).not.toContain('brandName');
    expect(pg).toContain('"remaining":null,"total":null,"daysRemaining":null');
  });

  it('CR-040 (OPEN) — the flagged rx-006 (pending) and rx-007 (returned) are INCLUDED, as the mock', () => {
    const ids = overview(FATIMA_OVERVIEW).map((l) => l.prescriptionId);
    expect(ids).toEqual(['rx-005', 'rx-006', 'rx-007']);
  });

  it('سارة (pt-03): rx-008 (mcg) and rx-009 (no dispensing) equal the mock', async () => {
    expect(JSON.stringify(overview(SARA_OVERVIEW))).toBe(await mockAs('sara', () => getRefillOverview('pt-03')));
  });

  it('عبدالله (active caregiver, cg-01) and د. خالد (reviewer, ia-001 in queue) see حمد’s lines exactly as حمد does', async () => {
    const pg = JSON.stringify(overview(HAMAD_OVERVIEW));
    expect(pg).toBe(await mockAs('abdullah', () => getRefillOverview('pt-01')));
    expect(pg).toBe(await mockAs('khalid', () => getRefillOverview('pt-01')));
    expect(JSON.stringify(requests(HAMAD_REQUESTS))).toBe(await mockAs('abdullah', () => getRefillRequests('pt-01')));
  });
});

describe('WP3c — refusal literals equal what the mock returns for a refused caller (D-022)', () => {
  const refused = ['none', 'cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07', 'naserPending', 'dana'];
  for (const who of refused) {
    it(`${who}: getRefillOverview(pt-01) → [] · getRefillRequests(pt-01) → [] · getCalendarSubscription(pt-03) → null`, async () => {
      expect(await mockAs(who, () => getRefillOverview('pt-01'))).toBe(JSON.stringify(overview([])));
      expect(await mockAs(who, () => getRefillRequests('pt-01'))).toBe(JSON.stringify(requests([])));
      expect(await mockAs(who, () => getCalendarSubscription('pt-03'))).toBe(JSON.stringify(calendar([])));
    });
  }
  it('a caregiver — even the active عبدالله — gets null from getCalendarSubscription (patient-self only, as the mock)', async () => {
    expect(await mockAs('abdullah', () => getCalendarSubscription('pt-01'))).toBe('null');
    expect(await mockAs('khalid', () => getCalendarSubscription('pt-03'))).toBe('null');
  });
});

describe('WP3c — the depletion each row yields (WP4b depletionFor → computeDepletion, unedited)', () => {
  it('a NULL frequency (rx-006) and NULL dispensing give three nulls, never a fabricated estimate', () => {
    expect(depletionFor(FATIMA_OVERVIEW[1]!)).toEqual({ remaining: null, total: null, daysRemaining: null });
  });

  it('dispensing present (rx-001, 90 on 2026-09-01, 1/day): 70 left, 70 days — numbers stay numbers', () => {
    expect(depletionFor(HAMAD_OVERVIEW[0]!)).toEqual({ remaining: 70, total: 90, daysRemaining: 70 });
  });

  it('no Civil ID in any projected shape', () => {
    const all = JSON.stringify([overview(HAMAD_OVERVIEW), overview(FATIMA_OVERVIEW), overview(SARA_OVERVIEW), requests(HAMAD_REQUESTS), calendar([SARA_CALENDAR])]);
    expect(all).not.toMatch(/\d{12}/);
  });
});

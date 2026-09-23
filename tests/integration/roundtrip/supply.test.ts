/**
 * P2-WP3c round trip — getRefillOverview · getRefillRequests · getCalendarSubscription through the
 * REAL Postgres path (lib/data/pg/reads-supply.ts → withSession() → jurah_app + RLS), under the
 * seeded session print-shapes uses, compared with tests/fixtures/shapes.json AS A STRING (key order
 * included — BACKEND-PLAN §6, never deep-equal).
 *
 * Two recorded shapes carry a row another package's function creates in the print-shapes run
 * (`rx-draft-10` from WP3a's savePrescriptionDraft, `rf-03` from WP5's requestRefill). This file
 * does not wait for them: it first compares the SEEDED part, then inserts each created row as the
 * owner (system actor, the way those functions store it) under the fixture's own id so the string
 * compare stays byte-exact, and compares the WHOLE recorded shape. With the real creators the id is
 * opaque (CR-041 / D-1); that rule is applied at the gate by print-shapes, not here.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { afterAll, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { REFERENCE_NOW } from '@/lib/config';
import { getSql, type Tx } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import { getCalendarSubscription, getRefillOverview, getRefillRequests } from '@/lib/data/pg/reads-supply';
import type { Session } from '@/types/views';

const fixture = shapes as unknown as Record<string, unknown>;
const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const SARA: Session = { subjectId: 'pt-03', role: 'patient' };

async function as<T>(s: Session | null, fn: () => Promise<T>): Promise<string> {
  setScriptSession(s);
  return JSON.stringify(await fn());
}

/** Owner transaction under the system actor (as the seed runs) — COMMITTED, cleaned up in afterAll. */
async function asSystem(fn: (tx: Tx) => Promise<unknown>): Promise<void> {
  await getSql().begin(async (tx) => {
    await tx`select set_config('jurah.session', '{"role":"system"}', true), set_config('jurah.now', ${REFERENCE_NOW}, true)`;
    await fn(tx);
  });
}

afterAll(async () => {
  await asSystem(async (tx) => {
    await tx`delete from refill_requests where id = 'rf-03'`;
    await tx`delete from prescriptions where id = 'rx-draft-10'`;
  });
});

describe('round trip — supply (string-equal against tests/fixtures/shapes.json)', () => {
  it('getCalendarSubscription(pt-03) as سارة — the whole recorded shape', async () => {
    expect(await as(SARA, () => getCalendarSubscription('pt-03'))).toBe(JSON.stringify(fixture['getCalendarSubscription(pt-03)']));
  });

  it('getRefillOverview(pt-01) as حمد — the three seeded lines', async () => {
    const recorded = fixture['getRefillOverview(pt-01)'] as unknown[];
    expect(await as(HAMAD, () => getRefillOverview('pt-01'))).toBe(JSON.stringify(recorded.slice(0, 3)));
  });

  it('getRefillRequests(pt-01) as حمد — the two seeded rows, in seq order', async () => {
    const recorded = fixture['getRefillRequests(pt-01)'] as unknown[];
    expect(await as(HAMAD, () => getRefillRequests('pt-01'))).toBe(JSON.stringify(recorded.slice(0, 2)));
  });

  it('getRefillOverview(pt-01) as حمد — with the saved draft present, the WHOLE recorded shape', async () => {
    // What savePrescriptionDraft stores for the 500-byte confident draft (the mock's own record,
    // fixture `savePrescriptionDraft(pt-01)`): CR-042 source '' / public, no dispensing.
    await asSystem((tx) => tx`
      insert into prescriptions (id, patient_id, facility_name, sector, generic_name, brand_name, strength_mg,
        dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, dose_times,
        needs_review, field_review_status, status)
      values ('rx-draft-10', 'pt-01', '', 'public', 'Ibuprofen', 'Brufen', 400, 1, 3, 7, 'daily', '2026-09-21',
        array['08:00','14:00','20:00'], false, 'pending', 'active')`);
    expect(await as(HAMAD, () => getRefillOverview('pt-01'))).toBe(JSON.stringify(fixture['getRefillOverview(pt-01)']));
  });

  it('getRefillRequests(pt-01) as حمد — with the requested refill present, the WHOLE recorded shape', async () => {
    // routed_to is set by the refill_routing trigger from rx-002's own sector (private).
    await asSystem((tx) => tx`
      insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status)
      values ('rf-03', 'pt-01', 'rx-002', ${REFERENCE_NOW}, 'public_pharmacy', 'requested')`);
    expect(await as(HAMAD, () => getRefillRequests('pt-01'))).toBe(JSON.stringify(fixture['getRefillRequests(pt-01)']));
  });
});

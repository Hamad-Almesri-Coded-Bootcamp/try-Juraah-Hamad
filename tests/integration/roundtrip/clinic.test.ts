/**
 * P2-WP3b round trip — getAlerts · getAlert · checkDrugPhoto · getReviewQueue ·
 * getFieldConfirmationQueue · getAlertForReview · getFlaggedPrescription through the REAL Postgres
 * path (lib/data/pg/reads-clinic.ts → withSession() → jurah_app + RLS), under the seeded session
 * print-shapes uses, compared with tests/fixtures/shapes.json AS A STRING (key order included —
 * BACKEND-PLAN §6, never deep-equal).
 *
 * One recorded shape carries a row another package creates in the print-shapes run:
 * `getAlertForReview(ia-001)` was recorded AFTER WP3a's savePrescriptionDraft added `rx-draft-10`
 * and its three doses, so it lists them. This file first compares the SEEDED part (the fixture
 * with every `rx-draft-10*` entry removed), then inserts that created row as the owner (system
 * actor) under the fixture's own id and compares the WHOLE recorded shape byte for byte. With the
 * real creator the id is opaque (CR-041 / D-1) — nested too (`prescriptionId`, the dose ids); that
 * rule is applied at the gate by print-shapes, not here.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { afterAll, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { REFERENCE_NOW } from '@/lib/config';
import { getSql, type Tx } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import {
  checkDrugPhoto,
  getAlert,
  getAlertForReview,
  getAlerts,
  getFieldConfirmationQueue,
  getFlaggedPrescription,
  getReviewQueue,
} from '@/lib/data/pg/reads-clinic';
import type { AlertReviewView, Session } from '@/types/views';

const fixture = shapes as unknown as Record<string, unknown>;
const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };
const blob = (bytes: number) => new Blob([new Uint8Array(bytes)]);

async function as<T>(s: Session | null, fn: () => Promise<T>): Promise<string> {
  setScriptSession(s);
  return JSON.stringify(await fn());
}
const want = (key: string) => JSON.stringify(fixture[key]);

/** Owner transaction under the system actor (as the seed runs) — COMMITTED, cleaned up in afterAll. */
async function asSystem(fn: (tx: Tx) => Promise<unknown>): Promise<void> {
  await getSql().begin(async (tx) => {
    await tx`select set_config('jurah.session', '{"role":"system"}', true), set_config('jurah.now', ${REFERENCE_NOW}, true)`;
    await fn(tx);
  });
}

afterAll(async () => {
  await asSystem(async (tx) => {
    await tx`delete from doses where prescription_id = 'rx-draft-10'`;
    await tx`delete from prescriptions where id = 'rx-draft-10'`;
  });
});

describe('WP3b round trip — string-equal against shapes.json', () => {
  it('getAlerts(pt-01) as حمد', async () => {
    expect(await as(HAMAD, () => getAlerts('pt-01'))).toBe(want('getAlerts(pt-01)'));
  });
  it('getAlert(ia-001) as حمد', async () => {
    expect(await as(HAMAD, () => getAlert('ia-001'))).toBe(want('getAlert(ia-001)'));
  });
  it('checkDrugPhoto(pt-01) as حمد (500-byte image — CR-049 provider)', async () => {
    expect(await as(HAMAD, () => checkDrugPhoto('pt-01', blob(500)))).toBe(want('checkDrugPhoto(pt-01)'));
  });
  it('getReviewQueue as د. خالد (waitedMinutes 2771 from jurah_now())', async () => {
    expect(await as(KHALID, () => getReviewQueue())).toBe(want('getReviewQueue (as د. خالد)'));
  });
  it('getFieldConfirmationQueue as د. خالد (uncertainFields as the mock, hasSourceImage by the seed rule)', async () => {
    expect(await as(KHALID, () => getFieldConfirmationQueue())).toBe(want('getFieldConfirmationQueue (as د. خالد)'));
  });
  it('getFlaggedPrescription(rx-006) as د. خالد', async () => {
    expect(await as(KHALID, () => getFlaggedPrescription('rx-006'))).toBe(want('getFlaggedPrescription(rx-006, as د. خالد)'));
  });

  it('getAlertForReview(ia-001) as د. خالد — the SEEDED part (fixture minus rx-draft-10*)', async () => {
    const f = fixture['getAlertForReview(ia-001, as د. خالد)'] as AlertReviewView;
    const seeded: AlertReviewView = {
      ...f,
      patientContext: {
        ...f.patientContext,
        activePrescriptions: f.patientContext.activePrescriptions.filter((p) => p.id !== 'rx-draft-10'),
        recentDoses: f.patientContext.recentDoses.filter((d) => d.prescriptionId !== 'rx-draft-10'),
      },
    };
    expect(seeded.patientContext.recentDoses.length).toBe(54);
    expect(await as(KHALID, () => getAlertForReview('ia-001'))).toBe(JSON.stringify(seeded));
  });

  it('getAlertForReview(ia-001) as د. خالد — the WHOLE recorded shape once rx-draft-10 exists (created last → sorts after rx-003 on a tie)', async () => {
    await asSystem(async (tx) => {
      await tx`insert into prescriptions (id, patient_id, facility_name, sector, generic_name, brand_name, strength_mg,
                 dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, dose_times,
                 needs_review, field_review_status, status)
               values ('rx-draft-10', 'pt-01', '', 'public', 'Ibuprofen', 'Brufen', 400, 1, 3, 7, 'daily', '2026-09-21',
                 array['08:00','14:00','20:00'], false, 'pending', 'active')`;
      for (const t of ['0800', '1400', '2000']) {
        const at = `2026-09-21T${t.slice(0, 2)}:${t.slice(2)}:00+03:00`;
        await tx`insert into doses (id, prescription_id, scheduled_at, status, tracked, source)
                 values (${`rx-draft-10-20260921-${t}`}, 'rx-draft-10', ${at}::timestamptz, 'upcoming', false, 'seed')`;
      }
    });
    expect(await as(KHALID, () => getAlertForReview('ia-001'))).toBe(want('getAlertForReview(ia-001, as د. خالد)'));
  });

  it('no shape returns a Civil ID (G9)', async () => {
    const all = [
      await as(HAMAD, () => getAlerts('pt-01')),
      await as(KHALID, () => getReviewQueue()),
      await as(KHALID, () => getFieldConfirmationQueue()),
      await as(KHALID, () => getAlertForReview('ia-001')),
      await as(KHALID, () => getFlaggedPrescription('rx-006')),
    ].join('');
    expect(all).not.toMatch(/[0-9]{12}/);
  });
});

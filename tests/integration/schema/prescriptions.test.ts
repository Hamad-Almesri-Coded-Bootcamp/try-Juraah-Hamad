/** prescriptions — CR-002 invariants and the locked clinical fields. */
import { describe, expect, it } from 'vitest';
import { AGENT, S, SYSTEM, accepts, app, rejects } from '../helpers';

const cols = 'id, patient_id, facility_name, sector, generic_name, strength_mg, dose_per_administration, frequency_per_day, duration_days, dosing_pattern, start_date, dose_times, needs_review, status';
const row = (over: Partial<Record<string, string>> = {}) => {
  const v: Record<string, string> = { id: "'rxt'", patient_id: "'pt-01'", facility_name: "''", sector: "'public'", generic_name: "'X'", strength_mg: '5',
    dose_per_administration: '1', frequency_per_day: '1', duration_days: '7', dosing_pattern: "'daily'", start_date: "'2026-09-21'",
    dose_times: "array['08:00']", needs_review: 'false', status: "'active'", ...over };
  return `insert into prescriptions (${cols}) values (${cols.split(', ').map((c) => v[c]).join(', ')})`;
};

describe('prescriptions — constraints', () => {
  it('rx_dose_times_match_frequency', async () => { await rejects(SYSTEM, row({ frequency_per_day: '2' }), 'rx_dose_times_match_frequency'); });
  it('rx_dose_times_shape', async () => { await rejects(SYSTEM, row({ dose_times: "array['8am']" }), 'rx_dose_times_shape'); });
  it('rx_cr002_invariant_1 — an unflagged record without its clinical four', async () => {
    await rejects(SYSTEM, row({ start_date: 'null' }), 'rx_cr002_invariant_1');
    await rejects(SYSTEM, row({ strength_mg: 'null' }), 'rx_cr002_invariant_1');
  });
  it('rx_duration_days_positive', async () => { await rejects(SYSTEM, row({ duration_days: '0' }), 'rx_duration_days_positive'); });
  it('rx_dispensing_all_or_none', async () => {
    await rejects(SYSTEM, `update prescriptions set dispensing_dispense_date = null where id = 'rx-001'`, 'rx_dispensing_all_or_none');
  });
  it('rx_discontinued_complete', async () => {
    await rejects(SYSTEM, row({ status: "'discontinued'" }), 'rx_discontinued_complete');
  });
  it('rx_confirmed_has_reviewer', async () => {
    await rejects(SYSTEM, row().replace('needs_review, status)', 'needs_review, status, field_review_status)').replace("'active')", "'active', 'confirmed')"), 'rx_confirmed_has_reviewer');
  });
  it('prescriptions_patient_id_fkey', async () => { await rejects(SYSTEM, row({ patient_id: "'pt-99'" }), 'prescriptions_patient_id_fkey'); });
  it("strength is stored as written: rx-008 is 50 mcg, never 0.05", async () => {
    const r = await accepts(SYSTEM, 'select 1', `select strength_mg::text || ' ' || strength_unit from prescriptions where id = 'rx-008'`);
    expect(r.value).toBe('50 mcg');
  });
});

describe('prescriptions — prescription_clinical_fields_locked', () => {
  it('a clinical field changes only on the reviewer confirm path', async () => {
    await rejects(SYSTEM, `update prescriptions set generic_name = 'Y' where id = 'rx-001'`, 'prescription_clinical_fields_locked');
    await rejects({ role: 'owner', session: S.khalidReviewer }, `update prescriptions set generic_name = 'Y' where id = 'rx-001'`, 'prescription_clinical_fields_locked');
  });
  it('a review decision is one-shot: rx-009 (confirmed) and rx-007 (returned) cannot be decided again', async () => {
    await rejects(app(S.khalidReviewer), `update prescriptions set field_review_status = 'confirmed', frequency_per_day = 2, needs_review = false where id = 'rx-007'`, 'prescription_clinical_fields_locked');
    // Under RLS the reviewer cannot even see rx-009 (سارة has no queue item): 0 rows, nothing changed…
    const hidden = await accepts(app(S.khalidReviewer), `update prescriptions set field_review_note = 'again' where id = 'rx-009'`);
    expect(hidden.count).toBe(0);
    // …and where RLS does not hide it (the owner, with the reviewer's session), the trigger raises.
    await rejects({ role: 'owner', session: S.khalidReviewer }, `update prescriptions set field_review_note = 'again' where id = 'rx-009'`, 'prescription_clinical_fields_locked');
  });
  it('status/discontinuation only on the agent/system path; id and patient_id never', async () => {
    await rejects({ role: 'owner', session: S.hamad }, `update prescriptions set status = 'discontinued', discontinued_reason = 'x', discontinued_at = '2026-09-21' where id = 'rx-002'`, 'prescription_clinical_fields_locked');
    await rejects(SYSTEM, `update prescriptions set patient_id = 'pt-02' where id = 'rx-001'`, 'prescription_clinical_fields_locked: id and patient_id never change');
    const ok = await accepts(AGENT, `update prescriptions set status = 'discontinued', discontinued_reason = 'x', discontinued_at = '2026-09-21' where id = 'rx-002'`);
    expect(ok.count).toBe(1);
  });
  it('POSITIVE: a reviewer confirms pending rx-006 with its clinical fields in one statement', async () => {
    const r = await accepts(app(S.khalidReviewer),
      `update prescriptions set strength_mg = 5, frequency_per_day = 1, start_date = '2026-09-20', dose_times = array['09:00'], needs_review = false,
         field_review_status = 'confirmed', field_reviewed_by = 'acc-10', field_reviewed_at = jurah_now() where id = 'rx-006'`,
      `select field_review_status::text from prescriptions where id = 'rx-006'`);
    expect(r).toEqual({ count: 1, value: 'confirmed' });
  });
  it('a patient session cannot update a prescription at all (RLS: 0 rows)', async () => {
    const r = await accepts(app(S.hamad), `update prescriptions set facility_name = 'x' where id = 'rx-001'`);
    expect(r.count).toBe(0);
  });
});

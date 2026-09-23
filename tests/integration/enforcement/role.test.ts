/**
 * ENFORCEMENT.md — the role-boundary rows owned by P2-WP5: E-29, E-30, E-33, E-34, E-35 (write half),
 * E-42 (the refill row, tagged `client`, kept here beside E-29's refill call), each titled by its id,
 * against the REAL database (setup.ts re-seeds and FAILS loudly without JURAH_DATABASE_URL). Each row
 * asserts the database half (the raw statement under that session: RLS 0 rows / the named trigger /
 * permission denied) AND the seam half (the mock's refusal shape, tables unchanged).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as pg from '@/lib/data/pg';
import * as R from '@/lib/data/refusals';
import { S, app, probe, rejects } from '../helpers';
import { ABDULLAH, DANA, HAMAD, KHALID, SARA, asJson, count, fingerprint, owner, reseed, as } from './_wp5';

beforeEach(async () => { await reseed(); });

const rows = (as: ReturnType<typeof app>, statement: string) => probe(as, async (tx) => (await tx.unsafe(statement)).count);

describe('role boundaries — the writes', () => {
  it('E-29', async () => {
    const before = await fingerprint();
    const img = new Blob([new Uint8Array(500)]);
    // the seam: each write as عبدالله (active caregiver of pt-01) returns the mock's refusal shape
    const settingsNow = await asJson(HAMAD, () => pg.getSettings('pt-01'));
    expect(await asJson(ABDULLAH, () => pg.updateSettings('pt-01', { refillAlertsEnabled: false }))).toBe(settingsNow);
    expect(await asJson(ABDULLAH, () => pg.requestRefill('pt-01', 'rx-003'))).toBe(JSON.stringify(R.refillRequestRefusal('pt-01', 'rx-003')));
    expect(await asJson(ABDULLAH, () => pg.inviteCaregiver('pt-01', { civilId: '292043000517', name: 'x', relationship: 'y' }))).toBe(JSON.stringify(R.inviteRefusal('pt-01', { name: 'x', relationship: 'y' })));
    expect(await asJson(ABDULLAH, () => pg.submitPrescriptionImage('pt-01', img))).toBe(JSON.stringify(R.extractionRefusal()));
    expect(await asJson(ABDULLAH, () => pg.savePrescriptionDraft('pt-01', 'draft-x'))).toBe(JSON.stringify(R.draftSaveRefusal('pt-01')));
    expect(await asJson(ABDULLAH, () => pg.updatePatientPhone('pt-01', '1'))).toBe('undefined');
    expect(await asJson(ABDULLAH, () => pg.completeOnboarding('pt-01'))).toBe('undefined');
    expect(await asJson(ABDULLAH, () => pg.enableCalendarSync('pt-01'))).toBe(JSON.stringify(R.enableCalendarSyncRefusal('pt-01')));
    expect(await asJson(ABDULLAH, () => pg.revokeCaregiver('cg-02'))).toBe('undefined');
    expect(await fingerprint()).toBe(before); // tables unchanged
    // the database: the same statements, raw, under عبدالله
    const cg = app(S.abdullah);
    expect(await rows(cg, `update settings set refill_alerts_enabled = false where patient_id = 'pt-01'`)).toBe(0);
    expect(await rows(cg, `update patients set phone = '1' where id = 'pt-01'`)).toBe(0);
    expect(await rows(cg, `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-02'`)).toBe(0);
    await rejects(cg, `insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status) values ('rf_x', 'pt-01', 'rx-003', jurah_now(), 'public_pharmacy', 'requested')`, 'row-level security');
    await rejects(cg, `insert into caregivers (id, civil_id, name, relationship, linked_patient_id, status, invited_at, expires_at) values ('cg_x', '292043000517', 'x', 'y', 'pt-01', 'pending', jurah_now(), jurah_now())`, 'row-level security');
    await rejects(cg, `insert into prescriptions (id, patient_id, facility_name, sector, generic_name, dose_per_administration, duration_days, dosing_pattern, needs_review, status) values ('rx_x', 'pt-01', '', 'public', 'x', 1, 1, 'daily', true, 'active')`, 'row-level security');
    await rejects(cg, `insert into calendar_subscriptions (patient_id, token, ics_url) values ('pt-01', 't', 'u')`, 'row-level security');
  });

  it('E-30', async () => {
    // selfUnlink of ANOTHER caregiver's row: 0 rows, nothing changes; his own link row is WP6's (channels.test.ts)
    const before = await fingerprint();
    expect(await asJson(ABDULLAH, () => pg.selfUnlink('cg-02'))).toBe('undefined');
    expect(await owner(`select status::text from caregivers where id = 'cg-02'`)).toBe('active');
    expect(await fingerprint()).toBe(before);
    expect(await rows(app(S.abdullah), `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-02'`)).toBe(0);
    // a link row for another subject: the insert policy refuses it (the seam's startMessagingLink is WP6's)
    // (for another caregiver the BEFORE trigger refuses first — BEFORE triggers run before RLS WITH CHECK)
    await rejects(app(S.abdullah), `insert into messaging_links (id, subject_type, subject_id, status, link_token, token_expires_at) values ('ml_x', 'caregiver', 'cg-02', 'pending', 'tok', jurah_now())`, 'link_caregiver_must_be_active');
    await rejects(app(S.abdullah), `insert into messaging_links (id, subject_type, subject_id, status, link_token, token_expires_at) values ('ml_x', 'patient', 'pt-01', 'pending', 'tok', jurah_now())`, 'row-level security');
    // his OWN self-unlink is allowed (positive control)
    await as(ABDULLAH, () => pg.selfUnlink('cg-01'));
    expect(await owner(`select status::text from caregivers where id = 'cg-01'`)).toBe('revoked');
  });

  it('E-33', async () => {
    const forbidden = { status: 'discontinued', patientId: 'pt-01', source: { facilityName: 'X', sector: 'public' } };
    // (a) the brief's literal call — only drug.strengthMg reaches SQL, and a confirm without the other
    //     CR-002 fields is refused by rx_cr002_invariant_1: the record is returned UNCHANGED
    const unchanged = await asJson(KHALID, () => pg.getFlaggedPrescription('rx-006'));
    expect(await asJson(KHALID, () => pg.confirmPrescriptionFields('rx-006', { ...forbidden, drug: { genericName: 'X', strengthMg: 5 } } as never))).toBe(unchanged);
    expect(await owner(`select field_review_status::text from prescriptions where id = 'rx-006'`)).toBe('pending');
    // (b) with the four others given: exactly the five values change, nothing else — and (G1) the
    //     regeneration touches no RECORDED dose anywhere (سارة's five survive, id and status intact)
    const recorded = () => owner<string>(`select count(*)::int || '|' || md5(string_agg(id || ':' || status::text || ':' || coalesce(recorded_at::text, ''), ',' order by id)) from doses where status <> 'upcoming'`);
    const recordedBefore = await recorded();
    expect(recordedBefore.startsWith('5|')).toBe(true);
    const got = await as(KHALID, () => pg.confirmPrescriptionFields('rx-006', { ...forbidden, drug: { genericName: 'X', strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] } as never, 'تم التأكيد'));
    expect(got.status).toBe('active');
    expect(got.patientId).toBe('pt-02');
    expect(got.source).toEqual({ facilityName: 'عيادة الياسمين', sector: 'private' });
    expect(got.drug).toEqual({ genericName: '(unreadable)', strengthMg: 5 });
    expect(await owner(`select status::text || '|' || patient_id || '|' || facility_name || '|' || sector::text || '|' || generic_name || '|' || strength_mg::float8 || '|' || frequency_per_day || '|' || start_date || '|' || array_to_string(dose_times, ',') || '|' || needs_review || '|' || field_review_status::text || '|' || field_reviewed_by from prescriptions where id = 'rx-006'`))
      .toBe('active|pt-02|عيادة الياسمين|private|(unreadable)|5|1|2026-09-20|09:00|false|confirmed|acc-10');
    expect(await count(`select 1 from doses where prescription_id = 'rx-006' and status = 'upcoming'`)).toBe(30); // regenerated
    expect(await recorded()).toBe(recordedBefore); // G1: every recorded dose identical after the regeneration
    expect(await owner(`select message from audit_events where type = 'prescription_field_confirmed' and related_id = 'rx-006'`)).toBe('تأكيد بيانات وصفة (unreadable)');
    // the database: a reviewer's clinical write outside the confirm path; an alert's non-review column
    await rejects(app(S.khalidReviewer), `update prescriptions set generic_name = 'X' where id = 'rx-007'`, 'prescription_clinical_fields_locked');
    await rejects(app(S.khalidReviewer), `update interaction_alerts set description = 'x' where id = 'ia-001'`, 'permission denied');
    await rejects({ role: 'owner', session: S.khalidReviewer }, `update interaction_alerts set description = 'x' where id = 'ia-001'`, 'alert_review_once: only the five review fields may ever change');
  });

  it('E-34', async () => {
    // submitReviewDecision('ia-002') — already reviewed: nothing written
    const ia002 = await owner(`select row(a.*)::text from interaction_alerts a where id = 'ia-002'`);
    await as(KHALID, () => pg.submitReviewDecision('ia-002', 'cleared'));
    expect(await owner(`select row(a.*)::text from interaction_alerts a where id = 'ia-002'`)).toBe(ia002);
    // ia-001 twice: the first decision stands, exactly one alert_reviewed row
    await as(KHALID, () => pg.submitReviewDecision('ia-001', 'confirmed', 'ملاحظة المراجع'));
    await as(KHALID, () => pg.submitReviewDecision('ia-001', 'cleared', 'second'));
    expect(await owner(`select reviewer_decision::text || '|' || reviewer_note || '|' || reviewed_by from interaction_alerts where id = 'ia-001'`)).toBe('confirmed|ملاحظة المراجع|acc-10');
    expect(await count(`select 1 from audit_events where type = 'alert_reviewed' and related_id = 'ia-001'`)).toBe(1);
    expect(await owner(`select message from audit_events where type = 'alert_reviewed' and related_id = 'ia-001'`)).toBe('مراجعة تنبيه — تأكيد');
    await rejects({ role: 'owner', session: S.khalidReviewer }, `update interaction_alerts set reviewer_decision = 'cleared' where id = 'ia-001'`, 'alert_review_once: this alert has already been decided');
    // returnPrescriptionToClinic('rx-007') — already returned: the unchanged record, no audit row
    const rx007 = await asJson(KHALID, () => pg.getFlaggedPrescription('rx-007'));
    expect(await asJson(KHALID, () => pg.returnPrescriptionToClinic('rx-007', 'again'))).toBe(rx007);
    expect(await count(`select 1 from audit_events where type = 'prescription_returned_to_clinic' and related_id = 'rx-007'`)).toBe(1); // the seed's ae-033 only
    // confirmPrescriptionFields('rx-009') — already confirmed and in no queue: the bare { id }
    expect(await asJson(KHALID, () => pg.confirmPrescriptionFields('rx-009', { frequencyPerDay: 2 }))).toBe(JSON.stringify(R.prescriptionWriteRefusal('rx-009')));
    // rx-006 confirmed once, then again: the second is refused by the trigger and changes nothing
    const values = { drug: { strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] };
    await as(KHALID, () => pg.confirmPrescriptionFields('rx-006', values as never, 'first'));
    const after1 = await owner(`select row(p.*)::text from prescriptions p where id = 'rx-006'`);
    const doses1 = await count(`select 1 from doses where prescription_id = 'rx-006'`);
    await as(KHALID, () => pg.confirmPrescriptionFields('rx-006', { ...values, drug: { strengthMg: 7 } } as never, 'second'));
    expect(await owner(`select row(p.*)::text from prescriptions p where id = 'rx-006'`)).toBe(after1);
    expect(await count(`select 1 from doses where prescription_id = 'rx-006'`)).toBe(doses1);
    await rejects(app(S.khalidReviewer), `update prescriptions set strength_mg = 7, needs_review = false, field_review_status = 'confirmed' where id = 'rx-006'`, 'prescription_clinical_fields_locked');
    // the one-shot return path, positive control on a pending row: returned, needs_review KEPT true
    await reseed();
    const returned = await as(KHALID, () => pg.returnPrescriptionToClinic('rx-006', 'الجرعة غير واضحة'));
    expect(returned.fieldReviewStatus).toBe('returned');
    expect(await owner(`select needs_review || '|' || field_review_status::text from prescriptions where id = 'rx-006'`)).toBe('true|returned');
    expect(await owner(`select message from audit_events where type = 'prescription_returned_to_clinic' and related_id = 'rx-006'`)).toBe('أُعيدت وصفة (unreadable) للعيادة');
  });

  it('E-35', async () => {
    // م. دانة (admin only) may not create, accept, cancel or revoke an invitation
    const before = await fingerprint();
    expect(await asJson(DANA, () => pg.inviteCaregiver('pt-01', { civilId: '292043000517', name: 'x', relationship: 'y' }))).toBe(JSON.stringify(R.inviteRefusal('pt-01', { name: 'x', relationship: 'y' })));
    expect(await asJson(DANA, () => pg.acceptInvitation('cg-03'))).toBe(JSON.stringify(DANA));
    expect(await asJson(DANA, () => pg.revokeCaregiver('cg-01'))).toBe('undefined');
    expect(await asJson(DANA, () => pg.cancelInvitation('cg-03'))).toBe('undefined');
    expect(await fingerprint()).toBe(before);
    const admin = app(S.dana);
    await rejects(admin, `insert into caregivers (id, civil_id, name, relationship, linked_patient_id, status, invited_at, expires_at) values ('cg_x', '292043000517', 'x', 'y', 'pt-01', 'pending', jurah_now(), jurah_now())`, 'row-level security');
    for (const q of [`update caregivers set status = 'active', accepted_at = jurah_now() where id = 'cg-03'`,
                     `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-01'`,
                     `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-03'`]) {
      expect(await rows(admin, q), q).toBe(0);
    }
  });

  it('E-42', async () => {
    const before = await count('select 1 from refill_requests');
    // حمد, سارة's rx-008 · حمد, his discontinued rx-004 · عبدالله for حمد
    expect(await asJson(HAMAD, () => pg.requestRefill('pt-01', 'rx-008'))).toBe(JSON.stringify(R.refillRequestRefusal('pt-01', 'rx-008')));
    expect(await asJson(HAMAD, () => pg.requestRefill('pt-01', 'rx-004'))).toBe(JSON.stringify(R.refillRequestRefusal('pt-01', 'rx-004')));
    expect(await asJson(ABDULLAH, () => pg.requestRefill('pt-01', 'rx-003'))).toBe(JSON.stringify(R.refillRequestRefusal('pt-01', 'rx-003')));
    expect(await asJson(SARA, () => pg.requestRefill('pt-01', 'rx-003'))).toBe(JSON.stringify(R.refillRequestRefusal('pt-01', 'rx-003')));
    expect(await count('select 1 from refill_requests')).toBe(before);
    expect(await count(`select 1 from audit_events where type = 'refill_requested' and id !~ '^ae-[0-9]{3}$'`)).toBe(0);
    const hamad = app(S.hamad);
    const ins = (rx: string, routed = 'public_pharmacy') => `insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status) values ('rf_x', 'pt-01', '${rx}', jurah_now(), '${routed}', 'requested')`;
    await rejects(hamad, ins('rx-008'), 'refill_routing: prescription not found for this patient');
    await rejects(hamad, ins('rx-004'), 'refill_routing: prescription is not active');
    await rejects(app(S.abdullah), ins('rx-003'), 'row-level security');
    await rejects({ role: 'owner', session: S.hamad }, `insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status) values ('rf_x', 'pt-01', 'rx-008', jurah_now(), 'public_pharmacy', 'requested')`, 'refill_routing: prescription does not belong to this patient');
    // routedTo is derived: a client-chosen private_pharmacy for the public rx-003 is overwritten
    const routed = await probe(hamad, async (tx) => (await tx.unsafe(`${ins('rx-003', 'private_pharmacy')} returning routed_to::text as r`))[0]?.r);
    expect(routed).toBe('public_pharmacy');
    // the seam's own success path (the fixture's call): private rx-002 → private_pharmacy, audited
    const ok = await as(HAMAD, () => pg.requestRefill('pt-01', 'rx-002'));
    expect({ ...ok, id: 'rf-03' }).toEqual({ id: 'rf-03', patientId: 'pt-01', prescriptionId: 'rx-002', requestedAt: '2026-09-21T09:15:00+03:00', routedTo: 'private_pharmacy', status: 'requested' });
    expect(await owner(`select message from audit_events where type = 'refill_requested' and related_id = '${ok.id}'`)).toBe('طلب تعبئة Ibuprofen');
  });
});

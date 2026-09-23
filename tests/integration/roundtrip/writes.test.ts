/**
 * P2-WP5 round trip — every write's RETURNED shape through the real Postgres path
 * (lib/data/pg/writes.ts → withSession() → jurah_app + RLS + triggers), in print-shapes' order and
 * under print-shapes' sessions, compared with tests/fixtures/shapes.json AS A STRING (key order
 * included — BACKEND-PLAN §6, never deep-equal). CR-041: a CREATED row's `id` is "present and a
 * string" — the recorded counter id is copied over it before the string compare; nothing else is.
 *
 * CR-060 (Gate 5): print-shapes now records a five-value confirm of rx-006 and a FIRST return of a
 * freshly saved flagged record (فاطمة's unreadable scan), so both lines are reproducible here.
 * lookupMaskedName runs as حمد (a session is required, E-14 — print-shapes' Postgres run does the same).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import * as pg from '@/lib/data/pg';
import * as mock from '@/lib/data/mock-impl';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import { ABDULLAH, BADR, FATIMA, HAMAD, KHALID, NASER_PENDING, SARA, as, asJson, reseed } from '../enforcement/_wp5';
import type { Session } from '@/types/views';

const fixture = shapes as unknown as Record<string, unknown>;
const recorded = (key: string) => (fixture[key] === undefined ? 'undefined' : JSON.stringify(fixture[key]));
/** CR-041: copy the recorded id over a created row's opaque id; everything else stays byte-exact. */
function withRecordedId(got: string, key: string): string {
  const want = fixture[key] as { id?: string } | undefined;
  if (!want || typeof want.id !== 'string' || got === 'undefined') return got;
  const o = JSON.parse(got) as { id?: unknown };
  if (typeof o.id !== 'string' || o.id === '') return got;
  return JSON.stringify({ ...o, id: want.id });
}

let naser: Session = NASER_PENDING;
beforeAll(async () => { await reseed(); reset(); });

describe('round trip — the writes, in print-shapes\' order (string-equal against tests/fixtures/shapes.json)', () => {
  it('updatePatientPhone(pt-01) as حمد', async () => {
    expect(await asJson(HAMAD, () => pg.updatePatientPhone('pt-01', '99887766'))).toBe(recorded('updatePatientPhone(pt-01)'));
  });
  it('completeOnboarding(pt-04) as بدر', async () => {
    expect(await asJson(BADR, () => pg.completeOnboarding('pt-04'))).toBe(recorded('completeOnboarding(pt-04)'));
  });
  it('updateSettings(pt-01) as حمد — patientId FIRST', async () => {
    expect(await asJson(HAMAD, () => pg.updateSettings('pt-01', { refillAlertsEnabled: true }))).toBe(recorded('updateSettings(pt-01)'));
  });
  it('requestRefill(pt-01, rx-002) as حمد — routed from rx-002\'s own (private) sector; CR-041 id', async () => {
    const got = await asJson(HAMAD, () => pg.requestRefill('pt-01', 'rx-002'));
    expect(JSON.parse(got).id).toMatch(/^rf_[0-9A-Z]{26}$/);
    expect(withRecordedId(got, 'requestRefill(pt-01, rx-002)')).toBe(recorded('requestRefill(pt-01, rx-002)'));
  });
  it('lookupMaskedName × 2 as حمد', async () => {
    expect(await asJson(HAMAD, () => pg.lookupMaskedName('285061400412'))).toBe(recorded('lookupMaskedName(عبدالله, has an account)'));
    expect(await asJson(HAMAD, () => pg.lookupMaskedName('277091900873'))).toBe(recorded('lookupMaskedName(no account)'));
  });
  let invitedId = '';
  it('inviteCaregiver(pt-01) as حمد — pending, +14 days, no civilId; CR-041 id', async () => {
    const got = await asJson(HAMAD, () => pg.inviteCaregiver('pt-01', { civilId: '299999900000', name: 'اختبار', relationship: 'قريب' }));
    invitedId = JSON.parse(got).id;
    expect(invitedId).toMatch(/^cg_[0-9A-Z]{26}$/);
    expect(withRecordedId(got, 'inviteCaregiver(pt-01)')).toBe(recorded('inviteCaregiver(pt-01)'));
  });
  it('cancelInvitation(new invite) · revokeCaregiver(cg-01) as حمد', async () => {
    expect(await asJson(HAMAD, () => pg.cancelInvitation(invitedId))).toBe(recorded('cancelInvitation(new invite)'));
    expect(await asJson(HAMAD, () => pg.revokeCaregiver('cg-01'))).toBe(recorded('revokeCaregiver(cg-01)'));
  });
  it('acceptInvitation(cg-03) as ناصر → the new caregiver Session', async () => {
    const got = await asJson(NASER_PENDING, () => pg.acceptInvitation('cg-03'));
    expect(got).toBe(recorded('acceptInvitation(cg-03, as ناصر)'));
    naser = JSON.parse(got) as Session;
  });
  it('declineInvitation(cg-08) as سارة', async () => {
    expect(await asJson(SARA, () => pg.declineInvitation('cg-08'))).toBe(recorded('declineInvitation(cg-08, as سارة)'));
  });
  it('selfUnlink(cg-03) as the accepted ناصر', async () => {
    expect(await asJson(naser, () => pg.selfUnlink('cg-03'))).toBe(recorded('selfUnlink(cg-03)'));
  });
  it('submitReviewDecision(ia-001) as د. خالد', async () => {
    expect(await asJson(KHALID, () => pg.submitReviewDecision('ia-001', 'confirmed', 'ملاحظة المراجع'))).toBe(recorded('submitReviewDecision(ia-001, as د. خالد)'));
  });
  it('confirmPrescriptionFields(rx-006) as د. خالد — all five values (CR-060)', async () => {
    const got = await asJson(KHALID, () => pg.confirmPrescriptionFields('rx-006', { drug: { genericName: '(unreadable)', brandName: 'Panadol', strengthMg: 500 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] }, 'تم التأكيد'));
    expect(got).toBe(recorded('confirmPrescriptionFields(rx-006, as د. خالد)'));
  });
  it('returnPrescriptionToClinic(new flagged prescription) as د. خالد — a first return; CR-041 id', async () => {
    const draft = await as(FATIMA, () => pg.submitPrescriptionImage('pt-02', new Blob([new Uint8Array(50)])));
    expect(draft.kind).toBe('needs_review');
    const saved = await as(FATIMA, () => pg.savePrescriptionDraft('pt-02', 'draftId' in draft ? draft.draftId : ''));
    expect(saved.id).toMatch(/^rx_[0-9A-Z]{26}$/);
    const key = 'returnPrescriptionToClinic(new flagged prescription, as د. خالد)';
    const got = await asJson(KHALID, () => pg.returnPrescriptionToClinic(saved.id, 'الجرعة غير واضحة'));
    expect(withRecordedId(got, key)).toBe(recorded(key));
  });
});

describe('round trip — the happy paths the fixture cannot show, string-equal to the MOCK on the same arguments', () => {
  it('confirmPrescriptionFields(rx-006) with all five values', async () => {
    await reseed(); reset();
    const values = { drug: { genericName: '(unreadable)', strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] };
    const got = await asJson(KHALID, () => pg.confirmPrescriptionFields('rx-006', values, 'تم التأكيد'));
    expect(got).toBe(await asJson(KHALID, () => mock.confirmPrescriptionFields('rx-006', values, 'تم التأكيد')));
  });
  it('returnPrescriptionToClinic(rx-006)', async () => {
    await reseed(); reset();
    const got = await asJson(KHALID, () => pg.returnPrescriptionToClinic('rx-006', 'الجرعة غير واضحة'));
    expect(got).toBe(await asJson(KHALID, () => mock.returnPrescriptionToClinic('rx-006', 'الجرعة غير واضحة')));
  });
  it('updateSettings(pt-04) as بدر — the created row, patientId LAST', async () => {
    await reseed(); reset();
    expect(await asJson(BADR, () => pg.updateSettings('pt-04', { refillAlertsEnabled: true }))).toBe(await asJson(BADR, () => mock.updateSettings('pt-04', { refillAlertsEnabled: true })));
  });
  it('a refused caregiver write returns the mock\'s bytes (updateSettings, requestRefill)', async () => {
    await reseed(); reset();
    for (const [real, ref] of [
      [() => pg.updateSettings('pt-01', { language: 'en' }), () => mock.updateSettings('pt-01', { language: 'en' })],
      [() => pg.requestRefill('pt-01', 'rx-003'), () => mock.requestRefill('pt-01', 'rx-003')],
    ] as [() => Promise<unknown>, () => Promise<unknown>][]) {
      expect(await asJson(ABDULLAH, real)).toBe(await asJson(ABDULLAH, ref));
    }
    setScriptSession(null);
  });
});

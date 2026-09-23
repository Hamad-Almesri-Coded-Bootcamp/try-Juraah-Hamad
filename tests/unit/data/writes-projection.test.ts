/**
 * P2-WP5 — the write paths' pure halves, proved WITHOUT a database (runs in `npm run verify`):
 * the seam whitelists (the seven Settings keys, E-11; the five confirmable values, E-33), the
 * refusal classifier (a database refusal is never a throw, D-022), and the projections' KEY ORDER
 * against the mock run on the same arguments — compared as serialised STRINGS, never deep-equal.
 * The SQL itself is proved through the MCP connector (docs/backend-notes/p2-wp5.md §4) and by
 * tests/integration/** once JURAH_DATABASE_URL exists.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { reset, getStore } from '@/lib/data/mock/store';
import { buildPrescriptions } from '@/lib/data/mock/seed';
import { setScriptSession } from '@/lib/session/cookie';
import * as mock from '@/lib/data/mock-impl';
import { isRefusal, permittedSettingsKeys, settingsUpsert, PG_QUERIES_WRITES } from '@/lib/data/pg/writes';
import { confirmedDrug, firstName, inPlace, pickConfirmedFields, toInvitedCaregiver, toRefillRequestWrite, toSettingsWrite } from '@/lib/data/shapes/writes';
import { EngineInvariantError } from '@/lib/engine';
import type { Prescription } from '@/types/contracts';

const fixture = shapes as unknown as Record<string, unknown>;
const KHALID = { subjectId: 'acc-10', role: 'reviewer' } as const;
const seedRx = (id: string) => buildPrescriptions().find((p) => p.id === id)!;

/** What lib/data/pg/writes.ts builds for a confirmed record (the same calls, in the same order). */
function confirmedBy(before: Prescription, values: unknown, note: string | undefined): Prescription {
  const f = pickConfirmedFields(values as Partial<Prescription>);
  return inPlace<Prescription>(before, [
    ['drug', confirmedDrug(before.drug, f)],
    ...f.order.map((k): [keyof Prescription, unknown] => [k, f[k]]),
    ['needsReview', false], ['fieldReviewStatus', 'confirmed'],
    ['fieldReviewedBy', 'acc-10'], ['fieldReviewedAt', '2026-09-21T09:15:00+03:00'], ['fieldReviewNote', note],
  ]);
}

beforeEach(() => { reset(); setScriptSession(null); });

describe('E-11 — the seven Settings keys, nothing else reaches SQL', () => {
  it('drops unknown keys, patientId, a role, a nested object; keeps the patch order', () => {
    const keys = permittedSettingsKeys({ role: 'admin', foo: 1, patientId: 'pt-03', language: 'en', refillAlertsEnabled: true, nested: { a: 1 } } as never);
    expect(keys).toEqual(['language', 'refillAlertsEnabled']);
    expect(permittedSettingsKeys(null)).toEqual([]);
    expect(permittedSettingsKeys(['language'])).toEqual([]);
    expect(permittedSettingsKeys({ language: undefined })).toEqual([]);
  });
  it('the upsert names only whitelisted columns, values only as parameters, and carries the owner WHERE', () => {
    const sql = settingsUpsert(['language', 'refillAlertsEnabled']);
    expect(sql).toContain('insert into settings (patient_id, language, refill_alerts_enabled)');
    expect(sql).toContain('select $1, $2::language_t, $3::boolean');
    expect(sql).toContain("where jurah_session_is('patient') and jurah_session()->>'subjectId' = $1");
    expect(sql).toContain('do update set language = excluded.language, refill_alerts_enabled = excluded.refill_alerts_enabled');
    expect(settingsUpsert([])).toContain('do update set language = settings.language'); // RETURNING stays non-empty for the owner
    expect(sql).not.toMatch(/patient_id\s*=\s*excluded|role|foo/);
  });
});

describe('E-33 — confirmPrescriptionFields takes the five values only', () => {
  it('status, patientId, source and genericName never survive the pick', () => {
    const f = pickConfirmedFields({ status: 'discontinued', patientId: 'pt-01', source: { facilityName: 'x', sector: 'public' }, drug: { genericName: 'X', strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] } as never);
    expect(f).toEqual({ order: ['frequencyPerDay', 'startDate', 'doseTimes'], hasDrugChange: true, strengthMg: 5, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] });
    const out = confirmedBy(seedRx('rx-006'), { status: 'discontinued', patientId: 'pt-01', source: { facilityName: 'x', sector: 'public' }, drug: { genericName: 'X', strengthMg: 5 } }, undefined);
    expect(out.status).toBe('active');
    expect(out.patientId).toBe('pt-02');
    expect(JSON.stringify(out.source)).toBe(JSON.stringify(seedRx('rx-006').source));
    expect(out.drug).toEqual({ genericName: '(unreadable)', strengthMg: 5 });
  });
  it('the statement carries only the five columns and the review fields', () => {
    const set = PG_QUERIES_WRITES.confirmPrescriptionFields.split(/\bset\b/)[1]!.split(/\bwhere\b/)[0]!;
    const cols = [...set.matchAll(/(\w+)\s*=/g)].map((m) => m[1]);
    expect(cols).toEqual(['brand_name', 'strength_mg', 'frequency_per_day', 'start_date', 'dose_times', 'needs_review', 'field_review_status', 'field_reviewed_by', 'field_reviewed_at', 'field_review_note']);
  });
});

describe('key order = the mock on the same arguments (string-equal)', () => {
  it('confirmPrescriptionFields(rx-006) with all five values — byte-identical to the mock', async () => {
    const values = { drug: { genericName: '(unreadable)', strengthMg: 5 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] };
    const want = JSON.stringify(confirmedBy(seedRx('rx-006'), values, 'تم التأكيد'));
    setScriptSession(KHALID);
    expect(JSON.stringify(await mock.confirmPrescriptionFields('rx-006', values, 'تم التأكيد'))).toBe(want);
  });
  it('confirmPrescriptionFields(rx-006) with print-shapes\' recorded values (CR-060) — the fixture line, byte for byte', () => {
    const got = JSON.stringify(confirmedBy(seedRx('rx-006'), { drug: { genericName: '(unreadable)', brandName: 'Panadol', strengthMg: 500 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] }, 'تم التأكيد'));
    expect(got).toBe(JSON.stringify(fixture['confirmPrescriptionFields(rx-006, as د. خالد)']));
  });
  it('returnPrescriptionToClinic(rx-006) — byte-identical to the mock', async () => {
    const want = JSON.stringify(inPlace<Prescription>(seedRx('rx-006'), [
      ['fieldReviewStatus', 'returned'], ['fieldReviewNote', 'الجرعة غير واضحة'], ['fieldReviewedBy', 'acc-10'], ['fieldReviewedAt', '2026-09-21T09:15:00+03:00'],
    ]));
    setScriptSession(KHALID);
    expect(JSON.stringify(await mock.returnPrescriptionToClinic('rx-006', 'الجرعة غير واضحة'))).toBe(want);
  });
  it('updateSettings — an existing row puts patientId FIRST (the fixture); a row the write creates puts it LAST (the mock for بدر)', async () => {
    const row = { patient_id: 'pt-01', adherence_check_in_enabled: false, adherence_check_in_frequency: 'daily', refill_alerts_enabled: true, calendar_sync_enabled: false, web_push_enabled: false, notification_channel: 'none', language: 'ar' };
    expect(JSON.stringify(toSettingsWrite(row, false))).toBe(JSON.stringify(fixture['updateSettings(pt-01)']));
    setScriptSession({ subjectId: 'pt-04', role: 'patient' });
    const badr = await mock.updateSettings('pt-04', { refillAlertsEnabled: true });
    expect(JSON.stringify(toSettingsWrite({ ...row, patient_id: 'pt-04' }, true))).toBe(JSON.stringify(badr));
  });
  it('requestRefill / inviteCaregiver — the fixture, with CR-041\'s opaque id', () => {
    const rf = toRefillRequestWrite({ id: 'rf_01K', patient_id: 'pt-01', prescription_id: 'rx-002', requested_at: '2026-09-21T09:15:00+03:00', routed_to: 'private_pharmacy', status: 'requested' });
    expect(JSON.stringify({ ...rf, id: 'rf-03' })).toBe(JSON.stringify(fixture['requestRefill(pt-01, rx-002)']));
    const cg = toInvitedCaregiver({ id: 'cg_01K', name: 'اختبار', relationship: 'قريب', linked_patient_id: 'pt-01', status: 'pending', invited_at: '2026-09-21T09:15:00+03:00', expires_at: '2026-10-05T09:15:00+03:00', access_level: 'read_only' });
    expect(JSON.stringify({ ...cg, id: 'cg-09' })).toBe(JSON.stringify(fixture['inviteCaregiver(pt-01)']));
    expect(JSON.stringify(cg)).not.toMatch(/\d{12}/);
  });
  it('audit first names match the mock\'s split', () => {
    const cg = getStore().caregivers;
    for (const c of cg) expect(firstName(c.name)).toBe(c.name.split(/\s+/)[0] ?? '');
  });
});

describe('D-022 — a database refusal maps to a shape; a bug is re-thrown', () => {
  it('classifies', () => {
    expect(isRefusal({ code: '42501', message: 'new row violates row-level security policy for table "caregivers"' })).toBe(true);
    expect(isRefusal({ code: 'P0001', message: 'caregiver_transitions: only the invited civil id may accept' })).toBe(true);
    expect(isRefusal({ code: 'P0001', message: 'refill_routing: prescription is not active' })).toBe(true);
    expect(isRefusal({ code: '23514', message: 'violates check constraint "rx_cr002_invariant_1"' })).toBe(true);
    expect(isRefusal({ code: '22P02', message: 'invalid input value for enum' })).toBe(true);
    expect(isRefusal({ code: 'P0001', message: 'audit_events is append-only' })).toBe(false); // nothing here updates audit rows: a bug
    expect(isRefusal(new EngineInvariantError('x'))).toBe(false);
    expect(isRefusal(new Error('connect ECONNREFUSED'))).toBe(false);
  });
});

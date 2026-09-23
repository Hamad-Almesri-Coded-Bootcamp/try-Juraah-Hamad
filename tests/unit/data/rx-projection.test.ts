/**
 * P2-WP3a — the Postgres projection for prescriptions and doses, proved WITHOUT a database (this
 * file runs in `npm run verify`, mock backend). The row literals below are what the exact
 * `PG_QUERIES_RX` text returned through the Supabase MCP connector, run as `jurah_app` under the
 * seeded session (docs/backend-notes/p2-wp3a.md §2 has the SQL and the raw output), in the types the
 * driver hands back after the query's casts (float8 → number, to_char/iso_kw → text, NULL → null).
 * For the two large results (180 and 24 rows) the MCP run returned an md5 over the rows'
 * `row_to_json` lines; the test rebuilds those rows from the fixture, checks the same md5 (so the
 * database returned exactly these rows, in this order) and then projects them. Every comparison
 * is on the serialised STRING — key order included (BACKEND-PLAN §6), never deep-equal.
 */
import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import * as mock from '@/lib/data/mock-impl';
import { REFERENCE_DATE } from '@/lib/schedule/dates';
import {
  confidentDraft,
  NEEDS_REVIEW_UNCERTAIN_FIELDS,
  needsReviewDraft,
  prescriptionFromDraft,
  toDose,
  toDoseWithPrescription,
  toPrescription,
} from '@/lib/data/shapes/reads-rx';
import {
  doseHistoryRefusal,
  dosesWithPrescriptionRefusal,
  draftSaveRefusal,
  extractionRefusal,
  prescriptionRefusal,
  prescriptionsRefusal,
} from '@/lib/data/refusals/reads-rx';
import type { Dose, Prescription } from '@/types/contracts';
import type { DoseWithPrescription, Session } from '@/types/views';

type Row = Record<string, unknown>;
const fixture = shapes as unknown as Record<string, unknown>;
const str = (v: unknown) => JSON.stringify(v);

// `hamad|getPrescription|rx-001` — MCP output, verbatim.
const RX_001: Row = {
  id: 'rx-001', patient_id: 'pt-01', facility_name: 'مستشفى الفروانية', sector: 'public', generic_name: 'Warfarin', brand_name: 'Marevan',
  strength_mg: 5, strength_unit: null, dose_per_administration: 1, frequency_per_day: 1, duration_days: 90, dosing_pattern: 'daily',
  start_date: '2026-09-01', dose_times: ['18:00'], prescribed_at: null, prescriber_name: null, timing_relative_to_food: null,
  route_of_administration: null, special_notes: null, indication: null, dispensing_units_per_package: 90,
  dispensing_total_quantity_dispensed: 90, dispensing_dispense_date: '2026-09-01', dispensing_brand_actually_dispensed: null,
  needs_review: false, field_review_status: null, field_reviewed_by: null, field_reviewed_at: null, field_review_note: null,
  status: 'active', discontinued_reason: null, discontinued_at: null,
};

// `hamad|getDosesForDay|pt-01,2026-09-21` — MCP output, verbatim (6 rows, ties at 08:00/20:00 by id).
const day = (id: string, rx: string, at: string, drug: [string, string, number]): Row => ({
  id, prescription_id: rx, scheduled_at: at, status: 'upcoming', tracked: false, recorded_at: null, source: 'seed',
  generic_name: drug[0], brand_name: drug[1], strength_mg: drug[2], strength_unit: null, dose_per_administration: 1,
});
const IBU: [string, string, number] = ['Ibuprofen', 'Brufen', 400];
const MET: [string, string, number] = ['Metformin', 'Glucophage', 500];
const WAR: [string, string, number] = ['Warfarin', 'Marevan', 5];
const HAMAD_DAY: Row[] = [
  day('rx-002-20260921-0800', 'rx-002', '2026-09-21T08:00:00+03:00', IBU),
  day('rx-003-20260921-0800', 'rx-003', '2026-09-21T08:00:00+03:00', MET),
  day('rx-002-20260921-1400', 'rx-002', '2026-09-21T14:00:00+03:00', IBU),
  day('rx-001-20260921-1800', 'rx-001', '2026-09-21T18:00:00+03:00', WAR),
  day('rx-002-20260921-2000', 'rx-002', '2026-09-21T20:00:00+03:00', IBU),
  day('rx-003-20260921-2000', 'rx-003', '2026-09-21T20:00:00+03:00', MET),
];

// The row the MCP run's savePrescriptionDraft transaction re-selected (rolled back), verbatim —
// `rx_MCPPROOF` stands in for the opaque newId('rx') (CR-041: a created id is "present and a string").
const SAVED_ROW: Row = {
  id: 'rx_MCPPROOF', sector: 'public', status: 'active', brand_name: 'Brufen', dose_times: ['08:00', '14:00', '20:00'], indication: null,
  patient_id: 'pt-01', start_date: '2026-09-21', strength_mg: 400, generic_name: 'Ibuprofen', needs_review: false, duration_days: 7,
  facility_name: '', prescribed_at: null, special_notes: null, strength_unit: null, dosing_pattern: 'daily', discontinued_at: null,
  prescriber_name: null, field_review_note: null, field_reviewed_at: null, field_reviewed_by: null, frequency_per_day: 3,
  discontinued_reason: null, field_review_status: 'pending', dose_per_administration: 1, route_of_administration: null,
  timing_relative_to_food: null, dispensing_dispense_date: null, dispensing_units_per_package: null,
  dispensing_brand_actually_dispensed: null, dispensing_total_quantity_dispensed: null,
};

// md5(string_agg(row_to_json(q)::text, E'\n')) over the exact PG_QUERIES_RX text, MCP output.
const DB_MD5 = {
  'getPrescriptions(pt-01)': { md5: '6f3d79f1e70416ccc179dd975ba5c510', n: 4 },
  'getDoseHistory(rx-008)': { md5: '44298a2bf5344600c81bad0d95fb61c6', n: 180 },
  'getRecentDoses(pt-03, 7)': { md5: '999d8c93ab8ec2a1118b1ce4c69baadd', n: 24 },
} as const;
const doseRow = (d: Dose): Row => ({
  id: d.id, prescription_id: d.prescriptionId, scheduled_at: d.scheduledAt, status: d.status, tracked: d.tracked ?? null,
  recorded_at: d.recordedAt ?? null, source: d.source ?? null,
});
const dwpRow = (d: DoseWithPrescription): Row => ({
  ...doseRow(d), generic_name: d.drug.genericName, brand_name: d.drug.brandName ?? null, strength_mg: d.drug.strengthMg ?? null,
  strength_unit: d.drug.strengthUnit ?? null, dose_per_administration: d.dosePerAdministration,
});
/** A Prescription back to the row RX_COLUMNS returns, in its column order (NULL for an absent field). */
const rxRow = (p: Prescription): Row => ({
  id: p.id, patient_id: p.patientId, facility_name: p.source.facilityName, sector: p.source.sector, generic_name: p.drug.genericName,
  brand_name: p.drug.brandName ?? null, strength_mg: p.drug.strengthMg ?? null, strength_unit: p.drug.strengthUnit ?? null,
  dose_per_administration: p.dosePerAdministration, frequency_per_day: p.frequencyPerDay ?? null, duration_days: p.durationDays,
  dosing_pattern: p.dosingPattern, start_date: p.startDate ?? null, dose_times: p.doseTimes ?? null, prescribed_at: p.prescribedAt ?? null,
  prescriber_name: p.prescriberName ?? null, timing_relative_to_food: p.timingRelativeToFood ?? null,
  route_of_administration: p.routeOfAdministration ?? null, special_notes: p.specialNotes ?? null, indication: p.indication ?? null,
  dispensing_units_per_package: p.dispensing?.unitsPerPackage ?? null, dispensing_total_quantity_dispensed: p.dispensing?.totalQuantityDispensed ?? null,
  dispensing_dispense_date: p.dispensing?.dispenseDate ?? null, dispensing_brand_actually_dispensed: p.dispensing?.brandActuallyDispensed ?? null,
  needs_review: p.needsReview, field_review_status: p.fieldReviewStatus ?? null, field_reviewed_by: p.fieldReviewedBy ?? null,
  field_reviewed_at: p.fieldReviewedAt ?? null, field_review_note: p.fieldReviewNote ?? null, status: p.status,
  discontinued_reason: p.discontinuedReason ?? null, discontinued_at: p.discontinuedAt ?? null,
});
const md5 = (rows: Row[]) => createHash('md5').update(rows.map((r) => JSON.stringify(r)).join('\n')).digest('hex');

/** Exactly what lib/data/pg/reads-rx.ts does with the rows. */
const one = (rows: Row[]) => (rows[0] ? toPrescription(rows[0]) : prescriptionRefusal());
const days = (rows: Row[]) => (rows.length === 0 ? dosesWithPrescriptionRefusal() : rows.map(toDoseWithPrescription));
const history = (rows: Row[]) => (rows.length === 0 ? doseHistoryRefusal() : rows.map(toDose));

const SESS: Record<string, Session | null> = {
  none: null,
  hamad: { subjectId: 'pt-01', role: 'patient' },
  fatima: { subjectId: 'pt-02', role: 'patient' },
  sara: { subjectId: 'pt-03', role: 'patient' },
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' },
  dana: { subjectId: 'acc-11', role: 'admin' },
  naserPending: { subjectId: 'cg-03', pendingInvitationOnly: true },
  ...Object.fromEntries(['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07'].map((id) => [id, { subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' } as Session])),
};
async function mockAs<T>(who: string, fn: () => Promise<T>): Promise<T> {
  setScriptSession(SESS[who] ?? null);
  return fn();
}
const created = (v: unknown, key: 'id' | 'draftId') => str({ ...(v as object), [key]: '<created>' });

beforeEach(() => reset());

describe('WP3a round trip — MCP rows through the seam literal, string-equal to tests/fixtures/shapes.json', () => {
  it('getPrescription(rx-001)', () => {
    expect(str(one([RX_001]))).toBe(str(fixture['getPrescription(rx-001)']));
  });
  it('getDosesForDay(pt-01, 2026-09-21) — dose keys, then drug, then dosePerAdministration; no strengthUnit when not stored', () => {
    expect(str(days(HAMAD_DAY))).toBe(str(fixture['getDosesForDay(pt-01, 2026-09-21)']));
  });
  it('getPrescriptions(pt-01) — the database returned exactly the fixture\'s rows (md5), and they project to its exact string', () => {
    const want = fixture['getPrescriptions(pt-01)'] as Prescription[];
    const rows = want.map(rxRow);
    expect({ md5: md5(rows), n: rows.length }).toEqual(DB_MD5['getPrescriptions(pt-01)']);
    expect(str(rows.map((r) => toPrescription(r)))).toBe(str(want));
  });
  for (const [key, rowOf, project] of [
    ['getDoseHistory(rx-008)', doseRow, history],
    ['getRecentDoses(pt-03, 7)', dwpRow, days],
  ] as const) {
    it(`${key} — the database returned exactly the fixture's rows (md5), and they project to its exact string`, () => {
      const want = fixture[key] as (Dose & DoseWithPrescription)[];
      const rows = want.map((d) => (rowOf as (d: Dose & DoseWithPrescription) => Row)(d));
      expect({ md5: md5(rows), n: rows.length }).toEqual(DB_MD5[key]);
      expect(str((project as (r: Row[]) => unknown)(rows))).toBe(str(want));
    });
  }
  it('getRecentDoses carries strengthUnit only for rx-008 (mcg, the number never converted)', () => {
    const want = fixture['getRecentDoses(pt-03, 7)'] as DoseWithPrescription[];
    expect(new Set(want.filter((d) => 'strengthUnit' in d.drug).map((d) => d.prescriptionId))).toEqual(new Set(['rx-008']));
    expect(want.find((d) => d.prescriptionId === 'rx-008')?.drug.strengthMg).toBe(50);
  });
  it('savePrescriptionDraft(pt-01) — the re-selected row, id opaque (CR-041), every other byte equal', () => {
    const got = toPrescription(SAVED_ROW);
    expect(typeof got.id).toBe('string');
    expect(created(got, 'id')).toBe(created(fixture['savePrescriptionDraft(pt-01)'], 'id'));
  });
  it('submitPrescriptionImage(pt-01) — the CR-049 provider literal, draftId opaque', () => {
    const got = { kind: 'confident', draftId: 'draft_X', prescription: confidentDraft(REFERENCE_DATE) };
    expect(created(got, 'draftId')).toBe(created(fixture['submitPrescriptionImage(pt-01)'], 'draftId'));
  });
});

describe('WP3a — the pg literals and the mock produce the same bytes (they cannot drift)', () => {
  it('needs_review (1–99 bytes): same draft, same uncertainFields', async () => {
    const m = await mockAs('fatima', () => mock.submitPrescriptionImage('pt-02', new Blob([new Uint8Array(50)])));
    const pg = { kind: 'needs_review', draftId: 'x', prescription: needsReviewDraft(), uncertainFields: [...NEEDS_REVIEW_UNCERTAIN_FIELDS] };
    expect(created(pg, 'draftId')).toBe(created(m, 'draftId'));
  });
  it('confident (≥100 bytes): same draft', async () => {
    const m = await mockAs('hamad', () => mock.submitPrescriptionImage('pt-01', new Blob([new Uint8Array(500)])));
    expect(created({ kind: 'confident', draftId: 'x', prescription: confidentDraft(REFERENCE_DATE) }, 'draftId')).toBe(created(m, 'draftId'));
  });
  it('prescriptionFromDraft reproduces the mock save — confident and needs_review drafts', async () => {
    for (const [who, pid, bytes] of [['hamad', 'pt-01', 500], ['fatima', 'pt-02', 50]] as const) {
      reset();
      const out = await mockAs(who, () => mock.submitPrescriptionImage(pid, new Blob([new Uint8Array(bytes)])));
      if (!('draftId' in out)) throw new Error('no draft');
      const saved = await mockAs(who, () => mock.savePrescriptionDraft(pid, out.draftId));
      expect(created(prescriptionFromDraft('x', pid, out.prescription), 'id')).toBe(created(saved, 'id'));
    }
  });
  it('draftSaveRefusal = the mock\'s no-draft skeleton with id "" — and the refusal itself writes nothing', async () => {
    const before = (await mockAs('hamad', () => mock.getPrescriptions('pt-01'))).length;
    const refusal = draftSaveRefusal('pt-01');
    expect(refusal.id).toBe('');
    const fabricated = await mockAs('hamad', () => mock.savePrescriptionDraft('pt-01', 'draft-does-not-exist')); // D-014: the mock SAVES it
    expect(created(refusal, 'id')).toBe(created(fabricated, 'id'));
    expect((await mockAs('hamad', () => mock.getPrescriptions('pt-01'))).length).toBe(before + 1); // the mock's divergence, D-2
  });
  it('the read refusal literals are the mock\'s refusals (forbidden and missing alike)', async () => {
    for (const who of ['none', 'cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07', 'naserPending', 'dana', 'fatima']) {
      expect(str(await mockAs(who, () => mock.getPrescriptions('pt-01')))).toBe(str(prescriptionsRefusal()));
      expect(str(await mockAs(who, () => mock.getPrescription('rx-001')))).toBe(str(prescriptionRefusal()));
      expect(str(await mockAs(who, () => mock.getDosesForDay('pt-01', '2026-09-21')))).toBe(str(dosesWithPrescriptionRefusal()));
      expect(str(await mockAs(who, () => mock.getDoseHistory('rx-001')))).toBe(str(doseHistoryRefusal()));
      expect(str(await mockAs(who, () => mock.getRecentDoses('pt-01', 7)))).toBe(str(dosesWithPrescriptionRefusal()));
    }
    // E-49: a wrong-patient id and a missing id are the same null.
    expect(str(await mockAs('hamad', () => mock.getPrescription('rx-006')))).toBe(str(await mockAs('hamad', () => mock.getPrescription('rx-999'))));
    for (const who of ['none', 'abdullah', 'fatima', 'dana']) {
      expect(str(await mockAs(who, () => mock.submitPrescriptionImage('pt-01', new Blob([new Uint8Array(500)]))))).toBe(str(extractionRefusal()));
    }
  });
  it('an active caregiver reads exactly the patient\'s bytes (E-31, mock reference)', async () => {
    const asPatient = str(await mockAs('hamad', () => mock.getDosesForDay('pt-01', '2026-09-21')));
    expect(str(await mockAs('abdullah', () => mock.getDosesForDay('pt-01', '2026-09-21')))).toBe(asPatient);
  });
  it('no Civil ID in any WP3a shape', () => {
    const all = [one([RX_001]), days(HAMAD_DAY), toPrescription(SAVED_ROW), confidentDraft(REFERENCE_DATE), needsReviewDraft(), draftSaveRefusal('pt-01')];
    expect(str(all)).not.toMatch(/\d{12}/);
  });
});

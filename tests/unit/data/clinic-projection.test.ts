/**
 * P2-WP3b — the Postgres projection for alerts and the clinic reads, proved WITHOUT a database
 * (this file runs in `npm run verify`, mock backend). The row literals below are the rows the exact
 * `PG_QUERIES_CLINIC` text returned through the Supabase MCP connector, run as `jurah_app` under
 * each seeded session (docs/backend-notes/p2-wp3b.md §3 has the SQL and the raw output; NULL
 * columns are omitted, which the projections treat exactly like null). They go through the SAME
 * functions lib/data/pg/reads-clinic.ts uses, and the result is compared with
 * tests/fixtures/shapes.json AS A STRING — key order included (BACKEND-PLAN §6), never deep-equal.
 * The refusal literals are then checked against what the mock itself returns.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { toAlert, toFieldQueueItem, toReviewQueueItem } from '@/lib/data/shapes/reads-clinic';
import { toPrescription } from '@/lib/data/shapes/reads-rx';
import {
  alertRefusal,
  alertReviewRefusal,
  alertsRefusal,
  drugCheckRefusal,
  fieldQueueRefusal,
  flaggedPrescriptionRefusal,
  reviewQueueRefusal,
} from '@/lib/data/refusals/reads-clinic';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import * as mock from '@/lib/data/mock-impl';
import type { Session } from '@/types/views';

const fixture = shapes as unknown as Record<string, unknown>;
const same = (got: unknown, key: string) => expect(JSON.stringify(got)).toBe(JSON.stringify(fixture[key]));

const IA_001 = {
  id: 'ia-001', patient_id: 'pt-01', involved_prescription_ids: ['rx-001', 'rx-002'], severity: 'danger',
  description: 'أخذ الوارفارين مع الإيبوبروفين يرفع خطر النزيف.', source_citation: '[TO BE SUPPLIED]',
  created_at: '2026-09-19T11:04:00+03:00', review_status: 'pending_medical_review',
  reviewer_decision: null, reviewer_note: null, reviewed_at: null, reviewed_by: null,
};

describe('WP3b projections — database rows → the fixture bytes', () => {
  it('getAlerts(pt-01) / getAlert(ia-001) — InteractionAlert, optional review fields dropped when null', () => {
    same([toAlert(IA_001)], 'getAlerts(pt-01)');
    same(toAlert(IA_001), 'getAlert(ia-001)');
  });

  it('a reviewed alert keeps the four review fields in the seed order (ia-002)', () => {
    const r = toAlert({ ...IA_001, id: 'ia-002', review_status: 'reviewed', reviewer_decision: 'confirmed', reviewer_note: 'n', reviewed_at: '2026-09-08T12:40:00+03:00', reviewed_by: 'acc-10' });
    expect(Object.keys(r)).toEqual(['id', 'patientId', 'involvedPrescriptionIds', 'severity', 'description', 'sourceCitation', 'createdAt', 'reviewStatus', 'reviewerDecision', 'reviewerNote', 'reviewedAt', 'reviewedBy']);
  });

  it('getReviewQueue — the row the SQL returned (waited_minutes 2771 from jurah_now())', () => {
    same([toReviewQueueItem({ alert_id: 'ia-001', patient_id: 'pt-01', patient_first_name: 'حمد', severity: 'danger', drug_names: ['Warfarin', 'Ibuprofen'], created_at: '2026-09-19T11:04:00+03:00', waited_minutes: 2771 })], 'getReviewQueue (as د. خالد)');
  });

  it('getFieldConfirmationQueue — strengthMg always listed (the mock’s bug, reproduced; CR in the fragment), the rest from null columns', () => {
    const rows = [
      { prescription_id: 'rx-006', patient_id: 'pt-02', patient_first_name: 'فاطمة', generic_name: '(unreadable)', has_source_image: true, field_review_status: 'pending' },
      { prescription_id: 'rx-007', patient_id: 'pt-02', patient_first_name: 'فاطمة', generic_name: 'Ciprofloxacin', frequency_per_day: 2, dose_times: ['09:00', '21:00'], has_source_image: true, field_review_status: 'returned' },
    ];
    same(rows.map(toFieldQueueItem), 'getFieldConfirmationQueue (as د. خالد)');
  });

  it('getFlaggedPrescription(rx-006) — through WP3a’s toPrescription', () => {
    same(toPrescription({ id: 'rx-006', patient_id: 'pt-02', facility_name: 'عيادة الياسمين', sector: 'private', generic_name: '(unreadable)', dose_per_administration: 1, duration_days: 30, dosing_pattern: 'daily', needs_review: true, field_review_status: 'pending', status: 'active' }), 'getFlaggedPrescription(rx-006, as د. خالد)');
  });
});

describe('WP3b refusal literals — the same bytes the mock returns (D-022, BACKEND-DIVERGENCES D-3)', () => {
  beforeEach(() => reset());
  const as = async <T,>(s: Session | null, fn: () => Promise<T>) => { setScriptSession(s); return JSON.stringify(await fn()); };
  const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
  const DANA: Session = { subjectId: 'acc-11', role: 'admin' };

  it('each literal equals the mock’s own refusal for a refused caller', async () => {
    expect(await as(DANA, () => mock.getAlerts('pt-01'))).toBe(JSON.stringify(alertsRefusal()));
    expect(await as(DANA, () => mock.getAlert('ia-001'))).toBe(JSON.stringify(alertRefusal()));
    expect(await as(DANA, () => mock.checkDrugPhoto('pt-01', new Blob([new Uint8Array(500)])))).toBe(JSON.stringify(drugCheckRefusal()));
    expect(await as(HAMAD, () => mock.getReviewQueue())).toBe(JSON.stringify(reviewQueueRefusal()));
    expect(await as(HAMAD, () => mock.getFieldConfirmationQueue())).toBe(JSON.stringify(fieldQueueRefusal()));
    expect(await as(HAMAD, () => mock.getAlertForReview('ia-001'))).toBe(JSON.stringify(alertReviewRefusal('ia-001')));
    expect(await as(HAMAD, () => mock.getFlaggedPrescription('rx-006'))).toBe(JSON.stringify(flaggedPrescriptionRefusal()));
  });

  it('alertReviewRefusal echoes the requested id and returns a fresh object each call', () => {
    const a = alertReviewRefusal('ia-002');
    expect(a.alert.id).toBe('ia-002');
    a.involvedPrescriptions.push({} as never);
    expect(alertReviewRefusal('ia-002').involvedPrescriptions).toEqual([]);
  });
});

/**
 * G3s's confirm path, against the PUBLIC seam (`@/lib/data`), isolated with a freshly `reset()`
 * store so it does not depend on — or interfere with — the e2e suite's shared dev-server store
 * (same reasoning as `tests/unit/caregiving/acceptMovesToActive.test.ts`; `tests/e2e/clinic.spec.ts`
 * proves the "return" path against the live UI instead, since only one seed record can prove each
 * side of the fork). `rx-006` is the seed's one `pending` field-confirmation item ("Doses" section:
 * neither `frequencyPerDay` nor `doseTimes` present, which is exactly why it is flagged).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { confirmPrescriptionFields, getPrescription } from '@/lib/data';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'acc-10', role: 'reviewer' }); // د. خالد
});

describe('confirmPrescriptionFields (public seam) — rx-006, pending → confirmed', () => {
  it('clears needsReview, sets fieldReviewStatus confirmed, and writes the given values', async () => {
    const rx = await confirmPrescriptionFields(
      'rx-006',
      { drug: { genericName: '(unreadable)', strengthMg: 250 }, frequencyPerDay: 2, startDate: '2026-09-17', doseTimes: ['08:00', '20:00'] },
      'تم فتح الصورة وتأكيد القيم يدويًا',
    );
    expect(rx.needsReview).toBe(false);
    expect(rx.fieldReviewStatus).toBe('confirmed');
    expect(rx.fieldReviewedBy).toBe('acc-10');
    expect(rx.frequencyPerDay).toBe(2);
    expect(rx.doseTimes).toEqual(['08:00', '20:00']);
  });

  it('the change is visible through getPrescription afterwards (the published read, not just the mutation’s own return value)', async () => {
    await confirmPrescriptionFields('rx-006', { drug: { genericName: '(unreadable)', strengthMg: 250 }, frequencyPerDay: 2, startDate: '2026-09-17', doseTimes: ['08:00', '20:00'] });
    const rx = await getPrescription('rx-006');
    expect(rx?.needsReview).toBe(false);
    expect(rx?.fieldReviewStatus).toBe('confirmed');
  });

  it('a non-reviewer session cannot confirm it', async () => {
    setScriptSession({ subjectId: 'pt-02', role: 'patient' });
    const before = await getPrescription('rx-006');
    await confirmPrescriptionFields('rx-006', { frequencyPerDay: 2, startDate: '2026-09-17', doseTimes: ['08:00', '20:00'] });
    const after = await getPrescription('rx-006');
    expect(after?.needsReview).toBe(before?.needsReview);
    expect(after?.fieldReviewStatus).toBe(before?.fieldReviewStatus);
  });
});

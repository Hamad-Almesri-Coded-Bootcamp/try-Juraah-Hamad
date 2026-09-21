/**
 * F3 parity fixes (wave-1 gate follow-ups):
 *  - bundle e's C2 gate review: CaregiverAlertDetail must render the `reviewed` state's decision,
 *    reviewer label and note (previously only the danger/pending three-part shape and citation).
 *  - bundle d's B3 gate review: CaregiverPrescriptionDetail must render `doseTimes` as a field.
 * Both mirror their bundle's reference component's content, composed independently (this bundle's
 * own files only), and both stay read-only — no control anywhere.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CaregiverAlertDetail } from '@/features/caregiving/CaregiverAlertDetail';
import { CaregiverPrescriptionDetail } from '@/features/caregiving/CaregiverPrescriptionDetail';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import { REFERENCE_NOW } from '@/lib/config';
import type { Caregiver } from '@/types/contracts';

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => reset());

describe('CaregiverAlertDetail — reviewed state renders the decision block (parity with C2)', () => {
  it('ia-002 (سارة, reviewed/confirmed): decision, reviewer label and note all render; no control exists', async () => {
    // No seeded caregiver links to سارة (pt-03) as a patient — a synthetic, test-only active row
    // grants a caregiver session read access to her alert for this test alone (reset() in
    // beforeEach discards it before the next test).
    const testCaregiver: Caregiver = {
      id: 'cg-test-sara',
      civilId: '000000000000',
      name: 'Test caregiver',
      relationship: 'test',
      linkedPatientId: 'pt-03',
      status: 'active',
      invitedAt: REFERENCE_NOW,
      expiresAt: REFERENCE_NOW,
      accessLevel: 'read_only',
    };
    getStore().caregivers.push(testCaregiver);
    setScriptSession({ subjectId: 'cg-test-sara', role: 'caregiver', linkedPatientId: 'pt-03' });

    const element = await CaregiverAlertDetail({ alertId: 'ia-002', locale: 'ar' });
    const { container } = render(element);

    expect(container.textContent).toContain('الخطر مؤكد'); // reviewerDecision: 'confirmed'
    expect(container.textContent).toContain('مراجع طبي'); // the fixed "who" label — never an id/name
    expect(container.textContent).toContain('تُؤخذ اللِفوثيروكسين'); // the seed's own reviewerNote, verbatim
    expect(container.querySelectorAll('button').length).toBe(0); // read-only — no control anywhere

    // Involved prescriptions (parity round 2): ia-002 involves rx-008 (Levothyroxine) and rx-009
    // (Calcium carbonate + D3) — both render as cards, each a navigation-only link into this
    // bundle's own /care/medicines/[id] route, never a button and never any other control.
    expect(container.textContent).toContain('الوصفات المعنية');
    expect(container.textContent).toContain('Levothyroxine');
    expect(container.textContent).toContain('Calcium carbonate');
    const links = [...container.querySelectorAll('a')].filter((a) => a.getAttribute('href')?.includes('/care/medicines/'));
    expect(links.map((a) => a.getAttribute('href')).sort()).toEqual(['/ar/care/medicines/rx-008', '/ar/care/medicines/rx-009']);
  });

  it('ia-001 (حمد, pending_medical_review): no decision block renders — only the pending three-part shape', async () => {
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    const element = await CaregiverAlertDetail({ alertId: 'ia-001', locale: 'ar' });
    const { container } = render(element);
    expect(container.textContent).not.toContain('قرار المراجع');
    expect(container.textContent).not.toContain('الخطر مؤكد');

    // Citation honesty (parity round 2): ia-001's sourceCitation is the seed's own TO_BE_SUPPLIED
    // marker — the raw marker string must never reach the rendered output, only the explicit
    // "unverified / pending" sentence.
    expect(container.textContent).not.toContain('TO BE SUPPLIED');
    expect(container.textContent).toContain('ما توفر مصدر طبي مؤكد لهذا التنبيه بعد');
  });
});

describe('CaregiverPrescriptionDetail — doseTimes renders as a field (parity with B3)', () => {
  it('rx-002 (Ibuprofen, 08:00/14:00/20:00): every dose time appears, read-only', async () => {
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    const element = await CaregiverPrescriptionDetail({ prescriptionId: 'rx-002', locale: 'ar' });
    const { container } = render(element);
    // 'ar' locale renders Arabic-Indic digits (i18n/format.ts) — rx-002's three doseTimes joined.
    expect(container.textContent).toContain('مواعيد الجرعات٨:٠٠ · ١٤:٠٠ · ٢٠:٠٠');
    expect(container.querySelectorAll('button').length).toBe(0);
  });

  it('rx-006 (unread/flagged, no doseTimes): the row still renders, with the empty mark — never "undefined"', async () => {
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    // rx-006 belongs to فاطمة (pt-02); عبدالله's caregiver row is linked to حمد only, so read this
    // one as حمد himself would not apply — use the same synthetic-access technique as above, scoped
    // to فاطمة, to reach a genuinely fieldless record without inventing one.
    const testCaregiver: Caregiver = {
      id: 'cg-test-fatima',
      civilId: '000000000001',
      name: 'Test caregiver',
      relationship: 'test',
      linkedPatientId: 'pt-02',
      status: 'active',
      invitedAt: REFERENCE_NOW,
      expiresAt: REFERENCE_NOW,
      accessLevel: 'read_only',
    };
    getStore().caregivers.push(testCaregiver);
    setScriptSession({ subjectId: 'cg-test-fatima', role: 'caregiver', linkedPatientId: 'pt-02' });

    const element = await CaregiverPrescriptionDetail({ prescriptionId: 'rx-006', locale: 'ar' });
    const { container } = render(element);
    expect(container.textContent).toContain('مواعيد الجرعات');
    expect(container.textContent).not.toContain('undefined');
  });
});

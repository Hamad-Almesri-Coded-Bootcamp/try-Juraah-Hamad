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
import { copy, t } from '@/i18n';
import { localizeDrugName } from '@/i18n/localize';
import { AlertDetail } from '@/features/safety/AlertDetail';
import { getAlert, getPrescription } from '@/lib/data';
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

    // Daylight (CR-071): F3 renders C2's own AlertDetail, so every line is C2's catalogue wording.
    expect(container.textContent).toContain(t(copy.safety.c2ReviewHeading, 'ar'));
    expect(container.textContent).toContain(t(copy.safety.c2DecisionConfirmed, 'ar')); // reviewerDecision: 'confirmed'
    expect(container.textContent).toContain(t(copy.safety.c2ReviewerValue, 'ar')); // the fixed "who" label, never an id/name
    expect(container.textContent).not.toContain('acc-'); // no raw reviewedBy Account id
    expect(container.textContent).toContain('تُؤخذ اللِفوثيروكسين'); // the seed's own reviewerNote, verbatim in Arabic
    expect(container.querySelectorAll('button').length).toBe(0); // read-only: no control anywhere

    // Involved prescriptions: ia-002 involves rx-008 (Levothyroxine) and rx-009 (Calcium carbonate
    // + D3). Both render in the bridge, named in the reader's language, each a navigation-only link
    // into this shell's own /care/medicines/[id] route, never a button and never any other control.
    const bridge = container.querySelector('[data-testid="alert-bridge"]')!;
    expect(bridge.getAttribute('aria-label')).toBe(t(copy.safety.c2InvolvedHeading, 'ar'));
    for (const id of ['rx-008', 'rx-009']) {
      const generic = getStore().prescriptions.find((p) => p.id === id)!.drug.genericName;
      expect(bridge.textContent).toContain(localizeDrugName(generic, 'ar'));
    }
    expect(bridge.textContent).not.toMatch(/[A-Za-z]/); // one language per locale (CR-071)
    const links = [...container.querySelectorAll('a')].filter((a) => a.getAttribute('href')?.includes('/care/medicines/'));
    expect(links.map((a) => a.getAttribute('href')).sort()).toEqual(['/ar/care/medicines/rx-008', '/ar/care/medicines/rx-009']);
    // Nothing links into the patient's own shell.
    expect(container.querySelector('a[href*="/app/"]')).toBeNull();
  });

  it('ia-001 (حمد, pending_medical_review): no decision block renders — only the pending three-part shape', async () => {
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    const element = await CaregiverAlertDetail({ alertId: 'ia-001', locale: 'ar' });
    const { container } = render(element);
    expect(container.textContent).not.toContain(t(copy.safety.c2ReviewHeading, 'ar'));
    expect(container.textContent).not.toContain(t(copy.safety.c2DecisionConfirmed, 'ar'));
    expect(container.querySelector('[data-testid="alert-decision"]')).toBeNull();
    // §8's order for a pending danger finding: the risk, what to do now, who is checking it.
    expect(container.textContent).toContain(t(copy.safety.c2WhatToDoHeading, 'ar'));
    expect(container.querySelectorAll('button').length).toBe(0);

    // Citation honesty: ia-001's sourceCitation is the seed's own TO_BE_SUPPLIED marker. The raw
    // marker string must never reach the rendered output, only the explicit "unverified" sentence.
    expect(container.textContent).not.toContain('TO BE SUPPLIED');
    expect(container.textContent).toContain(t(copy.safety.c2SourceUnverified, 'ar'));
  });

  it('ia-001: opening the alert never changes it (no review state, no decision, no timestamp written)', async () => {
    const before = structuredClone(getStore().alerts.find((a) => a.id === 'ia-001'));
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    render(await CaregiverAlertDetail({ alertId: 'ia-001', locale: 'en' }));
    expect(getStore().alerts.find((a) => a.id === 'ia-001')).toEqual(before);
  });

  it('ia-001, both languages: the caregiver reads exactly what the patient reads on C2 (never more)', async () => {
    for (const locale of ['ar', 'en'] as const) {
      setScriptSession({ subjectId: 'pt-01', role: 'patient' });
      const alert = (await getAlert('ia-001'))!;
      const prescriptions = (await Promise.all(alert.involvedPrescriptionIds.map((id) => getPrescription(id)))).filter((p) => p != null);
      const patient = render(<AlertDetail alert={alert} prescriptions={prescriptions} locale={locale} />);
      const patientText = patient.container.textContent;
      cleanup();

      setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
      const caregiver = render(await CaregiverAlertDetail({ alertId: 'ia-001', locale }));
      // Identical to the patient's C2, never more (rule 8, UX §10). The only difference allowed is
      // voice: the three lines that say "your" are read about someone else's record (CR-071), each
      // swapped for its caregiver twin from the catalogue, word for word.
      const voiced = [
        [copy.safety.c2WhatToDoPendingBody, copy.safety.c2WhatToDoPendingBodyCaregiver],
        [copy.safety.c2BridgeMixedPair, copy.safety.c2BridgeMixedPairCaregiver],
        [copy.safety.c2BridgeTogether, copy.safety.c2BridgeTogetherCaregiver],
      ] as const;
      const expected = voiced.reduce((text, [mine, theirs]) => text!.replace(mine[locale], theirs[locale]), patientText);
      expect(expected).not.toBe(patientText); // the swap happened: this finding has a caregiver line
      expect(caregiver.container.textContent).toBe(expected);
      cleanup();
    }
  });
});

describe('CaregiverPrescriptionDetail — doseTimes renders as a field (parity with B3)', () => {
  it('rx-002 (Ibuprofen, 08:00/14:00/20:00): every dose time appears, read-only', async () => {
    setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    const element = await CaregiverPrescriptionDetail({ prescriptionId: 'rx-002', locale: 'ar' });
    const { container } = render(element);
    // 'ar' locale renders Arabic-Indic digits (i18n/format.ts) — rx-002's three doseTimes joined.
    // Same label as B3 now (audit M10: F3 is B3 minus actions).
    expect(container.textContent).toContain('أوقات الجرعة٨:٠٠ · ١٤:٠٠ · ٢٠:٠٠');
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
    expect(container.textContent).toContain('أوقات الجرعة');
    expect(container.textContent).not.toContain('undefined');
  });
});

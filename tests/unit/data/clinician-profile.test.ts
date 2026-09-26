/**
 * CR-115 — the data layer's side of the clinic dashboard and the required justification, against
 * the mock:
 * - `submitReviewDecision` refuses a missing, blank or whitespace-only note: the alert is unchanged
 *   and no `alert_reviewed` event is written; a real note is stored trimmed.
 * - `getClinicianProfile` returns the caller's own name, clinic roles and decision counts (from the
 *   seed, not invented), never a Civil ID, and `null` for any session that is not a reviewer or an
 *   admin holding that role. The Postgres projection maps the helper's jsonb to the same bytes.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';
import * as mock from '@/lib/data/mock-impl';
import { toClinicianProfile } from '@/lib/data/shapes/reads-clinic';
import { clinicianProfileRefusal } from '@/lib/data/refusals/reads-clinic';
import type { Session } from '@/types/views';

const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };
const KHALID_ADMIN: Session = { subjectId: 'acc-10', role: 'admin' };
const DANA: Session = { subjectId: 'acc-11', role: 'admin' };

beforeEach(() => {
  reset();
  setScriptSession(null);
});

const snapshot = () => {
  const store = getStore();
  return JSON.stringify({ alert: store.alerts.find((a) => a.id === 'ia-001'), events: store.auditEvents.length });
};

describe('submitReviewDecision — the justification is required (CR-115)', () => {
  for (const note of ['', '   ', '\n\t', undefined as unknown as string]) {
    it(`refuses ${JSON.stringify(note)}: no change, no audit event`, async () => {
      setScriptSession(KHALID);
      const before = snapshot();
      await expect(mock.submitReviewDecision('ia-001', 'confirmed', note)).resolves.toBeUndefined();
      expect(snapshot()).toBe(before);
      expect(getStore().alerts.find((a) => a.id === 'ia-001')?.reviewStatus).toBe('pending_medical_review');
    });
  }

  it('a real justification is recorded, trimmed, with its one audit event', async () => {
    setScriptSession(KHALID);
    const events = getStore().auditEvents.length;
    await mock.submitReviewDecision('ia-001', 'cleared', '  Stop ibuprofen; use paracetamol.  ');
    const alert = getStore().alerts.find((a) => a.id === 'ia-001')!;
    expect(alert.reviewStatus).toBe('reviewed');
    expect(alert.reviewerDecision).toBe('cleared');
    expect(alert.reviewerNote).toBe('Stop ibuprofen; use paracetamol.');
    expect(getStore().auditEvents.length).toBe(events + 1);
  });
});

describe('getClinicianProfile (CR-115)', () => {
  it('the reviewer: own name, both clinic roles, the seed’s decisions (ia-002, rx-009, rx-007)', async () => {
    setScriptSession(KHALID);
    expect(await mock.getClinicianProfile()).toEqual({
      name: 'د. خالد عبدالرحمن الرشيد',
      roles: ['reviewer', 'admin'],
      decisions: { confirmed: 1, cleared: 0, fieldsConfirmed: 1, fieldsReturned: 1 },
    });
  });

  it('the same account as admin gets the same profile', async () => {
    setScriptSession(KHALID_ADMIN);
    expect((await mock.getClinicianProfile())?.name).toBe('د. خالد عبدالرحمن الرشيد');
  });

  it('the admin-only account: own name, admin only, no decisions', async () => {
    setScriptSession(DANA);
    expect(await mock.getClinicianProfile()).toEqual({
      name: 'م. دانة فهد السالم',
      roles: ['admin'],
      decisions: { confirmed: 0, cleared: 0, fieldsConfirmed: 0, fieldsReturned: 0 },
    });
  });

  it('a decision the reviewer records shows in their own count', async () => {
    setScriptSession(KHALID);
    await mock.submitReviewDecision('ia-001', 'confirmed', 'The risk is real.');
    expect((await mock.getClinicianProfile())?.decisions.confirmed).toBe(2);
  });

  it('never carries a Civil ID', async () => {
    for (const s of [KHALID, DANA]) {
      setScriptSession(s);
      const json = JSON.stringify(await mock.getClinicianProfile());
      expect(json).not.toMatch(/\d{12}/);
      expect(json).not.toMatch(/civil/i);
    }
  });

  it('refuses every other session with null', async () => {
    const others: Array<Session | null> = [
      null,
      { subjectId: 'pt-01', role: 'patient' },
      { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' },
      { subjectId: 'acc-11', role: 'reviewer' }, // Dana holds no reviewer role
    ];
    for (const s of others) {
      setScriptSession(s);
      expect(await mock.getClinicianProfile()).toEqual(clinicianProfileRefusal());
    }
  });

  it('the Postgres projection gives the mock’s bytes, key order included', async () => {
    setScriptSession(KHALID);
    const row = { decisions: { cleared: 0, confirmed: 1, fieldsReturned: 1, fieldsConfirmed: 1 }, roles: ['reviewer', 'admin'], name: 'د. خالد عبدالرحمن الرشيد' };
    expect(JSON.stringify(toClinicianProfile(row))).toBe(JSON.stringify(await mock.getClinicianProfile()));
  });
});

describe('personInitials (CR-115, the dashboard avatar)', () => {
  it('first and last name, the title and a leading article dropped', async () => {
    const { personInitials } = await import('@/i18n/localize');
    expect(personInitials('Dr. Khaled Abdulrahman Al-Rasheed')).toBe('K‌R');
    expect(personInitials('Eng. Dana Fahad Al-Salem')).toBe('D‌S');
    // Arabic: a zero-width non-joiner keeps the two letters from joining into a word
    expect(personInitials('د. خالد عبدالرحمن الرشيد')).toBe('خ‌ر');
    expect(personInitials('Khaled')).toBe('K');
    expect(personInitials('')).toBe('');
  });
});

/**
 * P2-WP3b refusal matrix — docs/ENFORCEMENT.md rows E-28, E-32, E-35 (read half), E-36 (read half)
 * and E-48, plus the E-21 / E-31 columns for this package's functions. Each test is titled by its
 * row id and asserts BOTH proofs D-022 asks for: the DB-level refusal (0 rows inside withSession()
 * as jurah_app, through the very PG_QUERIES_CLINIC text the seam runs) and the unchanged seam shape
 * the screen still receives (the mock's refusal literal, lib/data/refusals/reads-clinic.ts).
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { withSession } from '@/lib/db/withSession';
import { setScriptSession } from '@/lib/session/cookie';
import {
  PG_QUERIES_CLINIC,
  checkDrugPhoto,
  getAlert,
  getAlertForReview,
  getAlerts,
  getFieldConfirmationQueue,
  getFlaggedPrescription,
  getReviewQueue,
} from '@/lib/data/pg/reads-clinic';
import { alertReviewRefusal } from '@/lib/data/refusals/reads-clinic';
import type { Session } from '@/types/views';

const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const FATIMA: Session = { subjectId: 'pt-02', role: 'patient' };
const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };
const KHALID_AS_ADMIN: Session = { subjectId: 'acc-10', role: 'admin' };
const DANA: Session = { subjectId: 'acc-11', role: 'admin' };
const DANA_FORGED_REVIEWER: Session = { subjectId: 'acc-11', role: 'reviewer' };
const blob = (bytes: number) => new Blob([new Uint8Array(bytes)]);

/** Rows the seam's own query returns under `s` (inside withSession, as jurah_app). */
async function rows(s: Session | null, key: keyof typeof PG_QUERIES_CLINIC, params: string[] = []): Promise<number> {
  return withSession(s, async (sql) => (await sql.unsafe(PG_QUERIES_CLINIC[key], params)).length);
}
async function seam<T>(s: Session | null, fn: () => Promise<T>): Promise<T> {
  setScriptSession(s);
  return fn();
}
const EMPTY = (id: string) => JSON.stringify(alertReviewRefusal(id));

describe('E-28 — a patient session reaches no clinic-scoped data', () => {
  it('E-28 حمد: getReviewQueue() → [] (0 rows) although RLS alone would show him ia-001', async () => {
    // The control: RLS (alerts_select → can_read_patient) DOES admit حمد to his own pending alert,
    // which is why the clinic queries carry jurah_session_is('reviewer') themselves.
    const rlsAlone = await withSession(HAMAD, async (sql) => (await sql`select id from interaction_alerts where review_status = 'pending_medical_review'`).length);
    expect(rlsAlone).toBe(1);
    expect(await rows(HAMAD, 'getReviewQueue')).toBe(0);
    expect(await seam(HAMAD, () => getReviewQueue())).toEqual([]);
  });
  it("E-28 حمد: getAlertForReview('ia-001') → the empty AlertReviewView (0 rows), never his own context", async () => {
    expect(await rows(HAMAD, 'getAlertForReview', ['ia-001'])).toBe(0);
    expect(JSON.stringify(await seam(HAMAD, () => getAlertForReview('ia-001')))).toBe(EMPTY('ia-001'));
  });
  it('E-28 فاطمة: getFieldConfirmationQueue() → [] and getFlaggedPrescription(rx-006) → null, though rx-006 is her own row', async () => {
    const rlsAlone = await withSession(FATIMA, async (sql) => (await sql`select id from prescriptions where id = 'rx-006'`).length);
    expect(rlsAlone).toBe(1);
    expect(await rows(FATIMA, 'getFieldConfirmationQueue')).toBe(0);
    expect(await rows(FATIMA, 'getFlaggedPrescription', ['rx-006'])).toBe(0);
    expect(await seam(FATIMA, () => getFieldConfirmationQueue())).toEqual([]);
    expect(await seam(FATIMA, () => getFlaggedPrescription('rx-006'))).toBeNull();
  });
  it('E-28 عبدالله (active caregiver): every clinic read is empty', async () => {
    expect(await rows(ABDULLAH, 'getReviewQueue')).toBe(0);
    expect(await rows(ABDULLAH, 'getAlertForReview', ['ia-001'])).toBe(0);
    expect(await seam(ABDULLAH, () => getReviewQueue())).toEqual([]);
    expect(await seam(ABDULLAH, () => getFieldConfirmationQueue())).toEqual([]);
    expect(JSON.stringify(await seam(ABDULLAH, () => getAlertForReview('ia-001')))).toBe(EMPTY('ia-001'));
  });
  it('E-28 (checkDrugPhoto is patient-self only) عبدالله: could_not_identify, and the SQL gate reads 0 rows though RLS shows him 3 active prescriptions', async () => {
    const rlsAlone = await withSession(ABDULLAH, async (sql) => (await sql`select id from prescriptions where patient_id = 'pt-01' and status = 'active'`).length);
    expect(rlsAlone).toBe(3);
    expect(await rows(ABDULLAH, 'checkDrugPhoto', ['pt-01'])).toBe(0);
    expect(await seam(ABDULLAH, () => checkDrugPhoto('pt-01', blob(500)))).toEqual({ kind: 'could_not_identify' });
    expect(await seam(FATIMA, () => checkDrugPhoto('pt-01', blob(500)))).toEqual({ kind: 'could_not_identify' });
    expect(await seam(HAMAD, () => checkDrugPhoto('pt-01', blob(0)))).toEqual({ kind: 'could_not_identify' });
  });
});

describe('E-32 — a reviewer reads only through a queue item', () => {
  it("E-32 د. خالد: getAlertForReview('ia-002') (سارة, already reviewed) → the empty view (D-014 · D-4)", async () => {
    expect(await rows(KHALID, 'getAlertForReview', ['ia-002'])).toBe(0);
    expect(JSON.stringify(await seam(KHALID, () => getAlertForReview('ia-002')))).toBe(EMPTY('ia-002'));
    expect(JSON.stringify(await seam(KHALID, () => getAlertForReview('ia-999')))).toBe(EMPTY('ia-999'));
  });
  it("E-32 د. خالد: getFlaggedPrescription('rx-001') (not flagged) → null, although he can read rx-001 through pt-01's queue item", async () => {
    const visible = await withSession(KHALID, async (sql) => (await sql`select id from prescriptions where id = 'rx-001'`).length);
    expect(visible).toBe(1);
    expect(await rows(KHALID, 'getFlaggedPrescription', ['rx-001'])).toBe(0);
    expect(await seam(KHALID, () => getFlaggedPrescription('rx-001'))).toBeNull();
  });
  it("E-32 د. خالد: getAlerts('pt-03') / getAlert('ia-002') (no queue item for سارة) → [] / null", async () => {
    expect(await rows(KHALID, 'getAlerts', ['pt-03'])).toBe(0);
    expect(await seam(KHALID, () => getAlerts('pt-03'))).toEqual([]);
    expect(await seam(KHALID, () => getAlert('ia-002'))).toBeNull();
  });
});

describe('E-35 / E-36 (read halves) — the admin reads no clinical record and no queue', () => {
  it("E-35 م. دانة: getAlert('ia-001') → null, getAlerts('pt-01') → [] (0 rows of interaction_alerts at all)", async () => {
    const any = await withSession(DANA, async (sql) => (await sql`select id from interaction_alerts`).length);
    expect(any).toBe(0);
    expect(await seam(DANA, () => getAlert('ia-001'))).toBeNull();
    expect(await seam(DANA, () => getAlerts('pt-01'))).toEqual([]);
    expect(JSON.stringify(await seam(DANA, () => getAlertForReview('ia-001')))).toBe(EMPTY('ia-001'));
  });
  it('E-36 م. دانة (admin only): getReviewQueue() → [] and getFieldConfirmationQueue() → []', async () => {
    expect(await rows(DANA, 'getReviewQueue')).toBe(0);
    expect(await rows(DANA, 'getFieldConfirmationQueue')).toBe(0);
    expect(await seam(DANA, () => getReviewQueue())).toEqual([]);
    expect(await seam(DANA, () => getFieldConfirmationQueue())).toEqual([]);
  });
  it('E-36 a forged {role:reviewer} for an account without that assigned role (م. دانة) reads no queue; د. خالد under his admin role neither', async () => {
    expect(await rows(DANA_FORGED_REVIEWER, 'getReviewQueue')).toBe(0);
    expect(await rows(KHALID_AS_ADMIN, 'getReviewQueue')).toBe(0);
    expect(await seam(DANA_FORGED_REVIEWER, () => getReviewQueue())).toEqual([]);
  });
});

describe('E-21 / E-31 columns for this package', () => {
  it('E-21 cg-03 … cg-07 (pending, declined, expired, revoked ×2): getAlerts / getAlert / checkDrugPhoto read nothing of حمد', async () => {
    for (const id of ['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07']) {
      const s: Session = { subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' };
      expect(await rows(s, 'getAlerts', ['pt-01']), id).toBe(0);
      expect(await rows(s, 'getAlert', ['ia-001']), id).toBe(0);
      expect(await seam(s, () => getAlerts('pt-01')), id).toEqual([]);
      expect(await seam(s, () => getAlert('ia-001')), id).toBeNull();
      expect(await seam(s, () => checkDrugPhoto('pt-01', blob(500))), id).toEqual({ kind: 'could_not_identify' });
    }
  });
  it("E-31 getAlert('ia-001') and getAlerts('pt-01'): عبدالله's bytes equal حمد's", async () => {
    expect(JSON.stringify(await seam(ABDULLAH, () => getAlert('ia-001')))).toBe(JSON.stringify(await seam(HAMAD, () => getAlert('ia-001'))));
    expect(JSON.stringify(await seam(ABDULLAH, () => getAlerts('pt-01')))).toBe(JSON.stringify(await seam(HAMAD, () => getAlerts('pt-01'))));
  });
});

describe('E-48 — reads never write', () => {
  it("E-48 getAlert('ia-001') twice: identical bodies; audit_events count, the alert row and review_status unchanged", async () => {
    const snap = async () => (await getSql()`
      select (select count(*)::int from audit_events) as audit,
             (select md5(row_to_json(a)::text) from interaction_alerts a where a.id = 'ia-001') as row_md5`)[0];
    const before = await snap();
    const a = JSON.stringify(await seam(HAMAD, () => getAlert('ia-001')));
    const b = JSON.stringify(await seam(HAMAD, () => getAlert('ia-001')));
    expect(a).toBe(b);
    expect(JSON.parse(a).reviewStatus).toBe('pending_medical_review');
    // Every other WP3b read, once each, as its reader — none may write either.
    await seam(HAMAD, () => getAlerts('pt-01'));
    await seam(HAMAD, () => checkDrugPhoto('pt-01', blob(500)));
    await seam(KHALID, () => getReviewQueue());
    await seam(KHALID, () => getFieldConfirmationQueue());
    await seam(KHALID, () => getAlertForReview('ia-001'));
    await seam(KHALID, () => getFlaggedPrescription('rx-006'));
    expect(await snap()).toEqual(before);
  });
});

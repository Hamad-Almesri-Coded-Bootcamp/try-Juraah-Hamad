/**
 * P2-WP3c enforcement — the ENFORCEMENT.md rows for getRefillOverview · getRefillRequests ·
 * getCalendarSubscription. Each test is titled by its row id. Every row carries BOTH proofs D-022
 * asks for: the DB-level refusal (the exact PG_QUERIES_SUPPLY text, run as jurah_app under the
 * forged session with the caller's own civil id resolved as withSession() resolves it → 0 rows)
 * and the unchanged seam shape (the real lib/data/pg function → the mock's refusal bytes).
 * Every refusal has a positive control, so no row can pass because the data it hides is absent.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import { getCalendarSubscription, getRefillOverview, getRefillRequests, PG_QUERIES_SUPPLY } from '@/lib/data/pg/reads-supply';
import { calendarSubscriptionRefusal, refillOverviewRefusal, refillRequestsRefusal } from '@/lib/data/refusals/reads-supply';
import { app, probe, SYSTEM, type As } from '../helpers';
import type { Session } from '@/types/views';

type Fn = keyof typeof PG_QUERIES_SUPPLY;
const SEAM = { getRefillOverview, getRefillRequests, getCalendarSubscription } as const;
const REFUSAL: Record<Fn, string> = {
  getRefillOverview: JSON.stringify(refillOverviewRefusal()),
  getRefillRequests: JSON.stringify(refillRequestsRefusal()),
  getCalendarSubscription: JSON.stringify(calendarSubscriptionRefusal()),
};
/** pt-01's refill data lives under pt-01; the only seeded calendar row is سارة's (pt-03). */
const TARGET: Record<Fn, string> = { getRefillOverview: 'pt-01', getRefillRequests: 'pt-01', getCalendarSubscription: 'pt-03' };
const FNS = Object.keys(SEAM) as Fn[];

async function seam(s: Session | null, fn: Fn, patientId: string): Promise<string> {
  setScriptSession(s);
  return JSON.stringify(await SEAM[fn](patientId));
}
/** The session GUC withSession() would set for `s` — civil id resolved by the owner, never typed. */
async function gucFor(s: Session): Promise<Record<string, unknown>> {
  const [row] = await getSql()`select civil_id_for_session(${s.subjectId}, ${s.role ?? null}::role_t, ${!!s.pendingInvitationOnly}) as c`;
  return JSON.parse(JSON.stringify({ ...s, civilId: row?.c ?? null })) as Record<string, unknown>;
}
async function dbRows(as: As, fn: Fn, patientId: string): Promise<number> {
  return probe(as, async (tx) => (await tx.unsafe(PG_QUERIES_SUPPLY[fn], [patientId])).length);
}

const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const FATIMA: Session = { subjectId: 'pt-02', role: 'patient' };
const SARA: Session = { subjectId: 'pt-03', role: 'patient' };
const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
const KHALID: Session = { subjectId: 'acc-10', role: 'reviewer' };
const NOT_ACTIVE = ['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07'];

describe('positive controls — the data each refusal hides exists and is served to its owner', () => {
  it('حمد reads 3 overview lines and 2 refill requests; سارة reads her calendar subscription', async () => {
    expect(await dbRows(app(await gucFor(HAMAD)), 'getRefillOverview', 'pt-01')).toBe(3);
    expect(await dbRows(app(await gucFor(HAMAD)), 'getRefillRequests', 'pt-01')).toBe(2);
    expect(await dbRows(app(await gucFor(SARA)), 'getCalendarSubscription', 'pt-03')).toBe(1);
    expect(await seam(SARA, 'getCalendarSubscription', 'pt-03')).not.toBe('null');
  });
});

describe('E-21 — a pending/declined/expired/revoked/cancelled caregiver session reads nothing (supply rows)', () => {
  let statuses: Record<string, string> = {};
  beforeAll(async () => {
    const rows = await getSql()`select id, status::text as status from caregivers where id = any(${NOT_ACTIVE})`;
    statuses = Object.fromEntries(rows.map((r) => [String(r.id), String(r.status)]));
  });

  it('E-21 · the five seeded caregivers linked to pt-01 are none of them active', () => {
    expect(Object.keys(statuses).sort()).toEqual(NOT_ACTIVE);
    for (const id of NOT_ACTIVE) expect(statuses[id]).not.toBe('active');
  });

  for (const id of NOT_ACTIVE) {
    for (const fn of FNS) {
      it(`E-21 · ${id} (linked pt-01) · ${fn}(${TARGET[fn]}) → RLS 0 rows · seam ${REFUSAL[fn]}`, async () => {
        const s: Session = { subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' };
        expect(await dbRows(app(await gucFor(s)), fn, TARGET[fn])).toBe(0);
        expect(await seam(s, fn, TARGET[fn])).toBe(REFUSAL[fn]);
      });
    }
  }

  it('E-21 · control: the ACTIVE caregiver عبدالله (cg-01) reads حمد’s overview and requests byte-for-byte as حمد does', async () => {
    expect(await seam(ABDULLAH, 'getRefillOverview', 'pt-01')).toBe(await seam(HAMAD, 'getRefillOverview', 'pt-01'));
    expect(await seam(ABDULLAH, 'getRefillRequests', 'pt-01')).toBe(await seam(HAMAD, 'getRefillRequests', 'pt-01'));
  });
});

describe('the other refused readers (mock parity, D-022)', () => {
  const cases: Array<[string, Session | null]> = [
    ['no session', null],
    ['ناصر, pending-only session (E-22 read half, supply rows)', { subjectId: 'cg-03', pendingInvitationOnly: true }],
    ['م. دانة, admin (reads no clinical record)', { subjectId: 'acc-11', role: 'admin' }],
  ];
  for (const [label, s] of cases) {
    it(`${label} → every supply read refused`, async () => {
      for (const fn of FNS) {
        if (s) expect(await dbRows(app(await gucFor(s)), fn, TARGET[fn])).toBe(0);
        expect(await seam(s, fn, TARGET[fn])).toBe(REFUSAL[fn]);
      }
    });
  }
  it('another patient — سارة reading pt-01 / حمد reading pt-03 → refused', async () => {
    expect(await seam(SARA, 'getRefillOverview', 'pt-01')).toBe(REFUSAL.getRefillOverview);
    expect(await seam(SARA, 'getRefillRequests', 'pt-01')).toBe(REFUSAL.getRefillRequests);
    expect(await seam(HAMAD, 'getCalendarSubscription', 'pt-03')).toBe(REFUSAL.getCalendarSubscription);
  });
  it('getCalendarSubscription is patient-self only: the ACTIVE caregiver عبدالله and the reviewer د. خالد get null (as the mock)', async () => {
    expect(await dbRows(app(await gucFor(KHALID)), 'getCalendarSubscription', 'pt-03')).toBe(0);
    expect(await seam(ABDULLAH, 'getCalendarSubscription', 'pt-01')).toBe('null');
    expect(await seam(KHALID, 'getCalendarSubscription', 'pt-03')).toBe('null');
  });
});

describe('reviewer gating — only a patient with an OPEN queue item (the mock’s canReadPatient)', () => {
  it('د. خالد reads pt-01 (ia-001 pending review) and pt-02 (rx-006/rx-007 flagged), not pt-03 (no queue item)', async () => {
    expect(await seam(KHALID, 'getRefillOverview', 'pt-01')).toBe(await seam(HAMAD, 'getRefillOverview', 'pt-01'));
    expect(await seam(KHALID, 'getRefillOverview', 'pt-02')).toBe(await seam(FATIMA, 'getRefillOverview', 'pt-02'));
    expect(await seam(KHALID, 'getRefillOverview', 'pt-03')).toBe(REFUSAL.getRefillOverview);
  });

  it('the explicit can_read_patient() gate: a needs_review row whose field review is CONFIRMED opens no queue item — RLS alone would show it, the query does not', async () => {
    const reviewerGuc = await gucFor(KHALID);
    const counts = await probe(SYSTEM, async (tx) => {
      await tx`insert into prescriptions (id, patient_id, facility_name, sector, generic_name, dose_per_administration,
                 duration_days, dosing_pattern, needs_review, field_review_status, field_reviewed_by, status)
               values ('rx-wp3c-probe', 'pt-04', 'x', 'public', 'Probe', 1, 7, 'daily', true, 'confirmed', 'acc-10', 'active')`;
      await tx`select set_config('jurah.session', ${JSON.stringify(reviewerGuc)}, true)`;
      await tx`set local role jurah_app`;
      const rlsAlone = (await tx`select id from prescriptions where patient_id = 'pt-04'`).length;
      const query = (await tx.unsafe(PG_QUERIES_SUPPLY.getRefillOverview, ['pt-04'])).length;
      return { rlsAlone, query };
    });
    expect(counts).toEqual({ rlsAlone: 1, query: 0 });
  });
});

describe('CR-040 (OPEN) — flagged prescriptions are INCLUDED in the refill overview, as the mock (divergence D-24)', () => {
  it('CR-040 · فاطمة’s getRefillOverview(pt-02) lists rx-006 (pending) and rx-007 (returned) with no estimate and no brandName key', async () => {
    const lines = JSON.parse(await seam(FATIMA, 'getRefillOverview', 'pt-02')) as Array<Record<string, unknown>>;
    expect(lines.map((l) => l.prescriptionId)).toEqual(['rx-005', 'rx-006', 'rx-007']);
    for (const l of lines) {
      expect('brandName' in l).toBe(false);
      expect([l.remaining, l.total, l.daysRemaining]).toEqual([null, null, null]);
    }
    const [flag] = await getSql()`select count(*)::int as n from prescriptions
      where id in ('rx-006','rx-007') and needs_review and field_review_status in ('pending','returned') and status = 'active'`;
    expect(flag?.n).toBe(2); // the inclusion is of genuinely flagged rows — flagged for the owner, not decided here
  });
});

describe('reads never write, and no Civil ID crosses the seam', () => {
  it('counts of every table these reads touch (and audit_events, snapshots) are unchanged by 20 calls', async () => {
    const count = async () => (await getSql()`select
      (select count(*) from audit_events)::int as a, (select count(*) from snapshots)::int as s,
      (select count(*) from prescriptions)::int as p, (select count(*) from refill_requests)::int as r,
      (select count(*) from calendar_subscriptions)::int as c`)[0];
    const before = await count();
    const out: string[] = [];
    for (const s of [HAMAD, FATIMA, SARA, ABDULLAH, KHALID]) for (const fn of FNS) out.push(await seam(s, fn, s.linkedPatientId ?? (s.role === 'patient' ? s.subjectId : 'pt-01')));
    for (const fn of FNS) out.push(await seam(null, fn, TARGET[fn]));
    expect(await count()).toEqual(before);
    expect(out.join('\n')).not.toMatch(/\d{12}/);
  });
});

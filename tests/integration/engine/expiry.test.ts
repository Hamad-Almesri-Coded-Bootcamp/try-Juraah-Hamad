/**
 * P2-WP4b — the expiry job's database half against Postgres, as the job route runs it:
 * withSystem(). Seed: cg-03 expires 2026-10-02T20:10, cg-08 2026-10-04T09:30 (+03:00).
 */
import { describe, expect, it } from 'vitest';
import { expireInvitations, INVITE_EXPIRED_MESSAGE } from '@/lib/engine/expiry';
import { S, app, probe } from '../helpers';
import { SYSTEM_APP, count, digest } from './_engine';

async function runAt(nowIso: string) {
  return probe(SYSTEM_APP, async (tx) => {
    const before = await digest(tx);
    const audit0 = await count(tx, 'select 1 from audit_events');
    await tx`set local role jurah_app`;
    const out = await expireInvitations(tx, nowIso);
    await tx`reset role`;
    return {
      out,
      statuses: (await tx.unsafe(`select string_agg(id || ':' || status, ',' order by seq) as s from caregivers`))[0]!.s as string,
      audit: (await tx.unsafe(`select patient_id || '|' || actor_role || '|' || type || '|' || message || '|' || related_id || '|' || iso_kw(created_at) as r from audit_events where type = 'caregiver_invite_expired' and related_id <> 'cg-05' order by seq`)).map((x) => String(x.r)),
      newAudit: (await count(tx, 'select 1 from audit_events')) - audit0,
      jobs: (await tx.unsafe(`select job || '|' || rows_affected || '|' || iso_kw(ran_at) as r from job_runs order by id`)).map((x) => String(x.r)),
      before, after: await digest(tx),
    };
  });
}

describe('expireInvitations', () => {
  it('2026-10-03 (E-20\'s instant): cg-03 flips, cg-08 is still live; one audit row; one job_runs row; doses byte-identical', async () => {
    const r = await runAt('2026-10-03T00:00:00+03:00');
    expect(r.out).toEqual({ ok: true, expiredIds: ['cg-03'] });
    expect(r.statuses).toBe('cg-01:active,cg-02:active,cg-03:expired,cg-04:declined,cg-05:expired,cg-06:revoked,cg-07:revoked,cg-08:pending');
    expect(r.audit).toEqual([`pt-01|system|caregiver_invite_expired|${INVITE_EXPIRED_MESSAGE}|cg-03|2026-10-03T00:00:00+03:00`]);
    expect(r.newAudit).toBe(1);
    expect(r.jobs).toEqual(['expire_invitations|1|2026-10-03T00:00:00+03:00']);
    expect(r.after).toEqual(r.before);
  });

  it('2026-10-05: cg-03 and cg-08 flip; two audit rows (pt-01, pt-02); doses byte-identical', async () => {
    const r = await runAt('2026-10-05T00:00:00+03:00');
    expect(r.out).toEqual({ ok: true, expiredIds: ['cg-03', 'cg-08'] });
    expect(r.statuses).toBe('cg-01:active,cg-02:active,cg-03:expired,cg-04:declined,cg-05:expired,cg-06:revoked,cg-07:revoked,cg-08:expired');
    expect(r.audit.map((a) => a.split('|').slice(0, 5).join('|'))).toEqual([
      `pt-01|system|caregiver_invite_expired|${INVITE_EXPIRED_MESSAGE}|cg-03`,
      `pt-02|system|caregiver_invite_expired|${INVITE_EXPIRED_MESSAGE}|cg-08`,
    ]);
    expect(r.newAudit).toBe(2);
    expect(r.after).toEqual(r.before);
  });

  it('at REFERENCE_NOW: nothing flips, no audit row, the job run is still recorded (rows_affected 0)', async () => {
    const r = await runAt('2026-09-21T09:15:00+03:00');
    expect(r.out).toEqual({ ok: true, expiredIds: [] });
    expect(r.newAudit).toBe(0);
    expect(r.jobs).toEqual(['expire_invitations|0|2026-09-21T09:15:00+03:00']);
  });

  it('a patient session cannot run the job: job_runs refuses a non-system actor (and the trigger would refuse the flip)', async () => {
    await expect(probe(app(S.hamad), (tx) => expireInvitations(tx, '2026-10-05T00:00:00+03:00'))).rejects.toThrow(/caregiver_transitions: only the system expires an invitation|row-level security/);
  });
});

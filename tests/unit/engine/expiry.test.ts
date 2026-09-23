/**
 * P2-WP4b — expireInvitations against the seed's caregivers, with the recording fake transaction.
 * The seed: cg-03 (ناصر) expires 2026-10-02T20:10, cg-08 (سارة ← فاطمة) 2026-10-04T09:30.
 */
import { describe, expect, it } from 'vitest';
import { buildCaregivers } from '@/lib/data/mock/seed';
import { expireInvitations, INVITE_EXPIRED_MESSAGE } from '@/lib/engine/expiry';
import { fakeTx, type Recorded } from './fakeTx';

const pendingRows = () =>
  buildCaregivers().filter((c) => c.status === 'pending').map((c) => ({ id: c.id, linked_patient_id: c.linkedPatientId, status: c.status, expires_at: c.expiresAt }));

/** The database side: the update flips exactly the ids handed to it whose expires_at <= the clock set by setClock. */
function db() {
  let clock = '';
  const respond = (name: Recorded['name'], params: unknown[]) => {
    if (name === 'pendingInvitations') return pendingRows();
    if (name === 'setClock') { clock = String(params[0]); return [{ now: clock }]; }
    if (name === 'expireInvitations') {
      const ids = new Set(params[0] as string[]);
      return pendingRows().filter((r) => ids.has(r.id) && Date.parse(r.expires_at) <= Date.parse(clock)).map((r) => ({ id: r.id, linked_patient_id: r.linked_patient_id }));
    }
    if (name === 'recordJobRun') return [{ id: 1 }];
    return [];
  };
  return respond;
}

const audits = (log: Recorded[]) => log.filter((l) => l.name === 'audit_insert');

describe('expireInvitations', () => {
  it('at REFERENCE_NOW nothing is stale: no update, no audit row, one job_runs row with 0', async () => {
    const { sql, log } = fakeTx(db());
    await expect(expireInvitations(sql, '2026-09-21T09:15:00+03:00')).resolves.toEqual({ ok: true, expiredIds: [] });
    expect(log.map((l) => l.name)).toEqual(['pendingInvitations', 'setClock', 'recordJobRun']);
    expect(log.at(-1)!.params).toEqual([0]);
  });

  it('2026-10-03: cg-03 only (cg-08 is live until 2026-10-04 09:30) — one audit row, actor system, the seed message', async () => {
    const { sql, log } = fakeTx(db());
    await expect(expireInvitations(sql, '2026-10-03T00:00:00+03:00')).resolves.toEqual({ ok: true, expiredIds: ['cg-03'] });
    expect(log.find((l) => l.name === 'setClock')!.params).toEqual(['2026-10-03T00:00:00+03:00']);
    const a = audits(log);
    expect(a).toHaveLength(1);
    // append()'s tagged insert: (id, scope, patient_id, actor_role, actor_id, type, message, created_at, related_id)
    expect(a[0]!.params.slice(1)).toEqual(['patient', 'pt-01', 'system', null, 'caregiver_invite_expired', INVITE_EXPIRED_MESSAGE, null, 'cg-03']);
    expect(log.at(-1)!.params).toEqual([1]);
  });

  it('2026-10-05: cg-03 and cg-08, in seed order, two audit rows (pt-01, pt-02)', async () => {
    const { sql, log } = fakeTx(db());
    await expect(expireInvitations(sql, '2026-10-05T00:00:00+03:00')).resolves.toEqual({ ok: true, expiredIds: ['cg-03', 'cg-08'] });
    expect(audits(log).map((a) => [a.params[2], a.params[8]])).toEqual([['pt-01', 'cg-03'], ['pt-02', 'cg-08']]);
  });

  it('the boundary is inclusive: at exactly 2026-10-02T20:10:00+03:00 cg-03 expires; a second earlier it does not', async () => {
    const at = async (now: string) => { const { sql } = fakeTx(db()); return expireInvitations(sql, now); };
    await expect(at('2026-10-02T20:09:59+03:00')).resolves.toEqual({ ok: true, expiredIds: [] });
    await expect(at('2026-10-02T20:10:00+03:00')).resolves.toEqual({ ok: true, expiredIds: ['cg-03'] });
  });

  it('a row the database clock disagrees about is neither flipped nor audited', async () => {
    const respond = db();
    const { sql, log } = fakeTx((name, params) => (name === 'expireInvitations' ? [] : respond(name, params)));
    await expect(expireInvitations(sql, '2026-10-05T00:00:00+03:00')).resolves.toEqual({ ok: true, expiredIds: [] });
    expect(audits(log)).toEqual([]);
  });

  it('a malformed nowIso → { ok:false, invalid_now }, returned (never thrown), before any statement', async () => {
    const { sql, log } = fakeTx(db());
    await expect(expireInvitations(sql, 'soon')).resolves.toEqual({ ok: false, reason: 'invalid_now' });
    expect(log).toEqual([]);
  });

  it('no statement names doses, and no selected column is a Civil ID', async () => {
    const { sql, log } = fakeTx(db());
    await expireInvitations(sql, '2026-10-05T00:00:00+03:00');
    for (const l of log) {
      expect(l.text).not.toMatch(/\bdoses\b/i);
      expect(l.text).not.toMatch(/civil_id/i);
    }
  });
});

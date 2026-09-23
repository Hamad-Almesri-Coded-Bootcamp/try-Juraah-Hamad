/**
 * ENFORCEMENT.md tag `dose`. P2-WP4b wrote E-03 at the library level; P2-WP7 appended E-01, E-02,
 * E-04 and E-05 and extended E-03 to call the real routes (POST /api/jobs/expire-invitations — WP6's —
 * and POST /api/agent/schedule/recompute), so the row is not a "call never made". The route calls
 * run with JURAH_DATA_BACKEND=postgres and the bearer values from the environment (never printed);
 * they commit, and the harness re-seeds per file.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { expireInvitations } from '@/lib/engine/expiry';
import { applyRecompute, regenerateUpcoming } from '@/lib/engine/doses';
import { ENGINE_SQL } from '@/lib/engine/sql';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import * as pg from '@/lib/data/pg';
import type { Session } from '@/types/views';
import { app, probe, rejects, S, SYSTEM } from '../helpers';
import { SYSTEM_APP, digest, rxOf } from '../engine/_engine';

const THREE_DAYS_ON = '2026-09-24T09:15:00+03:00'; // REFERENCE_NOW + 3 days: past every untracked upcoming dose of the 21st
const LATER = '2026-10-05T00:00:00+03:00'; // past both pending invitations as well

const bearer = (name: 'JURAH_AGENT_TOKEN' | 'JURAH_JOB_TOKEN') => {
  const v = (process.env[name] ?? '').trim();
  if (!v) throw new Error(`${name} is not set — the route refuses everyone; NOT A PASS`);
  return { authorization: `Bearer ${v}`, 'content-type': 'application/json' };
};
const post = (path: string, body: unknown, headers: Record<string, string>) =>
  new Request(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
const postStatus = async (doseId: string, body: unknown, headers: Record<string, string>) => {
  const { POST } = await import('@/app/api/agent/doses/[doseId]/status/route');
  return POST(post(`/api/agent/doses/${doseId}/status`, body, headers), { params: Promise.resolve({ doseId }) });
};
const DOSE_WRITE = `update doses set status = 'taken_on_time' where id = 'rx-003-20260921-0800'`;
/** The demo's proof moment, verbatim. */
const PROOF_QUERY = `select actor_role, count(*) from audit_events where type='dose_status_recorded' group by 1`;
async function actorsOfDoseWrites(): Promise<Record<string, number>> {
  const rows = await getSql().unsafe(PROOF_QUERY);
  return Object.fromEntries(rows.map((r) => [String(r.actor_role), Number(r.count)]));
}
async function allDoses(): Promise<unknown> {
  const [r] = await getSql()`select md5(string_agg(d::text, ',' order by d.id)) as h, count(*)::int as n from doses d`;
  return r;
}

vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
afterEach(() => setScriptSession(null));

describe('dose', () => {
  it('E-03', async () => {
    const r = await probe(SYSTEM_APP, async (tx) => {
      await tx`select set_config('jurah.now', ${THREE_DAYS_ON}, true)`;
      const before = await digest(tx);
      await tx`set local role jurah_app`;
      // Everything the engine can run on a clock or on a schedule, with the clock advanced:
      const expiry = await expireInvitations(tx, LATER);
      const rec8 = await applyRecompute(tx, await rxOf(tx, 'rx-008'), 'rx-008-20260919-0700');
      const rec9 = await applyRecompute(tx, await rxOf(tx, 'rx-009'), 'rx-009-20260919-1300'); // tracked, past, unanswered
      const rec3 = await applyRecompute(tx, await rxOf(tx, 'rx-003'), 'rx-003-20260921-0800'); // untracked, past, unanswered
      const afterJobs = await digest(tx);
      await tx`set local role jurah_app`;
      await regenerateUpcoming(tx, await rxOf(tx, 'rx-003'), false);
      await tx`reset role`;
      const [d] = await tx.unsafe(`select status::text || '|' || tracked as r from doses where id = 'rx-003-20260921-0800'`);
      const [missed] = await tx.unsafe(`select count(*)::int as n from doses where status = 'missed'`);
      return { expiry, rec8, rec9, rec3, before, afterJobs, d: d!.r, missed: missed!.n };
    });
    expect(r.expiry).toEqual({ ok: true, expiredIds: ['cg-03', 'cg-08'] });
    for (const rec of [r.rec8, r.rec9, r.rec3]) expect(rec).toEqual({ changed: false, addedIds: [], droppedIds: [] });
    expect(r.afterJobs).toEqual(r.before); // the expiry job and three recomputes: doses byte-identical
    expect(r.d).toBe('upcoming|false');
    expect(r.missed).toBe(1); // سارة's one REPORTED miss — the seed's, recorded by the agent; nothing added one
    // and statically: no engine statement names 'missed' at all, and none updates doses
    const engineSrc = ['doses.ts', 'expiry.ts', 'sql.ts', 'rows.ts'].map((f) => readFileSync(`lib/engine/${f}`, 'utf8')).join('\n');
    expect(engineSrc).not.toMatch(/'missed'/);
    for (const t of Object.values(ENGINE_SQL)) expect(t).not.toMatch(/update\s+doses/i);

    // P2-WP7: the ROUTES, called for real. At the frozen clock the job expires nothing (cg-03 lapses
    // 2026-10-03) — the point is that the job route RAN and touched no dose; the clock-advanced half
    // above proves the same for a job that does flip rows.
    const beforeRoutes = await allDoses();
    const { POST: expire } = await import('@/app/api/jobs/expire-invitations/route');
    const job = await expire(post('/api/jobs/expire-invitations', {}, bearer('JURAH_JOB_TOKEN')));
    expect(job.status).toBe(200);
    expect(await job.json()).toEqual({ expired: 0 });
    const [run] = await getSql()`select job, rows_affected from job_runs order by ran_at desc limit 1`;
    expect(run).toEqual({ job: 'expire_invitations', rows_affected: 0 });
    const { POST: recompute } = await import('@/app/api/agent/schedule/recompute/route');
    const rec = await recompute(post('/api/agent/schedule/recompute', { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260919-0700' }, bearer('JURAH_AGENT_TOKEN')));
    expect(rec.status).toBe(200);
    expect(await rec.json()).toEqual({ changed: false, addedIds: [], droppedIds: [] });
    // An untracked, past, unanswered dose is not a miss: the route refuses to recompute on it (409).
    const rec3 = await recompute(post('/api/agent/schedule/recompute', { prescriptionId: 'rx-003', reason: 'reported_miss', missedDoseId: 'rx-003-20260921-0800' }, bearer('JURAH_AGENT_TOKEN')));
    expect(rec3.status).toBe(409);
    expect(await allDoses()).toEqual(beforeRoutes);
    const [d3] = await getSql()`select status::text || '|' || tracked as r from doses where id = 'rx-003-20260921-0800'`;
    expect(d3?.r).toBe('upcoming|false');
    const [m] = await getSql()`select count(*)::int as n from doses where status = 'missed'`;
    expect(m?.n).toBe(1);
  });

  it('E-01', async () => {
    const users: Record<string, Session> = {
      hamad: { subjectId: 'pt-01', role: 'patient' } as Session,
      abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } as Session,
      khalid_reviewer: { subjectId: 'acc-10', role: 'reviewer' } as Session,
      dana_admin: { subjectId: 'acc-11', role: 'admin' } as Session,
    };
    const body = { status: 'taken_on_time', source: 'adherence_agent' };
    for (const [who, s] of Object.entries(users)) {
      setScriptSession(s);
      const res = await postStatus('rx-003-20260921-0800', body, { 'content-type': 'application/json' });
      expect({ who, status: res.status, body: await res.json() }).toEqual({ who, status: 403, body: { error: 'forbidden' } });
    }
    setScriptSession(null);
    expect((await postStatus('rx-003-20260921-0800', body, { 'content-type': 'application/json' })).status).toBe(401);
    // The database half: a user session cannot write a status even with SQL in hand.
    for (const s of [S.hamad, S.abdullah, S.khalidReviewer, S.dana]) await rejects(app(s), DOSE_WRITE, 'permission denied for table doses');
    const [d] = await getSql()`select status::text || '|' || tracked as r from doses where id = 'rx-003-20260921-0800'`;
    expect(d?.r).toBe('upcoming|false');
    // And no /api/doses route exists at all.
    const walk = (dir: string): string[] => readdirSync(dir).flatMap((f) => (statSync(`${dir}/${f}`).isDirectory() ? walk(`${dir}/${f}`) : [`${dir}/${f}`]));
    const routes = walk('app/api').filter((f) => f.endsWith('route.ts'));
    expect(routes.filter((f) => f.startsWith('app/api/doses'))).toEqual([]);
    expect(routes.filter((f) => /dose/i.test(f))).toEqual(['app/api/agent/doses/[doseId]/status/route.ts']);
  });

  it('E-02', async () => {
    const res = await postStatus('rx-002-20260921-0800', { status: 'taken_on_time', recordedAt: '2026-09-21T08:05:00+03:00', source: 'adherence_agent' }, bearer('JURAH_AGENT_TOKEN'));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'untracked_dose' });
    const [d] = await getSql()`select status::text || '|' || tracked || '|' || coalesce(recorded_at::text, 'null') as r from doses where id = 'rx-002-20260921-0800'`;
    expect(d?.r).toBe('upcoming|false|null');
  });

  it('E-04', async () => {
    // The demo's proof moment, BEFORE: only agent/system have ever recorded a dose status.
    const before = await actorsOfDoseWrites();
    expect(Object.keys(before).length).toBeGreaterThan(0);
    expect(Object.keys(before).every((k) => k === 'agent' || k === 'system')).toBe(true);
    const res = await postStatus('rx-009-20260921-1300', { status: 'taken_on_time', recordedAt: '2026-09-21T13:05:00+03:00', source: 'adherence_agent' }, bearer('JURAH_AGENT_TOKEN'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ dose: {
      id: 'rx-009-20260921-1300', prescriptionId: 'rx-009', scheduledAt: '2026-09-21T13:00:00+03:00', status: 'taken_on_time',
      tracked: true, recordedAt: '2026-09-21T13:05:00+03:00', source: 'adherence_agent',
    } });
    const [row] = await getSql()`select type::text as type, actor_role::text as actor, actor_id, patient_id, related_id, message
      from audit_events where related_id = 'rx-009-20260921-1300' and type = 'dose_status_recorded'`;
    expect(row).toEqual({ type: 'dose_status_recorded', actor: 'agent', actor_id: null, patient_id: 'pt-03', related_id: 'rx-009-20260921-1300',
      message: 'تسجيل حالة جرعة — في وقتها: Calcium carbonate + vitamin D3' });
    // AFTER: exactly one more, and still only agent/system.
    expect(await actorsOfDoseWrites()).toEqual({ ...before, agent: (before.agent ?? 0) + 1 });
    // The check itself: a patient-authored dose_status_recorded row is impossible.
    await rejects(SYSTEM, `insert into audit_events (id, scope, patient_id, actor_role, type, message, related_id, created_at)
      values ('ae_x', 'patient', 'pt-03', 'patient', 'dose_status_recorded', 'x', 'rx-009-20260921-1300', jurah_now())`, 'audit_dose_status_actor');
    // (created_at is supplied so the row reaches the CHECK: NOT NULL is evaluated first, and the first
    // real-database run showed the row refused by it instead — the named check never consulted.)
    // And the patient's activity (E2) shows it, through the seam.
    setScriptSession({ subjectId: 'pt-03', role: 'patient' } as Session);
    const activity = await pg.getActivity('pt-03');
    expect(activity.some((e) => e.type === 'dose_status_recorded' && e.relatedId === 'rx-009-20260921-1300' && e.actor.role === 'agent')).toBe(true);
  });

  it('E-05', async () => {
    await rejects(app(S.khalidReviewer), DOSE_WRITE, 'permission denied for table doses');
    const [p] = await getSql()`select has_column_privilege('jurah_app', 'doses', 'status', 'UPDATE') as app, has_column_privilege('jurah_agent', 'doses', 'status', 'UPDATE') as agent`;
    expect(p).toEqual({ app: false, agent: true });
  });
});

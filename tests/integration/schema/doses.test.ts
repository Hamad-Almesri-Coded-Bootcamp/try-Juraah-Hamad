/** doses — G1 (docs/SCHEMA.md §1 doses). One rejected row per named constraint/trigger. */
import { describe, expect, it } from 'vitest';
import { AGENT, OWNER_NO_SESSION, S, SYSTEM, accepts, app, rejects } from '../helpers';

const ins = (id: string, rx: string, at: string, status: string, tracked: boolean, rec: string | null, src: string | null) =>
  `insert into doses (id, prescription_id, scheduled_at, status, tracked, recorded_at, source) values ('${id}', '${rx}', '${at}', '${status}', ${tracked}, ${rec ? `'${rec}'` : 'null'}, ${src ? `'${src}'` : 'null'})`;

describe('doses', () => {
  it('dose_untracked_has_no_status — a tracked:false dose can never hold a status, whoever writes it', async () => {
    await rejects(SYSTEM, ins('t1', 'rx-003', '2026-09-21T08:00:00+03:00', 'taken_on_time', false, '2026-09-21T08:01:00+03:00', 'adherence_agent'), 'dose_untracked_has_no_status');
    await rejects(AGENT, `update doses set status = 'taken_on_time', recorded_at = '2026-09-21T08:05:00+03:00', source = 'adherence_agent' where id = 'rx-002-20260921-0800'`, 'dose_untracked_has_no_status');
  });

  it('dose_taken_late_has_recorded_at', async () => {
    await rejects(SYSTEM, ins('t2', 'rx-008', '2026-12-31T07:00:00+03:00', 'taken_late', true, null, 'adherence_agent'), 'dose_taken_late_has_recorded_at');
  });

  it("dose_source_t has no 'ui' value", async () => {
    await rejects(SYSTEM, ins('t3', 'rx-008', '2026-12-31T07:00:00+03:00', 'upcoming', true, null, 'ui'), 'invalid input value for enum dose_source_t');
  });

  it('doses_prescription_id_fkey', async () => {
    await rejects(SYSTEM, ins('t4', 'rx-999', '2026-12-31T07:00:00+03:00', 'upcoming', true, null, 'seed'), 'doses_prescription_id_fkey');
  });

  it('jurah_app holds no UPDATE on status — patient, caregiver, reviewer, admin sessions all refused (E-01, E-05)', async () => {
    for (const s of [S.hamad, S.abdullah, S.khalidReviewer, S.dana]) {
      await rejects(app(s), `update doses set status = 'taken_on_time' where id = 'rx-003-20260921-0800'`, 'permission denied for table doses');
    }
  });

  it('doses_status_write — jurah_app cannot INSERT a recorded dose through its generation grant', async () => {
    await rejects(app(S.hamad), ins('t5', 'rx-003', '2026-12-12T08:00:00+03:00', 'taken_on_time', true, '2026-12-12T08:01:00+03:00', 'adherence_agent'), 'doses_status_write');
  });

  it('doses_status_write — even the owner, without the system actor, cannot write a status', async () => {
    await rejects(OWNER_NO_SESSION, `update doses set status = 'taken_on_time', recorded_at = '2026-09-21T13:05:00+03:00', source = 'adherence_agent' where id = 'rx-009-20260921-1300'`, 'doses_status_write');
  });

  it('doses_status_recorded_audit — the agent path appends dose_status_recorded with actor agent (E-04)', async () => {
    const r = await accepts(AGENT, `update doses set status = 'taken_on_time', recorded_at = '2026-09-21T13:05:00+03:00', source = 'adherence_agent' where id = 'rx-009-20260921-1300'`,
      `select string_agg(actor_role || '|' || type || '|' || scope || '|' || patient_id, ',') from audit_events where related_id = 'rx-009-20260921-1300'`);
    expect(r.count).toBe(1);
    expect(r.value).toBe('agent|dose_status_recorded|patient|pt-03');
  });

  it('jurah_app may still generate an upcoming dose and delete only upcoming ones', async () => {
    const ok = await accepts(app(S.hamad), ins('t6', 'rx-003', '2026-12-12T08:00:00+03:00', 'upcoming', false, null, 'seed'));
    expect(ok.count).toBe(1);
    const del = await accepts(app(S.sara), `delete from doses where id = 'rx-008-20260920-0700'`); // a RECORDED dose
    expect(del.count).toBe(0);
  });

  it('rule 4 — nothing turns an unanswered past dose into missed: after all the above, rx-003-20260921-0800 is still upcoming/untracked', async () => {
    const r = await accepts(SYSTEM, 'select 1', `select status || '|' || tracked from doses where id = 'rx-003-20260921-0800'`);
    expect(r.value).toBe('upcoming|false');
  });
});

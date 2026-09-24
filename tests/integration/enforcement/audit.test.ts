/**
 * CR-061 (AP-12, docs/AGENTS-POLISH-PLAN.md §7.3; DECISIONS CR-091): migration 0014's restrictive
 * insert policy `audit_insert_actor`, against the REAL database (setup.ts re-seeds per file and
 * FAILS loudly without JURAH_DATABASE_URL).
 *
 * The database does NOT run migrations when this suite starts, so the first thing checked is that
 * 0014 is applied. If it is not, every test here fails with one loud line: a refusal test that
 * passes because the policy it tests is absent would be worse than no test.
 *
 * Every refusal below is a row that 0005's policies and the table's CHECKs ACCEPT, so the only
 * thing that can refuse it is audit_insert_actor, and each assertion names that policy (a
 * restrictive policy's name is in its error message). The one other refusal is the premise of
 * the dose_status_recorded rule: jurah_app cannot update doses.status (0005's grant). Every
 * acceptance is a writer the seam uses today. Probes roll back; only the last test commits (the
 * real recomputeSchedule), and the next file re-seeds.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { append } from '@/lib/db/audit';
import { withSession } from '@/lib/db/withSession';
import { recomputeSchedule } from '@/lib/data/pg/agent';
import { AGENT, S, accepts, app, rejects, type As } from '../helpers';

const POLICY = 'audit_insert_actor';
const NOT_APPLIED = '!! migration 0014 is not applied to this database: audit_insert_actor does not exist. NOT A PASS';

/** withSystem() exactly: role jurah_app, session {"role":"system"} (the webhook, job and D-025 paths). */
const SYSTEM_APP: As = app({ role: 'system' });

/** One audit row, written raw (outside append(), on purpose: this is what a forged write looks like). */
function row(id: string, actor: string, type: string, patient: string | null = 'pt-01'): string {
  const scope = patient ? 'patient' : 'system';
  const pid = patient ? `'${patient}'` : 'null';
  return `insert into audit_events (id, scope, patient_id, actor_role, actor_id, type, message, created_at)
          values ('${id}', '${scope}', ${pid}, '${actor}', null, '${type}', 'x', jurah_now())`;
}

async function policies(): Promise<Record<string, { permissive: string; cmd: string; roles: string[] }>> {
  const rows = await getSql()`select policyname, permissive, cmd, roles::text[] as roles
    from pg_policies where schemaname = 'public' and tablename = 'audit_events' and cmd = 'INSERT'`;
  return Object.fromEntries(rows.map((r) => [String(r.policyname), { permissive: String(r.permissive), cmd: String(r.cmd), roles: (r.roles as string[]).map(String) }]));
}

beforeAll(async () => {
  if (!(POLICY in (await policies()))) {
    console.error(NOT_APPLIED);
    throw new Error(NOT_APPLIED);
  }
});

describe('audit: who may write a row naming which actor (CR-061)', () => {
  it('CR-061 · 0014 is applied: audit_insert_actor is RESTRICTIVE, INSERT, jurah_app; 0005\'s two insert policies are unchanged', async () => {
    expect(await policies()).toEqual({
      audit_insert_session: { permissive: 'PERMISSIVE', cmd: 'INSERT', roles: ['jurah_app'] },
      audit_agent_insert: { permissive: 'PERMISSIVE', cmd: 'INSERT', roles: ['jurah_agent'] },
      audit_insert_actor: { permissive: 'RESTRICTIVE', cmd: 'INSERT', roles: ['jurah_app'] },
    });
  });

  it("CR-061 · a patient session inserting actor_role = 'agent' is refused, whatever the event type", async () => {
    for (const type of ['alert_raised', 'prescription_added', 'prescription_discontinued', 'schedule_recomputed', 'dose_status_recorded', 'signed_in']) {
      await rejects(app(S.hamad), row(`ae_cr061_p_${type}`, 'agent', type), POLICY);
    }
  });

  it("CR-061 · the same refusal through append(), the one application insert path, rolls the transaction back", async () => {
    let refusal = '';
    try {
      await withSession({ subjectId: 'pt-01', role: 'patient' }, async (sql) => {
        await append(sql, { scope: 'patient', patientId: 'pt-01', actor: { role: 'agent' }, type: 'alert_raised', message: 'x' });
        throw new Error('ACCEPTED: a patient session wrote a row naming the agent');
      });
    } catch (e) {
      refusal = (e as Error).message;
    }
    expect(refusal).toContain(POLICY);
  });

  it("CR-061 · no user session names the agent: caregiver, reviewer, admin, pending-only", async () => {
    for (const [who, s] of Object.entries({ abdullah: S.abdullah, khalid: S.khalidReviewer, dana: S.dana, naser_pending: S.naserPending })) {
      await rejects(app(s), row(`ae_cr061_u_${who}`, 'agent', 'alert_raised'), POLICY);
    }
  });

  it('CR-061 · no jurah_app session writes a dose_status_recorded row naming the system, the system session included', async () => {
    // audit_dose_status_actor admits 'system', so before 0014 any jurah_app session could forge the
    // demo's proof row. Its one writer is the trigger on `update of status on doses`, and jurah_app
    // holds no UPDATE on doses.status (0005), so under jurah_app the trigger never fires: the row
    // comes from jurah_agent or the owner (the seed) only. jurah.session is a setting any caller
    // can set, so the system session is refused as well.
    for (const as of [app(S.hamad), app(S.abdullah), app(S.khalidReviewer), app(S.dana), app(S.naserPending), SYSTEM_APP]) {
      await rejects(as, row('ae_cr061_dose_system', 'system', 'dose_status_recorded', 'pt-03'), POLICY);
    }
    // the premise, at runtime: the system session cannot reach the trigger at all
    await rejects(SYSTEM_APP,
      `update doses set status = 'taken_on_time', recorded_at = '2026-09-21T13:05:00+03:00', source = 'adherence_agent' where id = 'rx-009-20260921-1300'`,
      'permission denied for table doses');
  });

  it('CR-061 · the agent role still writes rows naming the agent, raw and through the dose trigger', async () => {
    expect((await accepts(AGENT, row('ae_cr061_agent', 'agent', 'alert_raised'))).count).toBe(1);
    const viaTrigger = await accepts(AGENT,
      `update doses set status = 'taken_on_time', recorded_at = '2026-09-21T13:05:00+03:00', source = 'adherence_agent' where id = 'rx-009-20260921-1300'`,
      `select actor_role::text from audit_events where related_id = 'rx-009-20260921-1300' and type = 'dose_status_recorded' order by seq desc limit 1`);
    expect(viaTrigger).toEqual({ count: 1, value: 'agent' });
  });

  it('CR-061 · D-025: the system session writes prescription_discontinued naming the agent, and no other row naming it', async () => {
    expect((await accepts(SYSTEM_APP, row('ae_cr061_d025', 'agent', 'prescription_discontinued'))).count).toBe(1);
    for (const type of ['alert_raised', 'prescription_added', 'schedule_recomputed', 'dose_status_recorded']) {
      await rejects(SYSTEM_APP, row(`ae_cr061_s_${type}`, 'agent', type), POLICY);
    }
  });

  it('CR-061 · every other actor the seam writes is still accepted', async () => {
    const writers: [string, As, string][] = [
      ['patient · signed_in (sign-in)', app(S.hamad), row('ae_cr061_w1', 'patient', 'signed_in')],
      ['patient · system tracking_disabled (disconnect, channels.ts)', app(S.hamad), row('ae_cr061_w2', 'system', 'tracking_disabled')],
      ['patient · caregiver caregiver_invite_accepted (accept, writes.ts)', app(S.hamad), row('ae_cr061_w3', 'caregiver', 'caregiver_invite_accepted')],
      ['caregiver · caregiver_self_unlinked', app(S.abdullah), row('ae_cr061_w4', 'caregiver', 'caregiver_self_unlinked')],
      ['reviewer · alert_reviewed', app(S.khalidReviewer), row('ae_cr061_w5', 'reviewer', 'alert_reviewed')],
      ['admin · signed_out', app(S.dana), row('ae_cr061_w6', 'admin', 'signed_out', null)],
      ['pending-only · caregiver caregiver_invite_declined', app(S.naserPending), row('ae_cr061_w7', 'caregiver', 'caregiver_invite_declined')],
      ['pending-only · system signed_out', app(S.naserPending), row('ae_cr061_w8', 'system', 'signed_out', null)],
      ['system · patient messaging_connected (webhook)', SYSTEM_APP, row('ae_cr061_w9', 'patient', 'messaging_connected')],
      ['system · schedule_recomputed', SYSTEM_APP, row('ae_cr061_w10', 'system', 'schedule_recomputed')],
    ];
    for (const [what, as, statement] of writers) {
      expect({ what, count: (await accepts(as, statement)).count }).toEqual({ what, count: 1 });
    }
  });

  it('CR-061 · no session is still refused by 0005 (row-level security)', async () => {
    await rejects({ role: 'jurah_app', session: null }, row('ae_cr061_none', 'patient', 'signed_in'), 'row-level security');
  });

  it('CR-061 · the real D-025 path, recomputeSchedule (discontinued), still writes its row naming the agent (commits)', async () => {
    const out = await recomputeSchedule({ prescriptionId: 'rx-003', reason: 'discontinued', discontinuedAt: '2026-09-21', discontinuedReason: 'الطبيب أوقف الدواء' });
    expect(out.kind).toBe('discontinued');
    const [a] = await getSql()`select actor_role::text as actor from audit_events where type = 'prescription_discontinued' and related_id = 'rx-003'`;
    expect(a).toEqual({ actor: 'agent' });
  });
});

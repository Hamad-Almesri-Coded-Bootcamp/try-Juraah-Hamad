/** messaging_links, push/calendar uniqueness, audit_events (append-only), settings (G10), server-side tables. */
import { describe, expect, it } from 'vitest';
import { append } from '@/lib/db/audit';
import { withSession } from '@/lib/db/withSession';
import { AGENT, OWNER_NO_SESSION, S, SYSTEM, accepts, app, probe, rejects } from '../helpers';

describe('messaging_links', () => {
  const ins = (id: string, type: string, subject: string, status: string, extra = '', vals = '') =>
    `insert into messaging_links (id, subject_type, subject_id, status${extra}) values ('${id}', '${type}', '${subject}', '${status}'${vals})`;
  it('link_connected_has_chat', async () => { await rejects(SYSTEM, ins('l1', 'patient', 'pt-04', 'connected'), 'link_connected_has_chat'); });
  it('link_pending_has_token', async () => { await rejects(SYSTEM, ins('l2', 'patient', 'pt-04', 'pending', ', link_token', ", 't'"), 'link_pending_has_token'); });
  it('messaging_links_link_token_key', async () => {
    await rejects(SYSTEM, ins('l3', 'patient', 'pt-04', 'pending', ', link_token, token_expires_at', ", 'mock-token-ml-05', jurah_now()"), 'messaging_links_link_token_key');
  });
  it('link_chat_id_server_only — a user session can never set a chat id (E-38)', async () => {
    await rejects(app(S.abdullah), `update messaging_links set chat_id = 'x' where id = 'ml-04'`, 'link_chat_id_server_only');
    await rejects(app(S.hamad), ins('l4', 'patient', 'pt-01', 'connected', ', chat_id', ", 'x'"), 'link_chat_id_server_only');
    await rejects(OWNER_NO_SESSION, `update messaging_links set chat_id = 'x' where id = 'ml-01'`, 'link_chat_id_server_only');
  });
  it('POSITIVE: the system actor (webhook path) sets it', async () => {
    const r = await accepts({ role: 'jurah_app', session: { role: 'system' } }, `update messaging_links set status = 'connected', chat_id = 'x', connected_at = jurah_now(), link_token = null where id = 'ml-05'`);
    expect(r.count).toBe(1);
  });
  it('link_caregiver_must_be_active — a pending caregiver cannot link a chat (E-44)', async () => {
    await rejects(app(S.naserPending), ins('l5', 'caregiver', 'cg-03', 'not_connected'), 'link_caregiver_must_be_active');
    await rejects(SYSTEM, ins('l6', 'caregiver', 'cg-06', 'not_connected'), 'link_caregiver_must_be_active');
  });
  it('chat_id is outside jurah_app’s SELECT grant (never projected)', async () => {
    await rejects(app(S.sara), `select chat_id from messaging_links`, 'permission denied');
  });
});

describe('push and calendar', () => {
  it('push_subscriptions_subject_key — one row per subject', async () => {
    await rejects(SYSTEM, `insert into push_subscriptions (id, subject_type, subject_id, status, permission, created_at) values ('p9', 'patient', 'pt-01', 'active', 'granted', jurah_now())`, 'push_subscriptions_subject_key');
  });
  it('endpoint/keys are outside jurah_app’s SELECT grant; the view omits them', async () => {
    await rejects(app(S.sara), `select endpoint from push_subscriptions`, 'permission denied');
    const r = await probe(app(S.sara), (tx) => tx`select * from push_subscriptions_view`);
    expect(r.length).toBe(1);
    expect(Object.keys(r[0] ?? {})).toEqual(['id', 'subject_type', 'subject_id', 'status', 'permission', 'created_at']);
  });
  it('calendar_subscriptions_token_key', async () => {
    await rejects(SYSTEM, `insert into calendar_subscriptions (patient_id, token, ics_url) values ('pt-01', 'mock-token-cal-pt-03', 'x')`, 'calendar_subscriptions_token_key');
  });
});

describe('audit_events — append-only three ways (E-39)', () => {
  const ins = (msg: string, type = 'signed_in', actor = 'system', scope = "'patient', 'pt-01'") =>
    `insert into audit_events (id, scope, patient_id, actor_role, type, message, created_at) values ('axt', ${scope}, '${actor}', '${type}', '${msg}', jurah_now())`;
  it('audit_message_no_civil_id — no Civil ID in any message', async () => { await rejects(SYSTEM, ins('x 255031200187'), 'audit_message_no_civil_id'); });
  it('audit_patient_scope_has_patient', async () => { await rejects(SYSTEM, ins('x', 'signed_in', 'system', "'patient', null"), 'audit_patient_scope_has_patient'); });
  it('audit_dose_status_actor — dose_status_recorded only by agent/system, even for the owner and the agent', async () => {
    for (const actor of ['patient', 'caregiver', 'reviewer', 'admin']) await rejects(SYSTEM, ins('x', 'dose_status_recorded', actor), 'audit_dose_status_actor');
    await rejects(AGENT, ins('x', 'dose_status_recorded', 'patient'), 'audit_dose_status_actor');
  });
  it('audit_events_immutable — UPDATE and DELETE raise even as the table owner (a zero-row one too)', async () => {
    await rejects(OWNER_NO_SESSION, `update audit_events set message = 'x'`, 'audit_events is append-only');
    await rejects(SYSTEM, `delete from audit_events where id = 'ae-001'`, 'audit_events is append-only');
    await rejects(SYSTEM, `update audit_events set message = 'x' where id = 'no-such-row'`, 'audit_events is append-only');
  });
  it('jurah_app and jurah_agent hold no UPDATE, DELETE or TRUNCATE', async () => {
    for (const as of [app(S.hamad), AGENT]) {
      await rejects(as, `update audit_events set message = 'x'`, 'permission denied');
      await rejects(as, `delete from audit_events`, 'permission denied');
      await rejects(as, `truncate audit_events`, 'permission denied');
    }
  });
  it('POSITIVE: lib/db/audit.ts append() inside withSession() writes one opaque-id row (and rolls back with it)', async () => {
    const id = await withSession({ subjectId: 'pt-01', role: 'patient' }, async (sql) => {
      const newId = await append(sql, { scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type: 'signed_in', message: 'دخول', relatedId: 'pt-01' });
      const [row] = await sql`select iso_kw(created_at) as at from audit_events where id = ${newId}`;
      expect(row?.at).toBe('2026-09-21T09:15:00+03:00');
      throw Object.assign(new Error('rollback'), { newId });
    }).catch((e: { newId?: string }) => e.newId);
    expect(id).toMatch(/^ae_[0-9A-HJKMNP-TV-Z]{26}$/);
  });
});

describe('settings — settings_tracking_requires_link (G10: quiet, never an error)', () => {
  it('حمد turning tracking on with no connected link: the statement succeeds and the flag stays false', async () => {
    const r = await accepts(app(S.hamad), `update settings set adherence_check_in_enabled = true where patient_id = 'pt-01'`,
      `select adherence_check_in_enabled from settings where patient_id = 'pt-01'`);
    expect(r).toEqual({ count: 1, value: false });
  });
  it('an insert with tracking on and no link is reset to false (بدر)', async () => {
    const r = await accepts(SYSTEM, `insert into settings (patient_id, adherence_check_in_enabled) values ('pt-04', true)`,
      `select adherence_check_in_enabled from settings where patient_id = 'pt-04'`);
    expect(r.value).toBe(false);
  });
  it('فاطمة: latest link is pending (ml-05) → still refused', async () => {
    const r = await accepts(app(S.fatima), `update settings set adherence_check_in_enabled = true where patient_id = 'pt-02'`,
      `select adherence_check_in_enabled from settings where patient_id = 'pt-02'`);
    expect(r.value).toBe(false);
  });
  it('POSITIVE: with a connected link (سارة) the flag holds', async () => {
    const r = await accepts(app(S.sara), `update settings set adherence_check_in_enabled = false where patient_id = 'pt-03'; update settings set adherence_check_in_enabled = true where patient_id = 'pt-03'`,
      `select adherence_check_in_enabled from settings where patient_id = 'pt-03'`);
    expect(r.value).toBe(true);
  });
  it('a caregiver cannot write the patient’s settings (RLS 0 rows); a non-column is an error', async () => {
    expect((await accepts(app(S.abdullah), `update settings set refill_alerts_enabled = false where patient_id = 'pt-01'`)).count).toBe(0);
    await rejects(app(S.hamad), `update settings set role = 'admin' where patient_id = 'pt-01'`, 'column "role" of relation "settings" does not exist');
  });
});

describe('accounts, patients and the server-side tables', () => {
  it('accounts_civil_id_key / accounts_civil_id_shape / accounts_assigned_roles_clinic_only', async () => {
    await rejects(SYSTEM, `insert into accounts (id, civil_id, name) values ('ax', '255031200187', 'x')`, 'accounts_civil_id_key');
    await rejects(SYSTEM, `insert into accounts (id, civil_id, name) values ('ax', '2550312', 'x')`, 'accounts_civil_id_shape');
    await rejects(SYSTEM, `insert into accounts (id, civil_id, name, assigned_roles) values ('ax', '299999900001', 'x', '{patient}')`, 'accounts_assigned_roles_clinic_only');
  });
  it('patients_civil_id_fkey / patients_civil_id_key — a patient always has an account, once', async () => {
    await rejects(SYSTEM, `insert into patients (id, civil_id, name, language, onboarding_completed) values ('ptx', '299999900001', 'x', 'ar', false)`, 'patients_civil_id_fkey');
    await rejects(SYSTEM, `insert into patients (id, civil_id, name, language, onboarding_completed) values ('ptx', '255031200187', 'x', 'ar', false)`, 'patients_civil_id_key');
  });
  it('jurah_app can never select a patient Civil ID (column grant)', async () => {
    await rejects(app(S.hamad), `select civil_id from patients`, 'permission denied');
  });
  it('sessions_role_or_pending', async () => {
    await rejects(SYSTEM, `insert into sessions (id, subject_id, expires_at) values ('s1', 'pt-01', jurah_now())`, 'sessions_role_or_pending');
  });
  it('civil_id_test_list_shape, and jurah_app cannot read the list', async () => {
    await rejects(SYSTEM, `insert into civil_id_test_list values ('123')`, 'civil_id_test_list_shape');
    await rejects(app(S.hamad), `select * from civil_id_test_list`, 'permission denied');
  });
  it('prescription_drafts_patient_id_fkey', async () => {
    await rejects(SYSTEM, `insert into prescription_drafts (draft_id, patient_id, prescription, confident) values ('d1', 'pt-99', '{}', true)`, 'prescription_drafts_patient_id_fkey');
  });
  it('snapshots are scoped to the caller (D-014)', async () => {
    await rejects(app(S.naserPending), `insert into snapshots (subject_id, key, data, as_of) values ('pt-01', 'getPatient:pt-01', '{}', jurah_now())`, 'row-level security');
  });
});

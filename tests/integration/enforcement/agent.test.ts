/**
 * P2-WP7 — the agent integration point against the REAL database: the six routes of
 * app/api/agent/**, called through their real route.ts modules with JURAH_DATA_BACKEND=postgres
 * and the agent bearer from the environment (never printed). User sessions ride in through
 * lib/session's script jar (setScriptSession), which is exactly what getSession reads outside a
 * Next request.
 *
 * Mutating tests commit (each route runs its own transaction); the harness re-seeds per file and
 * every assertion here reads relative counts or its own rows. Without JURAH_DATABASE_URL every test
 * FAILS loudly (NOT A PASS) — never skipped.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import type { Session } from '@/types/views';

const TOKEN = () => (process.env.JURAH_AGENT_TOKEN ?? '').trim();
const agentHeaders = () => ({ authorization: `Bearer ${TOKEN()}`, 'content-type': 'application/json' });
const USERS: Record<string, Session> = {
  hamad: { subjectId: 'pt-01', role: 'patient' } as Session,
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } as Session,
  khalid_reviewer: { subjectId: 'acc-10', role: 'reviewer' } as Session,
  dana_admin: { subjectId: 'acc-11', role: 'admin' } as Session,
};
const post = (path: string, body: unknown, headers: Record<string, string>) =>
  new Request(`http://localhost:3000${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
const get = (path: string, headers: Record<string, string>) => new Request(`http://localhost:3000${path}`, { headers });

const routes = async () => ({
  dose: await import('@/app/api/agent/doses/[doseId]/status/route'),
  recompute: await import('@/app/api/agent/schedule/recompute/route'),
  alerts: await import('@/app/api/agent/alerts/route'),
  rx: await import('@/app/api/agent/prescriptions/route'),
  elig: await import('@/app/api/agent/check-in-eligibility/route'),
  recipients: await import('@/app/api/agent/alert-recipients/route'),
});

async function callAll(headers: Record<string, string>): Promise<number[]> {
  const r = await routes();
  return [
    (await r.dose.POST(post('/api/agent/doses/rx-003-20260921-0800/status', { status: 'taken_on_time', source: 'adherence_agent' }, headers), { params: Promise.resolve({ doseId: 'rx-003-20260921-0800' }) })).status,
    (await r.recompute.POST(post('/api/agent/schedule/recompute', { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260919-0700' }, headers))).status,
    (await r.alerts.POST(post('/api/agent/alerts', { patientId: 'pt-01', involvedPrescriptionIds: ['rx-001'], severity: 'info', description: 'd', sourceCitation: '', reviewStatus: 'auto_cleared' }, headers))).status,
    (await r.rx.POST(post('/api/agent/prescriptions', { patientId: 'pt-01', needsReview: true, prescription: { source: { facilityName: 'f', sector: 'public' }, drug: { genericName: 'X' }, dosePerAdministration: 1, durationDays: 7, dosingPattern: 'daily' } }, headers))).status,
    (await r.elig.GET(get('/api/agent/check-in-eligibility', headers))).status,
    (await r.recipients.GET(get('/api/agent/alert-recipients?patientId=pt-01', headers))).status,
  ];
}

async function dosesDigest(): Promise<string> {
  const [r] = await getSql()`select count(*)::int as n, md5(string_agg(d.id || d.status::text || coalesce(d.recorded_at::text, ''), ',' order by d.id)) as h from doses d`;
  return `${r?.n}:${r?.h}`;
}

beforeAll(() => {
  vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
  if (!TOKEN()) throw new Error('JURAH_AGENT_TOKEN is not set — the agent routes refuse everyone; NOT A PASS');
});
afterEach(() => setScriptSession(null));

describe('agent', () => {
  it('every route × every user role → 403; no session, no bearer → 401; nothing written', async () => {
    const before = await dosesDigest();
    const [audit0] = await getSql()`select count(*)::int as n from audit_events`;
    for (const [who, s] of Object.entries(USERS)) {
      setScriptSession(s);
      expect({ who, statuses: await callAll({ 'content-type': 'application/json' }) }).toEqual({ who, statuses: [403, 403, 403, 403, 403, 403] });
      expect({ who, withBearer: await callAll(agentHeaders()) }).toEqual({ who, withBearer: [403, 403, 403, 403, 403, 403] });
    }
    setScriptSession(null);
    expect(await callAll({ 'content-type': 'application/json' })).toEqual([401, 401, 401, 401, 401, 401]);
    expect(await callAll({ authorization: 'Bearer wrong' })).toEqual([401, 401, 401, 401, 401, 401]);
    expect(await dosesDigest()).toBe(before);
    const [audit1] = await getSql()`select count(*)::int as n from audit_events`;
    expect(audit1?.n).toBe(audit0?.n);
  });

  it('0008: jurah_agent reads no Civil ID and nothing of accounts', async () => {
    const [g] = await getSql()`select has_column_privilege('jurah_agent','patients','civil_id','SELECT') as p,
      has_column_privilege('jurah_agent','caregivers','civil_id','SELECT') as c,
      has_table_privilege('jurah_agent','accounts','SELECT') as a,
      has_column_privilege('jurah_agent','doses','status','UPDATE') as s,
      has_table_privilege('jurah_agent','doses','DELETE') as d`;
    expect(g).toEqual({ p: false, c: false, a: false, s: true, d: false });
  });

  it('a tracked:false dose → 409 untracked_dose, row unchanged', async () => {
    const { dose } = await routes();
    const res = await dose.POST(post('/x', { status: 'taken_on_time', recordedAt: '2026-09-21T08:05:00+03:00', source: 'adherence_agent' }, agentHeaders()), { params: Promise.resolve({ doseId: 'rx-002-20260921-0800' }) });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'untracked_dose' });
    const [d] = await getSql()`select status::text || '|' || tracked as r from doses where id = 'rx-002-20260921-0800'`;
    expect(d?.r).toBe('upcoming|false');
  });

  it("an alert with reviewStatus 'reviewed' → 422 and no row; a valid one → 201, delivered [], alert_raised by the agent", async () => {
    const { alerts } = await routes();
    const body = { patientId: 'pt-01', involvedPrescriptionIds: ['rx-001', 'rx-002'], severity: 'danger', description: 'd', sourceCitation: '', reviewStatus: 'pending_medical_review' };
    const [n0] = await getSql()`select count(*)::int as n from interaction_alerts`;
    const bad = await alerts.POST(post('/x', { ...body, reviewStatus: 'reviewed' }, agentHeaders()));
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ error: 'invalid_body', field: 'reviewStatus', reason: 'agent_may_not_review' });
    const [n1] = await getSql()`select count(*)::int as n from interaction_alerts`;
    expect(n1?.n).toBe(n0?.n);
    const ok = await alerts.POST(post('/x', body, agentHeaders()));
    expect(ok.status).toBe(201);
    const j = (await ok.json()) as { alert: { id: string; reviewStatus: string; sourceCitation: string }; delivered: unknown[] };
    expect(j.delivered).toEqual([]);
    expect(j.alert.reviewStatus).toBe('pending_medical_review');
    const [a] = await getSql()`select actor_role::text as actor, message from audit_events where type = 'alert_raised' and related_id = ${j.alert.id}`;
    expect(a).toEqual({ actor: 'agent', message: 'تنبيه تعارض خطير: Warfarin و Ibuprofen' });
  });

  it('alert-recipients never lists a pending caregiver (E-07, HTTP half): pt-01 → cg-01 and cg-02 only; unknown patient 404', async () => {
    const { recipients } = await routes();
    const res = await recipients.GET(get('/api/agent/alert-recipients?patientId=pt-01', agentHeaders()));
    expect(res.status).toBe(200);
    const text = await res.text();
    const j = JSON.parse(text) as { caregivers: { caregiverId: string }[] };
    expect(j.caregivers.map((c) => c.caregiverId)).toEqual(['cg-01', 'cg-02']);
    for (const id of ['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07', 'cg-08']) expect(text).not.toContain(`"${id}"`);
    expect((await recipients.GET(get('/api/agent/alert-recipients?patientId=pt-99', agentHeaders()))).status).toBe(404);
  });

  it('check-in-eligibility returns exactly سارة for the seed', async () => {
    const { elig } = await routes();
    const res = await elig.GET(get('/api/agent/check-in-eligibility', agentHeaders()));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([{ patientId: 'pt-03', chatId: 'seed-synthetic-chat-ml-03', language: 'ar', frequency: 'daily' }]);
  });

  it('prescriptions: an unflagged extraction → 201 with its doses and prescription_added by the agent; a mismatch → 422 naming the constraint', async () => {
    const { rx } = await routes();
    const prescription = {
      source: { facilityName: 'Mubarak Al-Kabeer Hospital pharmacy', sector: 'public' }, drug: { genericName: 'Amoxicillin', strengthMg: 500, strengthUnit: 'mg' },
      dosePerAdministration: 1, frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily', startDate: '2026-09-21', doseTimes: ['08:00', '14:00', '20:00'],
    };
    const ok = await rx.POST(post('/x', { patientId: 'pt-01', needsReview: false, prescription }, agentHeaders()));
    expect(ok.status).toBe(201);
    const j = (await ok.json()) as { prescription: { id: string; source: unknown }; doseCount: number };
    expect(j.doseCount).toBe(21);
    expect(j.prescription.source).toEqual(prescription.source);
    const [d] = await getSql()`select count(*)::int as n, bool_and(not tracked) as untracked, bool_and(status = 'upcoming') as up from doses where prescription_id = ${j.prescription.id}`;
    expect(d).toEqual({ n: 21, untracked: true, up: true }); // حمد tracks nothing: tracked is fixed at generation (rule 3)
    const [a] = await getSql()`select actor_role::text as actor, message from audit_events where type = 'prescription_added' and related_id = ${j.prescription.id}`;
    expect(a).toEqual({ actor: 'agent', message: 'أُضيفت وصفة Amoxicillin' });
    const bad = await rx.POST(post('/x', { patientId: 'pt-01', needsReview: false, prescription: { ...prescription, doseTimes: ['08:00', '20:00'] } }, agentHeaders()));
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ error: 'constraint_violation', constraint: 'rx_dose_times_match_frequency' });
  });

  it('recompute: a non-miss → 409; discontinuation of rx-003 → 200, recorded doses kept, prescription_discontinued by the agent', async () => {
    const { recompute } = await routes();
    const notMiss = await recompute.POST(post('/x', { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260920-0700' }, agentHeaders()));
    expect(notMiss.status).toBe(409);
    const res = await recompute.POST(post('/x', { prescriptionId: 'rx-003', reason: 'discontinued', discontinuedAt: '2026-09-21', discontinuedReason: 'الطبيب أوقف الدواء' }, agentHeaders()));
    expect(res.status).toBe(200);
    const j = (await res.json()) as { cancelledDoseIds: string[] };
    expect(j.cancelledDoseIds.length).toBe(162);
    const [a] = await getSql()`select actor_role::text as actor, message from audit_events where type = 'prescription_discontinued' and related_id = 'rx-003'`;
    expect(a).toEqual({ actor: 'agent', message: 'أُوقفت وصفة Metformin' });
    const again = await recompute.POST(post('/x', { prescriptionId: 'rx-003', reason: 'discontinued', discontinuedReason: 'again' }, agentHeaders()));
    expect(again.status).toBe(409);
  });
});

// @vitest-environment node
/**
 * P2-WP7 — the six agent route handlers, called through their real route.ts modules with Next's
 * own request objects. lib/session's getSession and lib/data/pg/agent.ts are replaced by stubs, so
 * these tests prove the HANDLER logic: the gate (403 for every user session, 401 for a missing or
 * wrong bearer — before any body is read or any statement runs), 422 validation, 503 under the mock
 * backend, and how each database outcome maps to a status. The SQL is proved against the database
 * in tests/integration/enforcement/{agent,dose}.test.ts and by hand (docs/backend-notes/p2-wp7.md).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from '@/types/views';

const TOKEN = 'unit-test-agent-bearer-0123456789';
const h = vi.hoisted(() => ({
  session: null as unknown,
  sessionThrows: false,
  dose: vi.fn(async (): Promise<unknown> => ({ kind: 'ok', dose: { id: 'rx-009-20260921-1300', status: 'taken_on_time' } })),
  recompute: vi.fn(async (): Promise<unknown> => ({ kind: 'recomputed', changed: false, addedIds: [], droppedIds: [] })),
  alert: vi.fn(async (): Promise<unknown> => ({ kind: 'ok', alert: { id: 'ia_X', patientId: 'pt-01', severity: 'danger' } })),
  rx: vi.fn(async (): Promise<unknown> => ({ kind: 'ok', prescription: { id: 'rx_X' }, doseCount: 21 })),
  elig: vi.fn(async (): Promise<unknown> => [{ patientId: 'pt-03', chatId: 'c', language: 'ar', frequency: 'daily' }]),
  recipients: vi.fn(async (): Promise<unknown> => null),
  dosesForDay: vi.fn(async (): Promise<unknown> => []),
  activeRx: vi.fn(async (): Promise<unknown> => []),
  voiceTurn: vi.fn(async (): Promise<string | null> => 'vt_01TEST'),
  push: vi.fn(async (target: unknown, payload: unknown) => { void target; void payload; return { sent: true, statusCode: 201 }; }),
}));

vi.mock('@/lib/session', () => ({
  getSession: async () => {
    if (h.sessionThrows) throw new Error('db down');
    return h.session;
  },
}));
vi.mock('@/lib/data/pg/agent', () => ({
  recordDoseStatus: h.dose,
  recomputeSchedule: h.recompute,
  insertAlert: h.alert,
  insertExtractedPrescription: h.rx,
  checkInEligibility: h.elig,
  recipientsFor: h.recipients,
  trackedDosesForDay: h.dosesForDay,
  activePrescriptions: h.activeRx,
  insertVoiceTurn: h.voiceTurn,
}));
vi.mock('@/lib/push/send', async (orig) => ({ ...(await orig<typeof import('@/lib/push/send')>()), sendPush: h.push }));

const USERS: Record<string, Session> = {
  'patient (حمد)': { subjectId: 'pt-01', role: 'patient' } as Session,
  'caregiver (عبدالله)': { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } as Session,
  'reviewer (د. خالد)': { subjectId: 'acc-10', role: 'reviewer' } as Session,
  'admin (م. دانة)': { subjectId: 'acc-11', role: 'admin' } as Session,
  'pending-only (ناصر)': { subjectId: 'cg-03', pendingInvitationOnly: true } as Session,
};

const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL(url, 'http://localhost:3000'), init);
const auth = (t = TOKEN) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const post = (url: string, body: unknown, headers: Record<string, string> = auth()) => req(url, { method: 'POST', headers, body: JSON.stringify(body) });
const params = <T,>(p: T) => ({ params: Promise.resolve(p) });

const DOSE_BODY = { status: 'taken_on_time', recordedAt: '2026-09-21T13:05:00+03:00', source: 'adherence_agent' };
const RECOMPUTE_BODY = { prescriptionId: 'rx-008', reason: 'reported_miss', missedDoseId: 'rx-008-20260919-0700' };
const ALERT_BODY = { patientId: 'pt-01', involvedPrescriptionIds: ['rx-001', 'rx-002'], severity: 'danger', description: 'd', sourceCitation: '', reviewStatus: 'pending_medical_review' };
const RX_BODY = {
  patientId: 'pt-01', needsReview: false, prescription: {
    source: { facilityName: 'Mubarak Al-Kabeer Hospital pharmacy', sector: 'public' }, drug: { genericName: 'Amoxicillin', strengthMg: 500 },
    dosePerAdministration: 1, frequencyPerDay: 3, durationDays: 7, dosingPattern: 'daily', startDate: '2026-09-21', doseTimes: ['08:00', '14:00', '20:00'],
  },
};

/** Every route, called with the given headers (a valid body where there is one). */
async function callAll(headers: Record<string, string>): Promise<Record<string, number>> {
  const dose = await import('@/app/api/agent/doses/[doseId]/status/route');
  const recompute = await import('@/app/api/agent/schedule/recompute/route');
  const alerts = await import('@/app/api/agent/alerts/route');
  const rx = await import('@/app/api/agent/prescriptions/route');
  const elig = await import('@/app/api/agent/check-in-eligibility/route');
  const recips = await import('@/app/api/agent/alert-recipients/route');
  const pdoses = await import('@/app/api/agent/patients/[patientId]/doses/route');
  const prx = await import('@/app/api/agent/patients/[patientId]/prescriptions/route');
  return {
    'POST doses/{id}/status': (await dose.POST(post('/api/agent/doses/rx-003-20260921-0800/status', DOSE_BODY, headers), params({ doseId: 'rx-003-20260921-0800' }))).status,
    'POST schedule/recompute': (await recompute.POST(post('/api/agent/schedule/recompute', RECOMPUTE_BODY, headers))).status,
    'POST alerts': (await alerts.POST(post('/api/agent/alerts', ALERT_BODY, headers))).status,
    'POST prescriptions': (await rx.POST(post('/api/agent/prescriptions', RX_BODY, headers))).status,
    'GET check-in-eligibility': (await elig.GET(req('/api/agent/check-in-eligibility', { headers }))).status,
    'GET alert-recipients': (await recips.GET(req('/api/agent/alert-recipients?patientId=pt-01', { headers }))).status,
    'GET patients/{id}/doses': (await pdoses.GET(req('/api/agent/patients/pt-03/doses?date=2026-09-21', { headers }), params({ patientId: 'pt-03' }))).status,
    'GET patients/{id}/prescriptions': (await prx.GET(req('/api/agent/patients/pt-01/prescriptions', { headers }), params({ patientId: 'pt-01' }))).status,
  };
}
const every = (status: number) => ({
  'POST doses/{id}/status': status, 'POST schedule/recompute': status, 'POST alerts': status, 'POST prescriptions': status,
  'GET check-in-eligibility': status, 'GET alert-recipients': status,
  'GET patients/{id}/doses': status, 'GET patients/{id}/prescriptions': status,
});
const writes = () => [h.dose, h.recompute, h.alert, h.rx, h.elig, h.recipients, h.dosesForDay, h.activeRx];

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('JURAH_AGENT_TOKEN', TOKEN);
  vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
  vi.stubEnv('JURAH_VAPID_PRIVATE_KEY', '');
  vi.stubEnv('JURAH_BOT_TOKEN', '');
  h.session = null;
  h.sessionThrows = false;
  for (const f of [...writes(), h.push, h.voiceTurn]) f.mockClear();
  h.voiceTurn.mockResolvedValue('vt_01TEST');
});
afterEach(() => vi.unstubAllEnvs());

describe('the gate — every route × every user role', () => {
  for (const [who, session] of Object.entries(USERS)) {
    it(`${who}: session cookie, no bearer → 403 on every route; nothing reaches the database`, async () => {
      h.session = session;
      expect(await callAll({ 'content-type': 'application/json' })).toEqual(every(403));
      for (const f of writes()) expect(f).not.toHaveBeenCalled();
    });
    it(`${who}: session cookie WITH the valid bearer → still 403, never 200`, async () => {
      h.session = session;
      expect(await callAll(auth())).toEqual(every(403));
      for (const f of writes()) expect(f).not.toHaveBeenCalled();
    });
  }
  it('no session and no bearer → 401 on every route', async () => {
    expect(await callAll({ 'content-type': 'application/json' })).toEqual(every(401));
    for (const f of writes()) expect(f).not.toHaveBeenCalled();
  });
  it('a wrong bearer, a wrong scheme, and the job token → 401', async () => {
    vi.stubEnv('JURAH_JOB_TOKEN', 'the-job-token-is-not-the-agent-token');
    expect(await callAll(auth('wrong-token-of-the-same-length-xx'))).toEqual(every(401));
    expect(await callAll({ authorization: `Basic ${TOKEN}` })).toEqual(every(401));
    expect(await callAll(auth('the-job-token-is-not-the-agent-token'))).toEqual(every(401));
  });
  it('an unset agent token refuses everyone, the empty bearer included (fail closed)', async () => {
    vi.stubEnv('JURAH_AGENT_TOKEN', '');
    expect(await callAll({ authorization: 'Bearer ' })).toEqual(every(401));
  });
  it('a presented session cookie whose lookup FAILS is refused 403, never let through', async () => {
    h.sessionThrows = true;
    expect(await callAll({ ...auth(), cookie: 'jurah.session=abc.def' })).toEqual(every(403));
    for (const f of writes()) expect(f).not.toHaveBeenCalled();
  });
  it('the agent bearer, no session → the work runs', async () => {
    h.recipients.mockResolvedValueOnce({ patientId: 'pt-01', language: 'ar', targets: [{ subjectType: 'patient', subjectId: 'pt-01', chatId: null, push: null }] });
    const s = await callAll(auth());
    expect(s).toEqual({ ...every(200), 'POST alerts': 201, 'POST prescriptions': 201 });
  });
});

describe('the mock backend (D-020): refusals are real, the work is 503', () => {
  it('401/403/422 happen first; a valid agent call answers 503 and touches nothing', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'mock');
    expect(await callAll(auth())).toEqual(every(503));
    expect(await callAll({})).toEqual(every(401));
    h.session = USERS['patient (حمد)'];
    expect(await callAll({})).toEqual(every(403));
    h.session = null;
    const { POST } = await import('@/app/api/agent/alerts/route');
    expect((await POST(post('/api/agent/alerts', { ...ALERT_BODY, reviewStatus: 'reviewed' }))).status).toBe(422);
    for (const f of writes()) expect(f).not.toHaveBeenCalled();
  });
});

describe('POST /api/agent/doses/{doseId}/status', () => {
  const load = () => import('@/app/api/agent/doses/[doseId]/status/route');
  it('200 with the written dose; the id comes from the path, the source is fixed', async () => {
    const { POST } = await load();
    const res = await POST(post('/x', DOSE_BODY), params({ doseId: 'rx-009-20260921-1300' }));
    expect(res.status).toBe(200);
    expect(h.dose).toHaveBeenCalledWith('rx-009-20260921-1300', { status: 'taken_on_time', recordedAt: '2026-09-21T13:05:00+03:00', source: 'adherence_agent' });
  });
  it("tracked:false → 409 { error: 'untracked_dose' } (the database's dose_untracked_has_no_status)", async () => {
    h.dose.mockResolvedValueOnce({ kind: 'untracked' });
    const { POST } = await load();
    const res = await POST(post('/x', DOSE_BODY), params({ doseId: 'rx-002-20260921-0800' }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'untracked_dose' });
  });
  it('unknown dose → 404; another constraint → 422 naming it; bad bodies → 422 before the database', async () => {
    const { POST } = await load();
    h.dose.mockResolvedValueOnce({ kind: 'not_found' });
    expect((await POST(post('/x', DOSE_BODY), params({ doseId: 'nope' }))).status).toBe(404);
    h.dose.mockResolvedValueOnce({ kind: 'refused', constraint: 'dose_taken_late_has_recorded_at' });
    const r = await POST(post('/x', DOSE_BODY), params({ doseId: 'd' }));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: 'constraint_violation', constraint: 'dose_taken_late_has_recorded_at' });
    h.dose.mockClear();
    for (const body of [{ ...DOSE_BODY, status: 'upcoming' }, { ...DOSE_BODY, source: 'system' }, { status: 'taken_late', source: 'adherence_agent' }, { ...DOSE_BODY, actor: 'patient' }]) {
      expect((await POST(post('/x', body), params({ doseId: 'd' }))).status).toBe(422);
    }
    const notJson = await POST(req('/x', { method: 'POST', headers: auth(), body: 'not json' }), params({ doseId: 'd' }));
    expect(notJson.status).toBe(422);
    expect(h.dose).not.toHaveBeenCalled();
  });
});

describe('POST /api/agent/schedule/recompute', () => {
  const load = () => import('@/app/api/agent/schedule/recompute/route');
  it('maps every engine outcome to a status', async () => {
    const { POST } = await load();
    const cases: Array<[unknown, number]> = [
      [{ kind: 'recomputed', changed: false, addedIds: [], droppedIds: [] }, 200],
      [{ kind: 'discontinued', prescription: {}, cancelledDoseIds: ['a'] }, 200],
      [{ kind: 'not_found' }, 404],
      [{ kind: 'dose_not_found' }, 404],
      [{ kind: 'dose_of_other_prescription' }, 422],
      [{ kind: 'not_a_recorded_miss' }, 409],
      [{ kind: 'not_active' }, 409],
      [{ kind: 'invalid_date' }, 422],
    ];
    for (const [outcome, status] of cases) {
      h.recompute.mockResolvedValueOnce(outcome);
      expect((await POST(post('/x', RECOMPUTE_BODY))).status).toBe(status);
    }
  });
  it('a body without a reason, or a discontinuation without a reason text, is 422 before the engine', async () => {
    const { POST } = await load();
    expect((await POST(post('/x', { prescriptionId: 'rx-003' }))).status).toBe(422);
    expect((await POST(post('/x', { prescriptionId: 'rx-003', reason: 'discontinued' }))).status).toBe(422);
    expect(h.recompute).not.toHaveBeenCalled();
  });
});

describe('POST /api/agent/alerts', () => {
  const load = () => import('@/app/api/agent/alerts/route');
  it("reviewStatus 'reviewed' and any reviewer field → 422 before the database", async () => {
    const { POST } = await load();
    const r = await POST(post('/x', { ...ALERT_BODY, reviewStatus: 'reviewed' }));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: 'invalid_body', field: 'reviewStatus', reason: 'agent_may_not_review' });
    for (const f of ['reviewerDecision', 'reviewerNote', 'reviewedAt', 'reviewedBy']) {
      expect((await POST(post('/x', { ...ALERT_BODY, [f]: 'x' }))).status).toBe(422);
    }
    expect(h.alert).not.toHaveBeenCalled();
  });
  it('while push and chat are simulated: 201 and delivered: [] — no recipient is even read', async () => {
    const { POST } = await load();
    const r = await POST(post('/x', ALERT_BODY));
    expect(r.status).toBe(201);
    expect((await r.json()).delivered).toEqual([]);
    expect(h.recipients).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
  });
  it('E-06 (route half): a configured push carries exactly { title, body, url } — no actions — to ACTIVE recipients only', async () => {
    vi.stubEnv('JURAH_VAPID_PRIVATE_KEY', 'unit-test-vapid-private-key');
    h.recipients.mockResolvedValueOnce({
      patientId: 'pt-01', language: 'ar',
      targets: [
        { subjectType: 'patient', subjectId: 'pt-01', chatId: null, push: { endpoint: 'https://push.example/a', p256dh: 'k', auth: 'a' } },
        { subjectType: 'caregiver', subjectId: 'cg-01', chatId: 'c1', push: { endpoint: 'https://push.example/b', p256dh: 'k', auth: 'a' } },
      ],
    });
    const { POST } = await load();
    const r = await POST(post('/x', ALERT_BODY));
    expect(r.status).toBe(201);
    expect((await r.json()).delivered).toEqual([
      { subjectType: 'patient', subjectId: 'pt-01', channel: 'push' },
      { subjectType: 'caregiver', subjectId: 'cg-01', channel: 'push' },
    ]);
    expect(h.recipients).toHaveBeenCalledWith('pt-01');
    expect(h.push).toHaveBeenCalledTimes(2);
    const payloads = h.push.mock.calls.map((c) => c[1] as Record<string, unknown>);
    for (const p of payloads) expect(Object.keys(p)).toEqual(['title', 'body', 'url']);
    expect(payloads.map((p) => p.url)).toEqual(['/ar/app/safety/ia_X', '/ar/care/alerts/ia_X']);
    expect(JSON.stringify(payloads)).not.toMatch(/action/i);
  });
  it('an involved prescription of another patient → 422; a constraint → 422 naming it', async () => {
    const { POST } = await load();
    h.alert.mockResolvedValueOnce({ kind: 'prescriptions_not_of_patient', ids: ['rx-008'] });
    const a = await POST(post('/x', ALERT_BODY));
    expect(a.status).toBe(422);
    expect((await a.json()).ids).toEqual(['rx-008']);
    h.alert.mockResolvedValueOnce({ kind: 'refused', constraint: 'interaction_alerts_patient_id_fkey' });
    expect((await (await POST(post('/x', ALERT_BODY))).json()).constraint).toBe('interaction_alerts_patient_id_fkey');
  });
});

describe('POST /api/agent/prescriptions', () => {
  const load = () => import('@/app/api/agent/prescriptions/route');
  it('201 on success; a database constraint → 422 naming it; no source → 422 (CR-042)', async () => {
    const { POST } = await load();
    const ok = await POST(post('/x', RX_BODY));
    expect(ok.status).toBe(201);
    expect(await ok.json()).toEqual({ prescription: { id: 'rx_X' }, doseCount: 21 });
    h.rx.mockResolvedValueOnce({ kind: 'refused', constraint: 'rx_dose_times_match_frequency' });
    const bad = await POST(post('/x', RX_BODY));
    expect(bad.status).toBe(422);
    expect(await bad.json()).toEqual({ error: 'constraint_violation', constraint: 'rx_dose_times_match_frequency' });
    h.rx.mockClear();
    const { source: _s, ...noSource } = RX_BODY.prescription;
    void _s;
    expect((await POST(post('/x', { ...RX_BODY, prescription: noSource }))).status).toBe(422);
    expect(h.rx).not.toHaveBeenCalled();
  });
});

describe('GET /api/agent/alert-recipients', () => {
  const load = () => import('@/app/api/agent/alert-recipients/route');
  it('404 for an unknown patient, 422 without patientId, and the push keys never leave the server', async () => {
    const { GET } = await load();
    expect((await GET(req('/api/agent/alert-recipients?patientId=pt-99', { headers: auth() }))).status).toBe(404);
    expect((await GET(req('/api/agent/alert-recipients', { headers: auth() }))).status).toBe(422);
    h.recipients.mockResolvedValueOnce({
      patientId: 'pt-01', language: 'ar',
      targets: [
        { subjectType: 'patient', subjectId: 'pt-01', chatId: null, push: null },
        { subjectType: 'caregiver', subjectId: 'cg-01', chatId: 'seed-synthetic-chat-ml-04', push: { endpoint: 'https://push.example/secret', p256dh: 'k', auth: 'a' } },
        { subjectType: 'caregiver', subjectId: 'cg-02', chatId: null, push: null },
      ],
    });
    const r = await GET(req('/api/agent/alert-recipients?patientId=pt-01', { headers: auth() }));
    const text = await r.text();
    expect(JSON.parse(text)).toEqual({
      patientId: 'pt-01',
      patient: { chatId: null, push: false },
      caregivers: [{ caregiverId: 'cg-01', chatId: 'seed-synthetic-chat-ml-04', push: true }, { caregiverId: 'cg-02', chatId: null, push: false }],
    });
    expect(text).not.toContain('push.example');
  });
});

describe('GET /api/agent/patients/{patientId}/doses and /prescriptions (CR-062)', () => {
  const loadDoses = () => import('@/app/api/agent/patients/[patientId]/doses/route');
  const loadRx = () => import('@/app/api/agent/patients/[patientId]/prescriptions/route');
  it('doses: 422 without or with a malformed date, before the database; never defaults to a clock', async () => {
    const { GET } = await loadDoses();
    for (const q of ['', '?date=', '?date=2026-9-21', '?date=2026-02-30', '?date=2026-09-21T08:00:00%2B03:00']) {
      const r = await GET(req(`/api/agent/patients/pt-03/doses${q}`, { headers: auth() }), params({ patientId: 'pt-03' }));
      expect(r.status).toBe(422);
      expect(await r.json()).toEqual({ error: 'invalid_body', field: 'date', reason: 'not_an_iso_date' });
    }
    expect(h.dosesForDay).not.toHaveBeenCalled();
  });
  it('doses: 404 for an unknown patient; 200 passes the path id and the date through', async () => {
    const { GET } = await loadDoses();
    h.dosesForDay.mockResolvedValueOnce(null);
    expect((await GET(req('/api/agent/patients/pt-99/doses?date=2026-09-21', { headers: auth() }), params({ patientId: 'pt-99' }))).status).toBe(404);
    const dose = { id: 'rx-008-20260921-0700', prescriptionId: 'rx-008', scheduledAt: '2026-09-21T07:00:00+03:00', status: 'upcoming' };
    h.dosesForDay.mockResolvedValueOnce([dose]);
    const r = await GET(req('/api/agent/patients/pt-03/doses?date=2026-09-21', { headers: auth() }), params({ patientId: 'pt-03' }));
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ patientId: 'pt-03', date: '2026-09-21', doses: [dose] });
    expect(h.dosesForDay).toHaveBeenLastCalledWith('pt-03', '2026-09-21');
  });
  it('prescriptions: 404 for an unknown patient; 200 returns the list as the database gave it', async () => {
    const { GET } = await loadRx();
    h.activeRx.mockResolvedValueOnce(null);
    expect((await GET(req('/api/agent/patients/pt-99/prescriptions', { headers: auth() }), params({ patientId: 'pt-99' }))).status).toBe(404);
    const list = [{ id: 'rx-001', needsReview: false }, { id: 'rx-006', needsReview: true }];
    h.activeRx.mockResolvedValueOnce(list);
    const r = await GET(req('/api/agent/patients/pt-01/prescriptions', { headers: auth() }), params({ patientId: 'pt-01' }));
    expect(await r.json()).toEqual({ patientId: 'pt-01', prescriptions: list });
  });
  it('both are read-only: each module exports GET and no write verb', async () => {
    for (const m of [await loadDoses(), await loadRx()]) {
      expect(Object.keys(m).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(['GET']);
    }
  });
});

describe('CR-069 POST /api/agent/patients/{id}/voice-turns — one Alexa turn for the patient’s screen', () => {
  const load = () => import('@/app/api/agent/patients/[patientId]/voice-turns/route');
  const TURN = { topic: 'today', language: 'ar', reply: 'عندك اليوم 3 جرعات…' };
  const call = async (body: unknown, headers: Record<string, string> = auth(), patientId = 'pt-03') =>
    (await load()).POST(post(`/api/agent/patients/${patientId}/voice-turns`, body, headers), params({ patientId }));

  it('every user session is 403 and no bearer is 401 — nothing is written', async () => {
    for (const s of Object.values(USERS)) {
      h.session = s;
      expect((await call(TURN, { 'content-type': 'application/json', cookie: 'jurah.session=x' })).status).toBe(403);
    }
    h.session = null;
    expect((await call(TURN, { 'content-type': 'application/json' })).status).toBe(401);
    expect(h.voiceTurn).not.toHaveBeenCalled();
  });
  it('422 before the database: a topic outside the list, another language, an empty or too long reply, an extra key', async () => {
    for (const bad of [{ ...TURN, topic: 'record_dose' }, { ...TURN, language: 'fr' }, { ...TURN, reply: '  ' }, { ...TURN, reply: 'x'.repeat(2001) }, { ...TURN, status: 'taken_on_time' }, 'nope']) {
      expect((await call(bad)).status, JSON.stringify(bad).slice(0, 60)).toBe(422);
    }
    expect(h.voiceTurn).not.toHaveBeenCalled();
  });
  it('201 with the id; the patient comes from the path; an unknown patient is 404', async () => {
    const r = await call(TURN);
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({ id: 'vt_01TEST' });
    expect(h.voiceTurn).toHaveBeenCalledWith('pt-03', TURN);
    h.voiceTurn.mockResolvedValueOnce(null);
    expect((await call(TURN, auth(), 'pt-99')).status).toBe(404);
  });
  it('503 under the mock backend, after auth and validation', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'mock');
    expect((await call(TURN)).status).toBe(503);
    expect(h.voiceTurn).not.toHaveBeenCalled();
  });
});

describe('the HTTP surface — asserted absent', () => {
  it('no route under app/api accepts a dose status except app/api/agent/doses/{id}/status; no /api/doses exists', async () => {
    const { readdirSync, statSync } = await import('node:fs');
    const walk = (d: string): string[] => readdirSync(d).flatMap((f) => (statSync(`${d}/${f}`).isDirectory() ? walk(`${d}/${f}`) : [`${d}/${f}`]));
    const routes = walk('app/api').filter((f) => /route\.ts$/.test(f));
    expect(routes.filter((f) => f.startsWith('app/api/doses'))).toEqual([]);
    // CR-062 adds one READ path whose name says dose; it exports GET only (asserted above).
    expect(routes.filter((f) => /dose/i.test(f)).sort()).toEqual([
      'app/api/agent/doses/[doseId]/status/route.ts', 'app/api/agent/patients/[patientId]/doses/route.ts',
    ]);
    expect(routes.filter((f) => f.startsWith('app/api/agent/')).sort()).toEqual([
      'app/api/agent/alert-recipients/route.ts', 'app/api/agent/alerts/route.ts', 'app/api/agent/check-in-eligibility/route.ts',
      'app/api/agent/doses/[doseId]/status/route.ts', 'app/api/agent/patients/[patientId]/doses/route.ts',
      'app/api/agent/patients/[patientId]/prescriptions/route.ts', 'app/api/agent/patients/[patientId]/voice-turns/route.ts',
      'app/api/agent/prescriptions/route.ts', 'app/api/agent/schedule/recompute/route.ts',
    ]);
  });
});

describe('the agent token is trimmed (a pasted dashboard value can end in a newline)', () => {
  it('a token stored with trailing whitespace still admits the clean bearer; an all-blank one admits nobody', async () => {
    vi.stubEnv('JURAH_AGENT_TOKEN', `${TOKEN}\r\n`);
    let { GET } = await import('@/app/api/agent/check-in-eligibility/route');
    expect((await GET(req('/api/agent/check-in-eligibility', { headers: auth() }))).status).toBe(200);
    vi.resetModules();
    vi.stubEnv('JURAH_AGENT_TOKEN', ' \n ');
    ({ GET } = await import('@/app/api/agent/check-in-eligibility/route'));
    expect((await GET(req('/api/agent/check-in-eligibility', { headers: { authorization: 'Bearer ' } }))).status).toBe(401);
    expect((await GET(req('/api/agent/check-in-eligibility', { headers: auth() }))).status).toBe(401);
  });
});

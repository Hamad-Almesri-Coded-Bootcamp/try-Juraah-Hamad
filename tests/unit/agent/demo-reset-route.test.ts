// @vitest-environment node
/**
 * CR-109 — POST /api/agent/demo/reset, called through its real route.ts (modelled on
 * tests/unit/agent/routes.test.ts). lib/session's getSession and lib/data/pg/demo-reset's
 * resetDemoDoses are replaced by stubs, so this proves the HANDLER: the gate (403 for every user
 * session, 401 for a missing or wrong bearer, before any body is read or any statement runs), 422
 * validation, 503 under the mock backend, and the 200 shape and dates on success. The SQL itself is
 * tests/unit/agent/demo-reset-data.test.ts and, live, tests/integration/enforcement/demo-reset.test.ts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from '@/types/views';

const TOKEN = 'unit-test-agent-bearer-0123456789';
const ANSWER = { patientId: 'pt-03', dates: ['2026-09-21', '2026-09-22'], moved: [{ id: 'rx-009-20260921-2100', from: '21:00', to: '19:30' }], reset: [] };

const h = vi.hoisted(() => ({
  session: null as unknown,
  sessionThrows: false,
  reset: vi.fn(async (): Promise<unknown> => ({ patientId: 'pt-03', dates: ['2026-09-21', '2026-09-22'], moved: [{ id: 'rx-009-20260921-2100', from: '21:00', to: '19:30' }], reset: [] })),
}));

vi.mock('@/lib/session', () => ({
  getSession: async () => {
    if (h.sessionThrows) throw new Error('db down');
    return h.session;
  },
}));
vi.mock('@/lib/data/pg/demo-reset', () => ({ resetDemoDoses: h.reset }));

const USERS: Record<string, Session> = {
  'patient (حمد)': { subjectId: 'pt-01', role: 'patient' } as Session,
  'caregiver (عبدالله)': { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } as Session,
  'reviewer (د. خالد)': { subjectId: 'acc-10', role: 'reviewer' } as Session,
  'admin (م. دانة)': { subjectId: 'acc-11', role: 'admin' } as Session,
  'pending-only (ناصر)': { subjectId: 'cg-03', pendingInvitationOnly: true } as Session,
};

const req = (init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL('/api/agent/demo/reset', 'http://localhost:3000'), init);
const auth = (t = TOKEN) => ({ authorization: `Bearer ${t}`, 'content-type': 'application/json' });
const post = (body: unknown, headers: Record<string, string> = auth()) => req({ method: 'POST', headers, body: body === undefined ? undefined : JSON.stringify(body) });
const load = () => import('@/app/api/agent/demo/reset/route');

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('JURAH_AGENT_TOKEN', TOKEN);
  vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
  vi.stubEnv('JURAH_CLOCK', 'frozen');
  h.session = null;
  h.sessionThrows = false;
  h.reset.mockClear();
  h.reset.mockResolvedValue({ patientId: 'pt-03', dates: ['2026-09-21', '2026-09-22'], moved: [{ id: 'rx-009-20260921-2100', from: '21:00', to: '19:30' }], reset: [] });
});
afterEach(() => vi.unstubAllEnvs());

describe('POST /api/agent/demo/reset', () => {
  it('no bearer -> 401, a wrong bearer or scheme -> 401, an unset token -> 401; nothing runs', async () => {
    const { POST } = await load();
    const badHeaders: Array<Record<string, string>> = [
      { 'content-type': 'application/json' }, auth('wrong-token-of-the-same-length-xx'), { authorization: `Basic ${TOKEN}` },
    ];
    for (const headers of badHeaders) {
      const r = await POST(post({}, headers));
      expect(r.status).toBe(401);
      expect(await r.json()).toEqual({ error: 'unauthorized' });
    }
    vi.stubEnv('JURAH_AGENT_TOKEN', '');
    vi.resetModules();
    const { POST: POST2 } = await load();
    expect((await POST2(post({}, { authorization: 'Bearer ' }))).status).toBe(401);
    expect(h.reset).not.toHaveBeenCalled();
  });

  it('every user session -> 403, with and without the valid bearer; a failed session lookup with the cookie -> 403', async () => {
    const { POST } = await load();
    for (const [, session] of Object.entries(USERS)) {
      h.session = session;
      let r = await POST(post({}, { 'content-type': 'application/json' }));
      expect(r.status).toBe(403);
      expect(await r.json()).toEqual({ error: 'forbidden' });
      r = await POST(post({}, auth()));
      expect(r.status).toBe(403);
    }
    h.session = null;
    h.sessionThrows = true;
    const r = await POST(post({}, { ...auth(), cookie: 'jurah.session=abc.def' }));
    expect(r.status).toBe(403);
    expect(h.reset).not.toHaveBeenCalled();
  });

  it('any body key -> 422 before the database', async () => {
    const { POST } = await load();
    const cases: Array<[unknown, string]> = [
      [{ patientId: 'pt-01' }, 'patientId'],
      [{ dates: ['2026-09-21'] }, 'dates'],
      [{ status: 'taken_on_time' }, 'status'],
      [{ doseId: 'rx-009-20260921-2100' }, 'doseId'],
    ];
    for (const [body, field] of cases) {
      const r = await POST(post(body));
      expect(r.status).toBe(422);
      expect(await r.json()).toEqual({ error: 'invalid_body', field, reason: 'unknown_field' });
    }
    const arr = await POST(post([]));
    expect(arr.status).toBe(422);
    expect(await arr.json()).toEqual({ error: 'invalid_body', field: 'body', reason: 'not_an_object' });
    expect(h.reset).not.toHaveBeenCalled();
  });

  it('malformed JSON text reads as an empty body, the same as every other agent route (readJson)', async () => {
    const { POST } = await load();
    const r = await POST(req({ method: 'POST', headers: auth(), body: 'not json' }));
    expect(r.status).toBe(200);
    expect(h.reset).toHaveBeenCalledTimes(1);
  });

  it('mock backend -> 503 after auth and validation', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'mock');
    vi.resetModules();
    const { POST } = await load();
    expect((await POST(post({}, auth()))).status).toBe(503);
    expect((await POST(post({}, { 'content-type': 'application/json' }))).status).toBe(401);
    h.session = USERS['patient (حمد)'];
    expect((await POST(post({}))).status).toBe(403);
    h.session = null;
    expect((await POST(post({ patientId: 'pt-01' }))).status).toBe(422);
    expect(h.reset).not.toHaveBeenCalled();
  });

  it('no body and {} -> 200 with the database answer, for today and tomorrow on the Kuwait clock', async () => {
    const { POST } = await load();
    const r1 = await POST(post(undefined));
    expect(r1.status).toBe(200);
    expect(await r1.json()).toEqual(ANSWER);
    const r2 = await POST(post({}));
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual(ANSWER);
    expect(h.reset).toHaveBeenCalledTimes(2);
    expect(h.reset).toHaveBeenNthCalledWith(1, ['2026-09-21', '2026-09-22']);
    expect(h.reset).toHaveBeenNthCalledWith(2, ['2026-09-21', '2026-09-22']);
  });

  it('the module exports POST and no other verb', async () => {
    const m = await load();
    expect(Object.keys(m).filter((k) => /^(GET|POST|PUT|PATCH|DELETE)$/.test(k))).toEqual(['POST']);
  });
});

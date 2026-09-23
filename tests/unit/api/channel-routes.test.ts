// @vitest-environment node
/**
 * P2-WP6 — the four channel route handlers, called with Next's own request objects. The database
 * helpers (lib/data/pg/channels.ts) are replaced by spies here, so these tests prove the HANDLER
 * logic — auth, status codes, bodies, which method is exported, and that a refused or neutral
 * request never reaches a write. The SQL behind each helper is proved against the database in
 * tests/integration/enforcement/channels.test.ts and by hand (docs/backend-notes/p2-wp6.md).
 */
import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from '@/types/views';

const h = vi.hoisted(() => ({
  session: null as Session | null,
  connect: vi.fn(async () => true),
  feed: vi.fn(async (): Promise<unknown[] | null> => null),
  attach: vi.fn(async () => 'stored' as 'stored' | 'no_live_row'),
  revoke: vi.fn(async () => undefined),
  job: vi.fn(async (): Promise<string[] | null> => ['cg-03']),
  // CR-063: after() is captured (a unit test has no request scope) and the relay is a spy.
  afterQueue: [] as (() => unknown)[],
  relay: vi.fn(async (u: unknown) => { void u; return { forwarded: false, reason: 'not_configured' }; }),
}));

vi.mock('next/server', async (orig) => ({ ...(await orig<typeof import('next/server')>()), after: (fn: () => unknown) => { h.afterQueue.push(fn); } }));
vi.mock('@/lib/agent/inbound', () => ({ relayReply: h.relay }));

vi.mock('@/lib/data/pg/_shared', () => ({ sessionOf: async () => h.session, notImplemented: () => { throw new Error('x'); }, NOT_IMPLEMENTED: 'x' }));
vi.mock('@/lib/data/pg/channels', () => ({
  connectMessagingLinkByToken: h.connect,
  calendarFeedForToken: h.feed,
  attachPushEndpointForSession: h.attach,
  revokePushEndpointForSession: h.revoke,
  runInvitationExpiryJob: h.job,
}));

const params = <T,>(p: T) => ({ params: Promise.resolve(p) });
const req = (url: string, init?: ConstructorParameters<typeof NextRequest>[1]) => new NextRequest(new URL(url, 'http://localhost:3000'), init);

beforeEach(() => {
  vi.resetModules();
  h.session = null;
  for (const f of [h.connect, h.feed, h.attach, h.revoke, h.job, h.relay]) f.mockClear();
  h.afterQueue.length = 0;
});
afterEach(() => vi.unstubAllEnvs());

// -------------------------------------------------------------------------------------------
describe('GET /api/calendar/{token}.ics', () => {
  const load = () => import('@/app/api/calendar/[token]/route');

  it('E-46 (static half): the module exports GET and no other method — Next answers 405 for the rest', async () => {
    const mod = await load();
    expect(Object.keys(mod).sort()).toEqual(['GET']);
  });

  it('a path without .ics, and an unknown token, are 404 with no body', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { GET } = await load();
    const a = await GET(req('/api/calendar/abc'), params({ token: 'abc' }));
    expect(a.status).toBe(404);
    expect(h.feed).not.toHaveBeenCalled();
    const b = await GET(req('/api/calendar/unknown-token.ics'), params({ token: 'unknown-token.ics' }));
    expect(b.status).toBe(404);
    expect(await b.text()).toBe('');
    expect(h.feed).toHaveBeenCalledWith('unknown-token');
  });

  it('serves text/calendar with a content ETag, and 304 on If-None-Match', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    h.feed.mockResolvedValue([
      { id: 'rx-008-20260921-0700', prescriptionId: 'rx-008', scheduledAt: '2026-09-21T07:00:00+03:00', status: 'taken_on_time', tracked: true, source: 'adherence_agent', drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg' }, dosePerAdministration: 1 },
    ]);
    const { GET } = await load();
    const res = await GET(req('/api/calendar/mock-token-cal-pt-03.ics'), params({ token: 'mock-token-cal-pt-03.ics' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('text/calendar; charset=utf-8');
    const body = await res.text();
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(body).toContain('UID:rx-008-20260921-0700\r\n');
    const etag = res.headers.get('etag')!;
    expect(etag).toMatch(/^"[0-9a-f]{32}"$/);
    const same = await GET(req('/api/calendar/x.ics', { headers: { 'if-none-match': etag } }), params({ token: 'mock-token-cal-pt-03.ics' }));
    expect(same.status).toBe(304);
    expect(await same.text()).toBe('');
    h.feed.mockResolvedValue([]);
    const changed = await GET(req('/api/calendar/x.ics', { headers: { 'if-none-match': etag } }), params({ token: 'mock-token-cal-pt-03.ics' }));
    expect(changed.status).toBe(200); // the doses changed → different bytes → different ETag → full body
    expect(changed.headers.get('etag')).not.toBe(etag);
    h.feed.mockReset();
    h.feed.mockImplementation(async () => null);
  });

  it('under the mock backend: 503, never a fabricated feed', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'mock');
    const { GET } = await load();
    const res = await GET(req('/api/calendar/mock-token-cal-pt-03.ics'), params({ token: 'mock-token-cal-pt-03.ics' }));
    expect(res.status).toBe(503);
    expect(h.feed).not.toHaveBeenCalled();
  });
});

// -------------------------------------------------------------------------------------------
describe('POST /api/messaging/telegram/webhook/{secret}', () => {
  const load = () => import('@/app/api/messaging/telegram/webhook/[secret]/route');
  const TOKEN = 'test-only-bot-token-not-real';
  const secretOf = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 40);
  const update = (text: string, chatId: number = 424242) => JSON.stringify({ update_id: 1, message: { message_id: 1, chat: { id: chatId, type: 'private' }, text } });
  const post = (secret: string, body: string) => req(`/api/messaging/telegram/webhook/${secret}`, { method: 'POST', body, headers: { 'content-type': 'application/json' } });

  it('exports POST only', async () => {
    expect(Object.keys(await load()).sort()).toEqual(['POST']);
  });

  it('while no bot token is configured, EVERY secret is 404 with an empty body — including sha256("")', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', '');
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    for (const s of [secretOf(''), 'anything', '']) {
      const res = await POST(post(s, update('/start abc')), params({ secret: s }));
      expect(res.status).toBe(404);
      expect(await res.text()).toBe('');
    }
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('a wrong secret is 404 with an empty body and no write', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', TOKEN);
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    const res = await POST(post('0'.repeat(40), update('/start abc')), params({ secret: '0'.repeat(40) }));
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('/start <token> with the right secret → the one connect call (chat id stringified); the body is the neutral 200', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', TOKEN);
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    const s = secretOf(TOKEN);
    const res = await POST(post(s, update('/start AbC_123-xyz')), params({ secret: s }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
    expect(h.connect).toHaveBeenCalledTimes(1);
    expect(h.connect).toHaveBeenCalledWith('AbC_123-xyz', '424242');
    expect(h.afterQueue).toHaveLength(0); // CR-063: a linking message is never offered to the agents
  });

  it('a used/unknown token gets the SAME neutral body as a valid one (the helper reports false, the response does not change)', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', TOKEN);
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    h.connect.mockResolvedValueOnce(false);
    const { POST } = await load();
    const s = secretOf(TOKEN);
    const res = await POST(post(s, update('/start used-token')), params({ secret: s }));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('{"ok":true}');
  });

  it('anything but /start <token> → neutral 200 and NO write', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', TOKEN);
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    const s = secretOf(TOKEN);
    for (const body of [update('hello'), update('/start'), update('/start two words'), update('/help x'), '{not json', JSON.stringify({ update_id: 2 }), update('/start ' + 'a'.repeat(65))]) {
      const res = await POST(post(s, body), params({ secret: s }));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('{"ok":true}');
    }
    expect(h.connect).not.toHaveBeenCalled();
  });

  it('CR-063: anything but /start <token> is offered to the relay AFTER the response, with the parsed update', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', TOKEN);
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    const s = secretOf(TOKEN);
    const res = await POST(post(s, update('أخذته')), params({ secret: s }));
    expect(await res.text()).toBe('{"ok":true}');
    expect(h.relay).not.toHaveBeenCalled(); // nothing ran before the response
    expect(h.afterQueue).toHaveLength(1);
    await h.afterQueue[0]!();
    expect(h.relay).toHaveBeenCalledWith(JSON.parse(update('أخذته')));
  });

  it('CR-063: under the mock backend, and on a wrong secret, nothing is relayed', async () => {
    vi.stubEnv('JURAH_BOT_TOKEN', TOKEN);
    vi.stubEnv('JURAH_DATA_BACKEND', 'mock');
    const { POST } = await load();
    const s = secretOf(TOKEN);
    await POST(post(s, update('hello')), params({ secret: s }));
    await POST(post('0'.repeat(40), update('hello')), params({ secret: '0'.repeat(40) }));
    expect(h.afterQueue).toHaveLength(0);
  });
});

// -------------------------------------------------------------------------------------------
describe('POST / DELETE /api/push/subscription', () => {
  const load = () => import('@/app/api/push/subscription/route');
  const good = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'B'.repeat(87), auth: 'A'.repeat(22) } };
  const post = (body: unknown) => req('/api/push/subscription', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

  it('exports POST and DELETE only', async () => {
    expect(Object.keys(await load()).sort()).toEqual(['DELETE', 'POST']);
  });

  it('401 without a session; 403 for a clinic or pending-only session; nothing stored', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST, DELETE } = await load();
    expect((await POST(post(good))).status).toBe(401);
    expect((await DELETE()).status).toBe(401);
    for (const s of [{ subjectId: 'acc-10', role: 'reviewer' }, { subjectId: 'acc-11', role: 'admin' }, { subjectId: 'cg-03', pendingInvitationOnly: true }] as Session[]) {
      h.session = s;
      expect((await POST(post(good))).status).toBe(403);
      expect((await DELETE()).status).toBe(403);
    }
    expect(h.attach).not.toHaveBeenCalled();
    expect(h.revoke).not.toHaveBeenCalled();
  });

  it('403 when the body names a subject other than the session’s own', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    h.session = { subjectId: 'pt-01', role: 'patient' };
    const { POST } = await load();
    const res = await POST(post({ ...good, subject: { subjectType: 'patient', subjectId: 'pt-03' } }));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'forbidden' });
    expect(h.attach).not.toHaveBeenCalled();
  });

  it('422 for a malformed body (not JSON, http endpoint, bad keys)', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    h.session = { subjectId: 'pt-01', role: 'patient' };
    const { POST } = await load();
    for (const b of ['{x', {}, { ...good, endpoint: 'http://insecure.example/x' }, { ...good, keys: { p256dh: 'short', auth: good.keys.auth } }, { ...good, keys: { p256dh: good.keys.p256dh, auth: 'bad!' } }]) {
      expect((await POST(post(b))).status).toBe(422);
    }
    expect(h.attach).not.toHaveBeenCalled();
  });

  it('204 stored against the SESSION’s subject; 422 when there is no live row; DELETE → 204', async () => {
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    h.session = { subjectId: 'pt-03', role: 'patient' };
    const { POST, DELETE } = await load();
    expect((await POST(post({ ...good, subject: { subjectType: 'patient', subjectId: 'pt-03' } }))).status).toBe(204);
    expect(h.attach).toHaveBeenCalledWith(h.session, { endpoint: good.endpoint, p256dh: good.keys.p256dh, auth: good.keys.auth });
    h.attach.mockResolvedValueOnce('no_live_row');
    const r = await POST(post(good));
    expect(r.status).toBe(422);
    expect(await r.json()).toEqual({ error: 'no_live_subscription' });
    expect((await DELETE()).status).toBe(204);
    expect(h.revoke).toHaveBeenCalledWith(h.session);
  });
});

// -------------------------------------------------------------------------------------------
describe('POST /api/jobs/expire-invitations', () => {
  const load = () => import('@/app/api/jobs/expire-invitations/route');
  const post = (auth?: string) => req('/api/jobs/expire-invitations', { method: 'POST', headers: auth ? { authorization: auth } : {} });

  it('exports POST only', async () => {
    expect(Object.keys(await load()).sort()).toEqual(['POST']);
  });

  it('an unset JURAH_JOB_TOKEN refuses every caller — the job is never open', async () => {
    vi.stubEnv('JURAH_JOB_TOKEN', '');
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    for (const a of [undefined, 'Bearer ', 'Bearer x']) expect((await POST(post(a))).status).toBe(401);
    expect(h.job).not.toHaveBeenCalled();
  });

  it('401 for a missing or wrong bearer; 200 {expired: n} for the right one', async () => {
    vi.stubEnv('JURAH_JOB_TOKEN', 'test-only-job-token-0123456789');
    vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
    const { POST } = await load();
    expect((await POST(post())).status).toBe(401);
    expect((await POST(post('Bearer wrong'))).status).toBe(401);
    expect((await POST(post('test-only-job-token-0123456789'))).status).toBe(401);
    const res = await POST(post('Bearer test-only-job-token-0123456789'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ expired: 1 });
    expect(h.job).toHaveBeenCalledWith('2026-09-21T09:15:00+03:00');
  });
});

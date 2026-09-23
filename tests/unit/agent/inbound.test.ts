// @vitest-environment node
/**
 * CR-063 — the webhook's relay to the agents track. replyUpdateOf is pure; relayReply is tested
 * with the chat lookup (lib/data/pg/channels.ts) and fetch replaced by spies, so these prove the
 * decision order — configured → a forwardable reply → whose chat → forward — and the payload.
 * The lookup's SQL is proved against the database by hand (docs/DECISIONS.md CR-063).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  subject: vi.fn(async (chatId: string): Promise<unknown> => {
    void chatId;
    return { subjectType: 'patient', subjectId: 'pt-03', patientId: 'pt-03', language: 'ar' };
  }),
  fetch: vi.fn(async (url: string, init?: RequestInit): Promise<Response> => {
    void url; void init;
    return new Response('{}', { status: 200 });
  }),
}));
vi.mock('@/lib/data/pg/channels', () => ({ subjectForChat: h.subject }));

const URL_OK = 'https://mohammad-aljry.app.n8n.cloud/webhook/jurah/telegram-inbound';
const SECRET = 'unit-test-inbound-secret';
const msg = (extra: Record<string, unknown>) => ({ update_id: 9, message: { message_id: 77, date: 1790050500, chat: { id: 424242, type: 'private' }, ...extra } });

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('JURAH_AGENT_INBOUND_URL', URL_OK);
  vi.stubEnv('JURAH_AGENT_INBOUND_SECRET', SECRET);
  vi.stubGlobal('fetch', h.fetch);
  h.subject.mockClear();
  h.fetch.mockClear();
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('replyUpdateOf', () => {
  it('a typed message → text, chat id stringified, Telegram’s own timestamp', async () => {
    const { replyUpdateOf } = await import('@/lib/messaging/telegram');
    expect(replyUpdateOf(msg({ text: 'خذيته' }))).toEqual({
      kind: 'message', chatId: '424242', messageId: 77, sentAt: '2026-09-22T04:15:00.000Z', text: 'خذيته',
      photoFileId: null, documentFileId: null, callbackQueryId: null,
    });
  });
  it('a photo → the LARGEST size, the caption as text; a document → its file id', async () => {
    const { replyUpdateOf } = await import('@/lib/messaging/telegram');
    const photo = replyUpdateOf(msg({ caption: 'وصفتي', photo: [{ file_id: 'small' }, { file_id: 'large' }] }));
    expect(photo).toMatchObject({ text: 'وصفتي', photoFileId: 'large', documentFileId: null });
    expect(replyUpdateOf(msg({ document: { file_id: 'pdf-1' } }))).toMatchObject({ text: null, documentFileId: 'pdf-1' });
  });
  it('a quick-reply tap (TC-AD-07) → kind callback, its data as the text, the query id kept', async () => {
    const { replyUpdateOf } = await import('@/lib/messaging/telegram');
    const tap = { update_id: 10, callback_query: { id: 'cbq-1', data: 'taken_on_time', message: { message_id: 78, date: 1790050600, chat: { id: 424242 } } } };
    expect(replyUpdateOf(tap)).toMatchObject({ kind: 'callback', chatId: '424242', messageId: 78, text: 'taken_on_time', callbackQueryId: 'cbq-1' });
  });
  it('never a /start message, well-formed or not; never a body with nothing to read', async () => {
    const { replyUpdateOf } = await import('@/lib/messaging/telegram');
    for (const text of ['/start abc', '/start', '/start two words', '  /start@jurah_bot x']) expect(replyUpdateOf(msg({ text }))).toBeNull();
    for (const u of [null, 'x', {}, { update_id: 1 }, msg({}), msg({ text: '' }), { message: { message_id: 1, date: 1, chat: { id: 'not-a-number' }, text: 'hi' } }, { message: { message_id: 1, chat: { id: 1 }, text: 'no date' } }]) {
      expect(replyUpdateOf(u)).toBeNull();
    }
  });
  it('/help and other text are forwardable — routing them is the orchestrator’s job', async () => {
    const { replyUpdateOf } = await import('@/lib/messaging/telegram');
    expect(replyUpdateOf(msg({ text: '/help' }))).toMatchObject({ text: '/help' });
  });
});

describe('relayReply', () => {
  it('forwards a patient’s reply once, with the header secret and who the chat belongs to', async () => {
    const { relayReply } = await import('@/lib/agent/inbound');
    expect(await relayReply(msg({ text: 'خذيته' }))).toEqual({ forwarded: true });
    expect(h.subject).toHaveBeenCalledWith('424242');
    expect(h.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = h.fetch.mock.calls[0]!;
    expect(url).toBe(URL_OK);
    expect((init!.headers as Record<string, string>)['x-jurah-secret']).toBe(SECRET);
    expect(JSON.parse(String(init!.body))).toEqual({
      kind: 'message', chatId: '424242', messageId: 77, sentAt: '2026-09-22T04:15:00.000Z', text: 'خذيته',
      photoFileId: null, documentFileId: null, callbackQueryId: null,
      channel: 'telegram', subjectType: 'patient', subjectId: 'pt-03', patientId: 'pt-03', language: 'ar',
    });
  });
  it('an active caregiver’s chat is forwarded AS a caregiver — the agent, not the relay, refuses the adherence path', async () => {
    h.subject.mockResolvedValueOnce({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01', language: 'ar' });
    const { relayReply } = await import('@/lib/agent/inbound');
    await relayReply(msg({ text: 'أبوي خذ الدوا' }));
    expect(JSON.parse(String(h.fetch.mock.calls[0]![1]!.body))).toMatchObject({ subjectType: 'caregiver', subjectId: 'cg-01', patientId: 'pt-01' });
  });
  it('an unknown, disconnected or non-active caregiver chat (no subject) → nothing sent (TC-AD-16)', async () => {
    h.subject.mockResolvedValueOnce(null);
    const { relayReply } = await import('@/lib/agent/inbound');
    expect(await relayReply(msg({ text: 'hi' }))).toEqual({ forwarded: false, reason: 'no_subject' });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('not configured — no URL, no secret, or a /webhook-test/ URL — reads nothing and sends nothing', async () => {
    for (const [url, secret] of [['', SECRET], [URL_OK, ''], ['https://x.app.n8n.cloud/webhook-test/jurah/telegram-inbound', SECRET], ['http://x.app.n8n.cloud/webhook/y', SECRET]]) {
      vi.resetModules();
      vi.stubEnv('JURAH_AGENT_INBOUND_URL', url!);
      vi.stubEnv('JURAH_AGENT_INBOUND_SECRET', secret!);
      const { relayReply } = await import('@/lib/agent/inbound');
      expect(await relayReply(msg({ text: 'hi' }))).toEqual({ forwarded: false, reason: 'not_configured' });
    }
    expect(h.subject).not.toHaveBeenCalled();
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('a /start message is never looked up or sent; n8n refusing or unreachable is a quiet result', async () => {
    const { relayReply } = await import('@/lib/agent/inbound');
    expect(await relayReply(msg({ text: '/start abc' }))).toEqual({ forwarded: false, reason: 'not_a_reply' });
    expect(h.subject).not.toHaveBeenCalled();
    h.fetch.mockResolvedValueOnce(new Response('', { status: 403 }));
    expect(await relayReply(msg({ text: 'hi' }))).toEqual({ forwarded: false, reason: 'refused', status: 403 });
    h.fetch.mockRejectedValueOnce(new Error('network'));
    expect(await relayReply(msg({ text: 'hi' }))).toEqual({ forwarded: false, reason: 'refused' });
  });
});

// @vitest-environment node
/**
 * CR-067 — the web-app assistant's server half. core.ts is pure; askAssistant runs against the MOCK
 * backend's real store (the seed), with the session set by the script-session helper and fetch
 * replaced by a spy. Proves: only a patient session is answered, the patient id comes from the
 * session and never the caller, the message is validated, the secret header is sent, the payload
 * carries only what the Safety screen already shows, and anything unexpected is "unavailable".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { chatConfigured, chatPayload, cleanMessage, guestTopic, PAGE_PATH, pageForGuest, pageForIntent, patientOf, readReply, readVoiceTurn, WEBCHAT_INTENTS } from '@/lib/assistant/core';
import type { InteractionAlert } from '@/types/contracts';

const h = vi.hoisted(() => ({ fetch: vi.fn(async (url: string, init?: RequestInit): Promise<Response> => { void url; void init; return Response.json({ reply: 'جرعتك الجاية Calcium…', intent: 'next_dose', telegramPrompted: false }); }) }));

const URL_OK = 'https://mohammad-aljry.app.n8n.cloud/webhook/jurah/webchat';
const SECRET = 'unit-test-inbound-secret';

describe('core', () => {
  it('cleanMessage trims, refuses empty, too long and non-text', () => {
    expect(cleanMessage('  شنو جرعتي الجاية؟ ')).toBe('شنو جرعتي الجاية؟');
    for (const bad of ['', '   ', 'x'.repeat(501), 7, null, undefined]) expect(cleanMessage(bad)).toBeNull();
    expect(cleanMessage('x'.repeat(500))).toHaveLength(500);
  });
  it('patientOf answers a patient session only', () => {
    expect(patientOf({ subjectId: 'pt-03', role: 'patient' })).toBe('pt-03');
    for (const s of [null, { subjectId: 'cg-01', role: 'caregiver' as const, linkedPatientId: 'pt-01' }, { subjectId: 'acc-10', role: 'reviewer' as const }, { subjectId: 'cg-03', pendingInvitationOnly: true as const }]) {
      expect(patientOf(s)).toBeNull();
    }
  });
  it('chatConfigured needs an https /webhook/ URL (never /webhook-test/) and a secret', () => {
    expect(chatConfigured(URL_OK, SECRET)).toBe(true);
    expect(chatConfigured('', SECRET)).toBe(false);
    expect(chatConfigured(URL_OK, '')).toBe(false);
    expect(chatConfigured('https://x.app.n8n.cloud/webhook-test/jurah/webchat', SECRET)).toBe(false);
    expect(chatConfigured('http://x/webhook/y', SECRET)).toBe(false);
  });
  it('chatPayload carries only severity, description and review state of each alert', () => {
    const a = { id: 'ia-002', patientId: 'pt-03', involvedPrescriptionIds: ['rx-008'], severity: 'warning', description: 'd', sourceCitation: 'c', createdAt: 'x', reviewStatus: 'reviewed', reviewerNote: 'secret note' } as InteractionAlert;
    expect(chatPayload('pt-03', 'q', 'ar', [a])).toEqual({ patientId: 'pt-03', text: 'q', language: 'ar', alerts: [{ severity: 'warning', description: 'd', reviewStatus: 'reviewed' }] });
  });
  it('guestTopic: app help picked from the words, never personal', () => {
    expect(guestTopic('كيف أربط تيليقرام؟')).toBe('guestTelegram');
    expect(guestTopic('How do I sign in?')).toBe('guestSignIn');
    expect(guestTopic('ابي إعادة صرف')).toBe('guestRefill');
    for (const q of ['شنو جرعتي الجاية؟', 'What is Jur’ah?', 'hello']) expect(guestTopic(q)).toBe('guestGeneral');
  });
  it('readReply: only a 2xx with a non-empty reply is an answer', () => {
    expect(readReply(200, { reply: 'جرعتك الجاية…', intent: 'next_dose', telegramPrompted: true })).toEqual({ ok: true, reply: 'جرعتك الجاية…', telegramPrompted: true, intent: 'next_dose', page: 'today' });
    for (const [s, b] of [[500, { reply: 'x' }], [200, { reply: '' }], [200, null], [403, null], [200, { answer: 'x' }]] as const) {
      expect(readReply(s, b)).toEqual({ ok: false, reason: 'unavailable' });
    }
  });
  it('readReply: an intent outside the list (or none) is "unclear" and opens no page', () => {
    for (const intent of [undefined, 'delete_everything', 7, 'NEXT_DOSE']) {
      expect(readReply(200, { reply: 'x', intent })).toMatchObject({ ok: true, intent: 'unclear', page: null });
    }
  });
  it('pageForIntent: doses → Today, a reported dose → Activity, each help → its screen, unclear → nowhere', () => {
    expect(Object.fromEntries(WEBCHAT_INTENTS.map((i) => [i, pageForIntent(i)]))).toEqual({
      next_dose: 'today', dose_amount: 'today', today: 'today', forgot: 'activity', took_it: 'activity',
      safety: 'safety', help_telegram: 'notifications', help_refill: 'refill', help_general: 'help', unclear: null,
    });
    expect(PAGE_PATH).toEqual({
      today: '/app', activity: '/app/more/activity', safety: '/app/safety', notifications: '/app/more/notifications',
      refill: '/app/more/refill', help: '/app/more/help', signin: '/signin',
    });
  });
  it('pageForGuest: only a visitor with NO session is moved, to Sign in, and never for "what is Jur’ah"', () => {
    for (const topic of ['guestTelegram', 'guestRefill', 'guestSignIn'] as const) {
      expect(pageForGuest(topic, false)).toBe('signin');
      expect(pageForGuest(topic, true)).toBeNull();
    }
    expect(pageForGuest('guestGeneral', false)).toBeNull();
  });
});

describe('CR-069 readVoiceTurn — a row from voice_turns as the panel receives it', () => {
  it('doses → Today, "I forgot" → Activity; launch, unclear and bye open no screen', () => {
    const page = (topic: string) => readVoiceTurn({ seq: 1, topic, language: 'ar', reply: 'x' })?.page;
    expect(['next_dose', 'dose_amount', 'today'].map(page)).toEqual(['today', 'today', 'today']);
    expect(page('forgot')).toBe('activity');
    expect(page('record')).toBe('activity'); // CR-070: recorded by voice -> where the recorded rows are
    expect(['launch', 'unclear', 'bye'].map(page)).toEqual([null, null, null]);
  });
  it('a topic outside the list, an empty reply or a bad seq is dropped, never guessed', () => {
    expect(readVoiceTurn({ seq: 1, topic: 'record_dose', language: 'ar', reply: 'x' })).toBeNull();
    expect(readVoiceTurn({ seq: 1, topic: 'today', language: 'ar', reply: '' })).toBeNull();
    expect(readVoiceTurn({ seq: Number.NaN, topic: 'today', language: 'ar', reply: 'x' })).toBeNull();
    expect(readVoiceTurn({ seq: 2, topic: 'today', language: 'xx', reply: 'x' })?.language).toBe('ar');
  });
});

describe('askAssistant (mock backend, seed store)', () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('JURAH_DATA_BACKEND', 'mock');
    vi.stubEnv('JURAH_AGENT_CHAT_URL', URL_OK);
    vi.stubEnv('JURAH_AGENT_INBOUND_SECRET', SECRET);
    vi.stubGlobal('fetch', h.fetch);
    h.fetch.mockClear();
    (await import('@/lib/data/mock/store')).reset();
  });
  afterEach(async () => {
    (await import('@/lib/session/cookie')).setScriptSession(null);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });
  const as = async (session: Parameters<typeof import('@/lib/session/cookie')['setScriptSession']>[0]) => {
    (await import('@/lib/session/cookie')).setScriptSession(session);
    return (await import('@/lib/assistant')).askAssistant;
  };

  it('a patient gets n8n’s reply; the id is the SESSION’s, the secret header is sent, alerts are the patient’s own', async () => {
    const ask = await as({ subjectId: 'pt-03', role: 'patient' });
    expect(await ask('شنو جرعتي الجاية؟', 'ar')).toEqual({ ok: true, reply: 'جرعتك الجاية Calcium…', telegramPrompted: false, intent: 'next_dose', page: 'today' });
    const [url, init] = h.fetch.mock.calls[0]!;
    expect(url).toBe(URL_OK);
    expect((init!.headers as Record<string, string>)['x-jurah-secret']).toBe(SECRET);
    const body = JSON.parse(String(init!.body));
    expect(body.patientId).toBe('pt-03');
    expect(body.language).toBe('ar');
    expect(body.alerts.length).toBeGreaterThan(0);
    for (const a of body.alerts) expect(Object.keys(a).sort()).toEqual(['description', 'reviewStatus', 'severity']);
  });
  it('a caregiver, a reviewer, a pending-only session or no session gets APP HELP only: nothing read, nothing sent', async () => {
    for (const s of [{ subjectId: 'cg-01', role: 'caregiver' as const, linkedPatientId: 'pt-01' }, { subjectId: 'acc-10', role: 'reviewer' as const }, { subjectId: 'cg-03', pendingInvitationOnly: true as const }, null]) {
      const ask = await as(s);
      expect(await ask('شنو جرعتي الجاية؟', 'ar')).toEqual({ ok: true, guestTopic: 'guestGeneral', page: null });
      // Signed in (caregiver, reviewer, pending-only) stays put; only no session is sent to Sign in.
      expect(await ask('كيف أربط تيليقرام؟', 'ar')).toEqual({ ok: true, guestTopic: 'guestTelegram', page: s ? null : 'signin' });
    }
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('CR-069 voiceTurns: nothing under the mock backend, and nothing for anyone but a patient', async () => {
    for (const s of [{ subjectId: 'pt-03', role: 'patient' as const }, { subjectId: 'cg-01', role: 'caregiver' as const, linkedPatientId: 'pt-01' }, null]) {
      (await import('@/lib/session/cookie')).setScriptSession(s);
      const { voiceTurns } = await import('@/lib/assistant');
      expect(await voiceTurns(null)).toEqual({ latest: 0, turns: [] });
      expect(await voiceTurns(5)).toEqual({ latest: 5, turns: [] });
    }
  });
  it('assistantAudience: patient for a patient session, guest for everyone else', async () => {
    const audienceAs = async (session: Parameters<typeof import('@/lib/session/cookie')['setScriptSession']>[0]) => {
      (await import('@/lib/session/cookie')).setScriptSession(session);
      return (await import('@/lib/assistant')).assistantAudience();
    };
    expect(await audienceAs({ subjectId: 'pt-03', role: 'patient' })).toBe('patient');
    expect(await audienceAs({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' })).toBe('guest');
    expect(await audienceAs(null)).toBe('guest');
  });
  it('an empty or over-long message is refused; nothing sent', async () => {
    const ask = await as({ subjectId: 'pt-03', role: 'patient' });
    expect(await ask('   ', 'ar')).toEqual({ ok: false, reason: 'invalid' });
    expect(await ask('x'.repeat(501), 'ar')).toEqual({ ok: false, reason: 'invalid' });
    expect(h.fetch).not.toHaveBeenCalled();
  });
  it('not configured, n8n refusing, or n8n unreachable -> "unavailable", never a made-up answer', async () => {
    vi.stubEnv('JURAH_AGENT_CHAT_URL', '');
    vi.resetModules(); // lib/config reads the environment once, at import
    let ask = await as({ subjectId: 'pt-03', role: 'patient' });
    expect(await ask('hi', 'en')).toEqual({ ok: false, reason: 'unavailable' });
    expect(h.fetch).not.toHaveBeenCalled();
    vi.resetModules();
    vi.stubEnv('JURAH_AGENT_CHAT_URL', URL_OK);
    ask = await as({ subjectId: 'pt-03', role: 'patient' });
    h.fetch.mockResolvedValueOnce(new Response('', { status: 403 }));
    expect(await ask('hi', 'en')).toEqual({ ok: false, reason: 'unavailable' });
    h.fetch.mockRejectedValueOnce(new Error('network'));
    expect(await ask('hi', 'en')).toEqual({ ok: false, reason: 'unavailable' });
  });
});

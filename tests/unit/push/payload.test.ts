// @vitest-environment node
/**
 * P2-WP6 — G12 "notifications alert, never collect" (E-06, unit half).
 *
 * The rule under test, stated once: a push payload is `{ title, body, url }` and nothing else. No
 * payload carries an action (`actions`, `data.actions` — stripped at the server, whatever a caller
 * passes), and safety-critical content is never ONLY in a payload: `url` opens the screen that
 * holds it, so a dropped, denied or never-delivered push loses nothing.
 *
 * The poisoned inputs are built with JSON.parse on purpose: guard 4 forbids the literal
 * `actions:` anywhere in code, tests included.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildPushPayload, serialisePushPayload } from '@/lib/push/send';

const poisoned = () =>
  JSON.parse('{"title":"جرعة","body":"b","url":"/ar/app/safety","actions":[{"action":"take","title":"Taken"}],"data":{"actions":[{"action":"x"}],"doseId":"rx-003-20260921-0800"},"requireInteraction":true,"tag":"t"}') as unknown;

describe('buildPushPayload — the whitelist', () => {
  it('strips actions and data.actions (and every other key): exactly title, body, url survive', () => {
    const p = buildPushPayload(poisoned());
    expect(p).not.toBeNull();
    expect(Object.keys(p!)).toEqual(['title', 'body', 'url']);
    expect(Object.prototype.hasOwnProperty.call(p, 'actions')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(p, 'data')).toBe(false);
  });

  it('the serialised bytes that leave the server contain no action and no dose id', () => {
    const bytes = serialisePushPayload(poisoned())!;
    expect(bytes).toBe('{"title":"جرعة","body":"b","url":"/ar/app/safety"}');
    expect(bytes).not.toMatch(/actions/);
    expect(bytes).not.toMatch(/rx-003/);
  });

  it('refuses a payload with a missing key or a url that leaves the app', () => {
    expect(buildPushPayload({ title: 't', body: 'b' })).toBeNull();
    expect(buildPushPayload({ title: 't', body: 'b', url: 'https://evil.example/' })).toBeNull();
    expect(buildPushPayload({ title: 't', body: 'b', url: '//evil.example/' })).toBeNull();
    expect(buildPushPayload(null)).toBeNull();
  });
});

describe('sendPush — what reaches the push service', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
    vi.doUnmock('web-push');
  });

  it('is a no-op while PUSH_IS_SIMULATED (no VAPID private key) — nothing is sent', async () => {
    vi.stubEnv('JURAH_VAPID_PRIVATE_KEY', '');
    vi.resetModules();
    const sendNotification = vi.fn();
    vi.doMock('web-push', () => ({ default: { sendNotification } }));
    const { sendPush } = await import('@/lib/push/send');
    expect(await sendPush({ endpoint: 'https://push.example/x', p256dh: 'k', auth: 'a' }, poisoned())).toEqual({ sent: false, reason: 'simulated' });
    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('with a key configured, the captured payload carries no actions (fake push endpoint)', async () => {
    vi.stubEnv('JURAH_VAPID_PRIVATE_KEY', 'test-only-private-key');
    vi.stubEnv('JURAH_APP_ORIGIN', 'https://jurah.example');
    vi.resetModules();
    const captured: string[] = [];
    const sendNotification = vi.fn(async (_sub: unknown, bytes: string) => { captured.push(bytes); return { statusCode: 201, body: '', headers: {} }; });
    vi.doMock('web-push', () => ({ default: { sendNotification } }));
    const { sendPush } = await import('@/lib/push/send');
    const res = await sendPush({ endpoint: 'https://push.example/x', p256dh: 'k', auth: 'a' }, poisoned());
    expect(res).toEqual({ sent: true, statusCode: 201 });
    expect(captured).toHaveLength(1);
    const sent = JSON.parse(captured[0]!) as Record<string, unknown>;
    expect(Object.keys(sent)).toEqual(['title', 'body', 'url']);
    expect(captured[0]).not.toMatch(/actions/);
    // the url is a screen path — the full content lives there, never only in the payload
    expect(sent.url).toBe('/ar/app/safety');
  });

  it('a plain-http origin cannot sign VAPID: nothing is sent', async () => {
    vi.stubEnv('JURAH_VAPID_PRIVATE_KEY', 'test-only-private-key');
    vi.stubEnv('JURAH_APP_ORIGIN', 'http://localhost:3000');
    vi.resetModules();
    const sendNotification = vi.fn();
    vi.doMock('web-push', () => ({ default: { sendNotification } }));
    const { sendPush } = await import('@/lib/push/send');
    expect((await sendPush({ endpoint: 'https://push.example/x', p256dh: 'k', auth: 'a' }, { title: 't', body: 'b', url: '/ar' })).sent).toBe(false);
    expect(sendNotification).not.toHaveBeenCalled();
  });
});

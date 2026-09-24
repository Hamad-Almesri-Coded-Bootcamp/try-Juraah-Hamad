// @vitest-environment node
/**
 * F1 — GET /api/messaging/telegram/open. The session, the messaging link and Telegram's getMe are
 * stubbed; this proves the route's decisions: only the signed-in person's OWN pending link opens
 * the bot, the token leaves only in the redirect, and everything else goes back to the screen.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  session: null as unknown,
  link: null as unknown,
  username: 'jurah_real_bot' as string | null,
  linkCalls: [] as unknown[],
}));
vi.mock('@/lib/session', () => ({ getSession: async () => h.session }));
vi.mock('@/lib/data', () => ({ getMessagingLink: async (subject: unknown) => { h.linkCalls.push(subject); return h.link; } }));
vi.mock('@/lib/messaging/telegram', async (orig) => ({ ...(await orig<typeof import('@/lib/messaging/telegram')>()), botUsername: async () => h.username }));

import { GET } from '@/app/api/messaging/telegram/open/route';
import { startLink } from '@/lib/messaging/telegram';

const call = (locale = 'ar') => GET(new Request('http://localhost:3000/api/messaging/telegram/open?locale=' + locale));
const PENDING = { id: 'ml-1', subjectType: 'patient', subjectId: 'pt-03', channel: 'telegram', status: 'pending', linkToken: 'Abc_123-xyz' };

beforeEach(() => { h.session = { subjectId: 'pt-03', role: 'patient' }; h.link = PENDING; h.username = 'jurah_real_bot'; h.linkCalls = []; });

describe('F1 GET /api/messaging/telegram/open', () => {
  it('a patient with a pending link -> 302 to t.me/<bot>?start=<token>, not cached, no referrer; the link read is the session\'s own', async () => {
    const r = await call();
    expect(r.status).toBe(302);
    expect(r.headers.get('location')).toBe('https://t.me/jurah_real_bot?start=Abc_123-xyz');
    expect(r.headers.get('cache-control')).toBe('no-store');
    expect(r.headers.get('referrer-policy')).toBe('no-referrer');
    expect(h.linkCalls).toEqual([{ subjectType: 'patient', subjectId: 'pt-03' }]);
  });
  it('no session, a pending-only invitee or a reviewer -> back to the screen, no link read', async () => {
    for (const s of [null, { subjectId: 'cg-03', pendingInvitationOnly: true }, { subjectId: 'acc-10', role: 'reviewer' }]) {
      h.session = s;
      const r = await call('en');
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toBe('/en/app/more/notifications');
    }
    expect(h.linkCalls).toEqual([]);
  });
  it('not pending (connected, expired, not started), or no token -> back', async () => {
    for (const status of ['connected', 'expired', 'not_connected']) {
      h.link = { ...PENDING, status };
      expect((await call()).status).toBe(303);
    }
    h.link = { ...PENDING, linkToken: undefined };
    expect((await call()).status).toBe(303);
  });
  it('the bot simulated or Telegram not answering (no username) -> back, never a broken link', async () => {
    h.username = null;
    const r = await call();
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/ar/app/more/notifications');
  });
  it('a caregiver opens their OWN link', async () => {
    h.session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };
    h.link = { ...PENDING, subjectType: 'caregiver', subjectId: 'cg-01' };
    expect((await call()).status).toBe(302);
    expect(h.linkCalls).toEqual([{ subjectType: 'caregiver', subjectId: 'cg-01' }]);
  });
  it('startLink refuses a malformed bot name or token (nothing odd is ever put in a URL)', () => {
    expect(startLink('jurah_real_bot', 'Abc_123')).toBe('https://t.me/jurah_real_bot?start=Abc_123');
    expect(startLink('bad name', 'Abc')).toBeNull();
    expect(startLink('jurah_real_bot', 'a&b=c')).toBeNull();
    expect(startLink('jurah_real_bot', 'x'.repeat(65))).toBeNull();
  });
});

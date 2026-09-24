// @vitest-environment node
/**
 * AP-09 (CR-083, CR-086): POST /api/messaging/telegram/open. The session, the seam and Telegram's
 * getMe are stubbed; this proves the route's decisions: only a same-origin form post from a patient
 * or an ACTIVE caregiver mints a link, the token leaves only in the 303's Location header, every
 * other answer goes back to the screen without a token, and GET no longer exists (one way in).
 */
import { randomBytes } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  session: null as unknown,
  caregiverLink: { patientId: 'pt-01', patientFirstName: 'حمد', acceptedAt: '2026-09-03T18:20:00+03:00' } as unknown,
  minted: null as unknown,
  username: 'jurah_real_bot' as string | null,
  simulated: false,
  mintCalls: [] as unknown[],
  usernameCalls: 0,
}));
vi.mock('@/lib/session', () => ({ getSession: async () => h.session }));
vi.mock('@/lib/data', () => ({
  getCaregiverLink: async () => h.caregiverLink,
  startMessagingLink: async (subject: unknown) => {
    h.mintCalls.push(subject);
    return h.minted;
  },
}));
vi.mock('@/lib/config', async (orig) => {
  const real = await orig<typeof import('@/lib/config')>();
  return {
    ...real,
    get BOT_IS_SIMULATED() {
      return h.simulated;
    },
  };
});
vi.mock('@/lib/messaging/telegram', async (orig) => ({
  ...(await orig<typeof import('@/lib/messaging/telegram')>()),
  botUsername: async () => {
    h.usernameCalls += 1;
    return h.username;
  },
}));

import * as route from '@/app/api/messaging/telegram/open/route';
import { startLink } from '@/lib/messaging/telegram';

// The shape lib/data/pg/channels.ts mints: 32 random bytes, base64url, 43 characters.
const TOKEN = randomBytes(32).toString('base64url');
const PENDING = { id: 'ml-1', subjectType: 'patient', subjectId: 'pt-03', channel: 'telegram', status: 'pending', linkToken: TOKEN };

function post(fields: Record<string, string> = { locale: 'ar', from: 'notifications' }, headers: Record<string, string> = {}) {
  return route.POST(
    new Request('http://localhost:3103/api/messaging/telegram/open', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded', host: 'localhost:3103', origin: 'http://localhost:3103', 'sec-fetch-site': 'same-origin', ...headers },
      body: new URLSearchParams(fields).toString(),
    }),
  );
}

function expectPrivate(r: Response) {
  expect(r.headers.get('cache-control')).toBe('no-store');
  expect(r.headers.get('referrer-policy')).toBe('no-referrer');
}

beforeEach(() => {
  h.session = { subjectId: 'pt-03', role: 'patient' };
  h.caregiverLink = { patientId: 'pt-01', patientFirstName: 'حمد', acceptedAt: '2026-09-03T18:20:00+03:00' };
  h.minted = PENDING;
  h.username = 'jurah_real_bot';
  h.simulated = false;
  h.mintCalls = [];
  h.usernameCalls = 0;
});

describe('AP-09 POST /api/messaging/telegram/open: the token only in the Location header', () => {
  it('E5: a patient, same-origin form post -> 303 to t.me/<bot>?start=<token>, no-store, no referrer; the link minted is the session\'s own', async () => {
    const r = await post();
    const location = r.headers.get('location') ?? '';
    // The acceptance proof (the PR body prints it with the token redacted to its length).
    console.log(`[AP-09] ${r.status} Location: ${location.replace(TOKEN, `<token, ${TOKEN.length} chars>`)} · Cache-Control: ${r.headers.get('cache-control')} · Referrer-Policy: ${r.headers.get('referrer-policy')}`);
    expect(r.status).toBe(303);
    expect(location).toBe(`https://t.me/jurah_real_bot?start=${TOKEN}`);
    expectPrivate(r);
    expect(await r.text()).toBe(''); // no body: the token is in no page
    expect(h.mintCalls).toEqual([{ subjectType: 'patient', subjectId: 'pt-03' }]);
  });

  it('F4: an ACTIVE caregiver mints and opens their OWN link', async () => {
    h.session = { subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' };
    h.minted = { ...PENDING, subjectType: 'caregiver', subjectId: 'cg-02' };
    const r = await post({ locale: 'en', from: 'profile' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`https://t.me/jurah_real_bot?start=${TOKEN}`);
    expect(h.mintCalls).toEqual([{ subjectType: 'caregiver', subjectId: 'cg-02' }]);
  });

  it('Messaging link path: a caregiver whose invitation is not active (getCaregiverLink refuses) mints nothing -> back to F4, no token', async () => {
    h.session = { subjectId: 'cg-06', role: 'caregiver', linkedPatientId: 'pt-01' };
    h.caregiverLink = { patientId: '', patientFirstName: '', acceptedAt: '' };
    const r = await post({ locale: 'ar', from: 'profile' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/ar/care/more/profile');
    expectPrivate(r);
    expect(h.mintCalls).toEqual([]);
  });

  it('a refused mint (the database trigger for a non-active caregiver, or not the session\'s own) -> back, no token', async () => {
    h.session = { subjectId: 'cg-02', role: 'caregiver', linkedPatientId: 'pt-01' };
    h.minted = { id: 'ml-default', subjectType: 'caregiver', subjectId: 'cg-02', channel: 'telegram', status: 'not_connected' };
    const r = await post({ locale: 'en', from: 'profile' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/en/care/more/profile');
  });

  it('no session, a pending-only invitee, a reviewer or an admin -> back to the screen, nothing minted', async () => {
    for (const s of [null, { subjectId: 'cg-03', pendingInvitationOnly: true }, { subjectId: 'acc-10', role: 'reviewer' }, { subjectId: 'acc-11', role: 'admin' }]) {
      h.session = s;
      const r = await post({ locale: 'en', from: 'notifications' });
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toBe('/en/app/more/notifications');
      expectPrivate(r);
    }
    expect(h.mintCalls).toEqual([]);
  });

  it('CSRF: a cross-site post, a missing or opaque Origin, a foreign Sec-Fetch-Site -> back, nothing minted', async () => {
    const cases: Record<string, string>[] = [
      { origin: 'https://evil.example' },
      { origin: 'null' },
      { origin: '' },
      { 'sec-fetch-site': 'cross-site' },
      { origin: 'http://localhost:3103', host: 'tryjuraaah.vercel.app' },
    ];
    for (const headers of cases) {
      const r = await post({ locale: 'ar', from: 'notifications' }, headers);
      expect(r.status, JSON.stringify(headers)).toBe(303);
      expect(r.headers.get('location')).toBe('/ar/app/more/notifications');
    }
    expect(h.mintCalls).toEqual([]);
  });

  it('behind the host\'s proxy, the Origin is compared with x-forwarded-host (as Next does for a Server Action)', async () => {
    const r = await post({ locale: 'ar', from: 'notifications' }, { origin: 'https://tryjuraaah.vercel.app', host: 'internal:3000', 'x-forwarded-host': 'tryjuraaah.vercel.app' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe(`https://t.me/jurah_real_bot?start=${TOKEN}`);
  });

  it('simulated (no bot token): the link is minted and the person goes back to the screen, never to a t.me address', async () => {
    h.simulated = true;
    for (const [from, where] of [['notifications', '/ar/app/more/notifications'], ['setup', '/ar/app/setup?step=2']] as const) {
      const r = await post({ locale: 'ar', from });
      expect(r.status).toBe(303);
      expect(r.headers.get('location')).toBe(where);
    }
    expect(h.usernameCalls).toBe(0); // Telegram is never asked while simulated
    expect(h.mintCalls).toHaveLength(2);
  });

  it('a real bot Telegram does not name (getMe fails): nothing is minted, back to the screen', async () => {
    h.username = null;
    const r = await post({ locale: 'en', from: 'setup' });
    expect(r.status).toBe(303);
    expect(r.headers.get('location')).toBe('/en/app/setup?step=2');
    expect(h.mintCalls).toEqual([]);
  });

  it('an unknown `from` or locale never becomes a redirect target (no open redirect)', async () => {
    h.session = null;
    const r = await post({ locale: 'fr', from: 'https://evil.example' });
    expect(r.headers.get('location')).toBe('/ar/app/more/notifications');
  });

  it('one way in: the route exports POST only (F1\'s GET, which read the pending token, is gone)', () => {
    expect(Object.keys(route).filter((k) => /^[A-Z]+$/.test(k))).toEqual(['POST']);
  });

  it('startLink refuses a malformed bot name or token (nothing odd is ever put in a URL)', () => {
    expect(startLink('jurah_real_bot', 'Abc_123')).toBe('https://t.me/jurah_real_bot?start=Abc_123');
    expect(startLink('bad name', 'Abc')).toBeNull();
    expect(startLink('jurah_real_bot', 'a&b=c')).toBeNull();
    expect(startLink('jurah_real_bot', 'x'.repeat(65))).toBeNull();
  });
});

// @vitest-environment node
/**
 * lib/session/verify.ts (D-018) — the one verifier proxy.ts and the session module share.
 * Web Crypto needs the node environment (the unit project's default is jsdom).
 * The secrets below are throwaway test values, never the deployment's.
 */
import { describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { SESSION_TTL_MS, sessionExpiry, signSession, verifySession, type SessionPayload } from '@/lib/session/verify';

const SECRET = 'unit-test-secret-not-a-real-one-0123456789';
const OTHER = 'a-different-unit-test-secret-9876543210';
const NOW = Date.parse(REFERENCE_NOW);

const hamad: SessionPayload = { session: { subjectId: 'pt-01', role: 'patient' }, sid: 'ses_unit_1', exp: sessionExpiry() };
const naser: SessionPayload = { session: { subjectId: 'cg-03', pendingInvitationOnly: true }, sid: 'ses_unit_2', exp: sessionExpiry() };

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

describe('signSession / verifySession', () => {
  it('round-trips a patient session, byte-identical Session shape', async () => {
    const v = await signSession(hamad, SECRET);
    expect(v).toMatch(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/);
    const out = await verifySession(v, SECRET);
    expect(out).toEqual(hamad);
    expect(JSON.stringify(out!.session)).toBe('{"subjectId":"pt-01","role":"patient"}');
  });

  it('round-trips a caregiver and a pending-only session in the mock key order', async () => {
    const cg: SessionPayload = { session: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' }, sid: 's', exp: sessionExpiry() };
    expect(JSON.stringify((await verifySession(await signSession(cg, SECRET), SECRET))!.session)).toBe('{"subjectId":"cg-01","role":"caregiver","linkedPatientId":"pt-01"}');
    expect(JSON.stringify((await verifySession(await signSession(naser, SECRET), SECRET))!.session)).toBe('{"subjectId":"cg-03","pendingInvitationOnly":true}');
  });

  it('refuses a tampered payload carrying the old, valid signature (E-25)', async () => {
    const v = await signSession(hamad, SECRET);
    const [, mac] = v.split('.');
    const forged = b64url(JSON.stringify({ session: { subjectId: 'pt-01', role: 'admin' }, sid: hamad.sid, exp: hamad.exp }));
    expect(await verifySession(`${forged}.${mac}`, SECRET)).toBeNull();
    // a one-character change anywhere in the MAC is refused as well
    const flipped = v.slice(0, -1) + (v.endsWith('A') ? 'B' : 'A');
    expect(await verifySession(flipped, SECRET)).toBeNull();
  });

  it('refuses the Phase 1 hand-crafted unsigned JSON cookie (E-25)', async () => {
    expect(await verifySession(encodeURIComponent(JSON.stringify({ subjectId: 'pt-01', role: 'admin' })), SECRET)).toBeNull();
    expect(await verifySession(b64url(JSON.stringify({ session: { subjectId: 'pt-01', role: 'admin' }, sid: 'x', exp: hamad.exp })), SECRET)).toBeNull();
  });

  it('refuses an expired session at the given clock, accepts it before', async () => {
    const v = await signSession(hamad, SECRET);
    expect(await verifySession(v, SECRET, NOW + SESSION_TTL_MS - 1)).not.toBeNull();
    expect(await verifySession(v, SECRET, NOW + SESSION_TTL_MS)).toBeNull();
    const stale = await signSession({ ...hamad, exp: NOW - 1 }, SECRET);
    expect(await verifySession(stale, SECRET)).toBeNull();
  });

  it('refuses a cookie signed with another secret, and verifies nothing with no secret', async () => {
    const v = await signSession(hamad, OTHER);
    expect(await verifySession(v, SECRET)).toBeNull();
    expect(await verifySession(await signSession(hamad, SECRET), '')).toBeNull();
    await expect(signSession(hamad, '')).rejects.toThrow(/JURAH_SESSION_SECRET/);
  });

  it('refuses malformed values and payloads that are not a Session', async () => {
    for (const v of [undefined, null, '', 'x', 'a.b.c', '!!.??']) expect(await verifySession(v as string, SECRET)).toBeNull();
    const bad = [
      { session: { subjectId: 'pt-01', role: 'superuser' }, sid: 's', exp: hamad.exp },            // unknown role
      { session: { subjectId: 'pt-01' }, sid: 's', exp: hamad.exp },                               // neither role nor pending
      { session: { subjectId: 'cg-03', role: 'caregiver', pendingInvitationOnly: true }, sid: 's', exp: hamad.exp }, // both
      { session: { subjectId: 'pt-01', role: 'patient', civilId: '255031200187' }, sid: 's', exp: hamad.exp }, // extra key
      { session: { subjectId: 'pt-01', role: 'patient' }, sid: '', exp: hamad.exp },               // no sid
      { session: { subjectId: 'pt-01', role: 'patient' }, sid: 's', exp: 'tomorrow' },             // exp not a number
    ];
    for (const p of bad) {
      // signed with the right secret, so only the payload check can refuse it
      const body = b64url(JSON.stringify(p));
      const { createHmac } = await import('node:crypto');
      const mac = createHmac('sha256', SECRET).update(body).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      expect(await verifySession(`${body}.${mac}`, SECRET), JSON.stringify(p)).toBeNull();
    }
  });

  it('accepts exactly what the e2e helper mints (node:crypto HMAC = Web Crypto HMAC)', async () => {
    const saved = process.env.JURAH_SESSION_SECRET;
    const savedUrl = process.env.JURAH_DATABASE_URL;
    process.env.JURAH_SESSION_SECRET = SECRET;
    process.env.JURAH_DATABASE_URL = ''; // mock mode: no row, no child process
    try {
      const { sessionCookieFor, TEST_SESSIONS } = await import('../../e2e/helpers/session');
      for (const who of Object.keys(TEST_SESSIONS) as (keyof typeof TEST_SESSIONS)[]) {
        const c = sessionCookieFor(who, new URL('http://localhost:3100'));
        expect(c.name).toBe('jurah.session');
        const out = await verifySession(c.value, SECRET);
        expect(out?.session, who).toEqual(TEST_SESSIONS[who]);
        expect(await verifySession(c.value, OTHER), who).toBeNull();
      }
    } finally {
      if (saved === undefined) delete process.env.JURAH_SESSION_SECRET; else process.env.JURAH_SESSION_SECRET = saved;
      if (savedUrl === undefined) delete process.env.JURAH_DATABASE_URL; else process.env.JURAH_DATABASE_URL = savedUrl;
    }
  });
});

describe('proxy.ts on the signed cookie — every redirect rule unchanged (no database involved)', () => {
  const at = async (path: string, cookie?: string) => {
    const saved = process.env.JURAH_SESSION_SECRET;
    process.env.JURAH_SESSION_SECRET = SECRET;
    try {
      const { NextRequest } = await import('next/server');
      const { proxy } = await import('@/proxy');
      const res = await proxy(new NextRequest(`http://localhost:3100${path}`, cookie ? { headers: { cookie: `jurah.session=${cookie}` } } : undefined));
      return { status: res.status, location: res.headers.get('location')?.replace('http://localhost:3100', '') ?? null };
    } finally {
      if (saved === undefined) delete process.env.JURAH_SESSION_SECRET; else process.env.JURAH_SESSION_SECRET = saved;
    }
  };
  const signed = (session: SessionPayload['session']) => signSession({ session, sid: 'ses_proxy', exp: sessionExpiry() }, SECRET);

  it('E-25: the hand-crafted unsigned admin cookie is no session — /ar/clinic/audit → /ar/clinic', async () => {
    const unsigned = encodeURIComponent(JSON.stringify({ subjectId: 'pt-01', role: 'admin' }));
    expect(await at('/ar/clinic/audit', unsigned)).toEqual({ status: 307, location: '/ar/clinic' });
    expect(await at('/ar/app', unsigned)).toEqual({ status: 307, location: '/ar/signin' });
  });

  it('E-25: a validly signed admin cookie still reaches /ar/clinic/audit (control), a tampered one does not', async () => {
    const v = await signed({ subjectId: 'acc-11', role: 'admin' });
    expect(await at('/ar/clinic/audit', v)).toEqual({ status: 200, location: null });
    const [, mac] = v.split('.');
    const forged = b64url(JSON.stringify({ session: { subjectId: 'pt-01', role: 'admin' }, sid: 'ses_proxy', exp: sessionExpiry() }));
    expect(await at('/ar/clinic/audit', `${forged}.${mac}`)).toEqual({ status: 307, location: '/ar/clinic' });
    expect(await at('/ar/clinic/audit', await signSession({ session: { subjectId: 'acc-11', role: 'admin' }, sid: 's', exp: sessionExpiry() }, OTHER))).toEqual({ status: 307, location: '/ar/clinic' });
  });

  it('E-22: a pending-only session is sent to /ar/invitation from everywhere else', async () => {
    const v = await signed({ subjectId: 'cg-03', pendingInvitationOnly: true });
    expect(await at('/ar/app', v)).toEqual({ status: 307, location: '/ar/invitation' });
    expect(await at('/ar/care', v)).toEqual({ status: 307, location: '/ar/invitation' });
    expect(await at('/ar/clinic', v)).toEqual({ status: 307, location: '/ar/invitation' });
    expect(await at('/ar/invitation', v)).toEqual({ status: 200, location: null });
  });

  it('E-36: an admin-only session cannot reach the review queue, a reviewer-only one cannot reach the audit log', async () => {
    expect(await at('/ar/clinic/review', await signed({ subjectId: 'acc-11', role: 'admin' }))).toEqual({ status: 307, location: '/ar/gate' });
    expect(await at('/ar/clinic/audit', await signed({ subjectId: 'acc-10', role: 'reviewer' }))).toEqual({ status: 307, location: '/ar/gate' });
    expect(await at('/ar/clinic/review', await signed({ subjectId: 'acc-10', role: 'reviewer' }))).toEqual({ status: 200, location: null });
  });

  it('E-37: /ar/clinic and /ar/clinic/choose need no session', async () => {
    expect(await at('/ar/clinic')).toEqual({ status: 200, location: null });
    expect(await at('/ar/clinic/choose')).toEqual({ status: 200, location: null });
  });

  it('the Phase 1 rules, unchanged: role gates, no-session targets, the patient at the clinic door', async () => {
    const hamad = await signed({ subjectId: 'pt-01', role: 'patient' });
    const abdullah = await signed({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
    expect(await at('/ar/app', hamad)).toEqual({ status: 200, location: null });
    expect(await at('/ar/care', hamad)).toEqual({ status: 307, location: '/ar/gate' });
    expect(await at('/ar/clinic', hamad)).toEqual({ status: 307, location: '/ar/gate' });
    expect(await at('/ar/care', abdullah)).toEqual({ status: 200, location: null });
    expect(await at('/ar/app')).toEqual({ status: 307, location: '/ar/signin' });
    expect(await at('/ar/clinic/review')).toEqual({ status: 307, location: '/ar/clinic' });
    expect(await at('/ar/gate')).toEqual({ status: 307, location: '/ar/signin' });
    expect(await at('/ar/invitation')).toEqual({ status: 307, location: '/ar/signin' });
    expect(await at('/app')).toEqual({ status: 307, location: '/ar/app' });
    expect(await at('/ar')).toEqual({ status: 200, location: null });
  });
});

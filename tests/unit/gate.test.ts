/**
 * `requireRole` / `requireSession` — the decision table WP3's brief asks for (ACCEPTANCE: "Unit:
 * requireRole decision table"), mirroring ROLES.md's "Enforcement in Phase 1", point 2. `redirect`
 * is mocked to throw a distinguishable error (Next's own `redirect()` also throws — a `NEXT_REDIRECT`
 * digest — so asserting via a thrown value matches how the real function behaves) and
 * `setScriptSession` (lib/session/cookie.ts's own test/script fallback, exported for exactly this —
 * `cookies()` has no Next request context in a unit test) stands in for the mock session cookie.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setScriptSession } from '@/lib/session/cookie';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

const { requireRole, requireSession } = await import('@/features/shell/gate');

async function redirectedTo(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const match = /^REDIRECT:(.+)$/.exec(message);
    if (match?.[1]) return match[1];
    throw err;
  }
  throw new Error('expected a redirect, but the call resolved normally');
}

beforeEach(() => {
  setScriptSession(null);
  redirectMock.mockClear();
});

describe('requireRole — decision table', () => {
  it('no session → /{locale}/signin', async () => {
    setScriptSession(null);
    expect(await redirectedTo(() => requireRole('ar', ['patient']))).toBe('/ar/signin');
  });

  it('a pending-invitation-only session → /{locale}/invitation, whatever the allowed roles', async () => {
    setScriptSession({ subjectId: 'cg-03', pendingInvitationOnly: true });
    expect(await redirectedTo(() => requireRole('ar', ['reviewer', 'admin']))).toBe('/ar/invitation');
  });

  it('a session whose role is not in the allowed set → /{locale}/gate (its own home, never signin)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    expect(await redirectedTo(() => requireRole('ar', ['caregiver']))).toBe('/ar/gate');
  });

  it('a session whose role IS allowed → returns the session, no redirect', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    await expect(requireRole('ar', ['patient'])).resolves.toEqual({ subjectId: 'pt-01', role: 'patient' });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('the clinic gate: a reviewer passes for [reviewer, admin]', async () => {
    setScriptSession({ subjectId: 'acc-10', role: 'reviewer' });
    await expect(requireRole('en', ['reviewer', 'admin'])).resolves.toEqual({ subjectId: 'acc-10', role: 'reviewer' });
  });

  it('the clinic gate: an admin passes for [reviewer, admin]', async () => {
    setScriptSession({ subjectId: 'acc-11', role: 'admin' });
    await expect(requireRole('en', ['reviewer', 'admin'])).resolves.toEqual({ subjectId: 'acc-11', role: 'admin' });
  });

  it('the clinic gate: a patient does not pass for [reviewer, admin] → /{locale}/gate', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    expect(await redirectedTo(() => requireRole('en', ['reviewer', 'admin']))).toBe('/en/gate');
  });

  it('the reviewer-only gate: an admin-only account does not pass → /{locale}/gate', async () => {
    setScriptSession({ subjectId: 'acc-11', role: 'admin' });
    expect(await redirectedTo(() => requireRole('en', ['reviewer']))).toBe('/en/gate');
  });

  it('a clinic path with no session redirects to /{locale}/clinic, not /{locale}/signin (rule 1)', async () => {
    setScriptSession(null);
    expect(await redirectedTo(() => requireRole('ar', ['reviewer'], { noSessionTarget: '/clinic' }))).toBe('/ar/clinic');
  });
});

describe('requireSession — the invitation route’s own looser gate (rule 1)', () => {
  it('no session → /{locale}/signin', async () => {
    setScriptSession(null);
    expect(await redirectedTo(() => requireSession('ar'))).toBe('/ar/signin');
  });

  it('a pending-invitation-only session passes (no role required)', async () => {
    setScriptSession({ subjectId: 'cg-03', pendingInvitationOnly: true });
    await expect(requireSession('ar')).resolves.toEqual({ subjectId: 'cg-03', pendingInvitationOnly: true });
  });

  it('any full-role session also passes — the precise check is the data layer’s, not this gate’s', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    await expect(requireSession('ar')).resolves.toEqual({ subjectId: 'pt-03', role: 'patient' });
  });
});

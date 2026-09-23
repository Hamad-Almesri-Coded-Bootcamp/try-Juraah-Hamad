/**
 * Audit C9 (2026-09-23) — F0's layout gate. Declining ends a pending-only session inside the same
 * Server Action request, and Next re-renders the route in that request; the layout used to redirect
 * that render to /signin, so the person who had just said no never saw F0's required "declined"
 * acknowledgement. The exception is exactly that render: no session AND a Server Action request.
 * Every other session-less render still redirects (rule 1, and proxy.ts before it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setScriptSession } from '@/lib/session/cookie';

const { redirectMock, headersMock } = vi.hoisted(() => ({
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  headersMock: vi.fn(async () => new Headers()),
}));
vi.mock('next/navigation', () => ({ redirect: redirectMock, notFound: vi.fn(() => { throw new Error('NOT_FOUND'); }) }));
vi.mock('next/headers', async (importOriginal) => ({ ...(await importOriginal<typeof import('next/headers')>()), headers: headersMock }));

const { default: InvitationLayout } = await import('@/app/[locale]/invitation/layout');

const render = () => InvitationLayout({ children: 'consent', params: Promise.resolve({ locale: 'en' }) });

beforeEach(() => {
  setScriptSession(null);
  redirectMock.mockClear();
  headersMock.mockReset();
  headersMock.mockResolvedValue(new Headers());
});

describe('F0 layout gate', () => {
  it('no session on an ordinary request → /{locale}/signin', async () => {
    await expect(render()).rejects.toThrow('REDIRECT:/en/signin');
  });

  it('no session inside the Server Action request that just declined → renders (the acknowledgement survives)', async () => {
    headersMock.mockResolvedValue(new Headers({ 'next-action': 'decline-action-id' }));
    await expect(render()).resolves.toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it('a pending-only session renders as before', async () => {
    setScriptSession({ subjectId: 'cg-03', pendingInvitationOnly: true });
    await expect(render()).resolves.toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
  });
});

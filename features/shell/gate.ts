import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import type { Locale } from '@/i18n/locale';
import type { Role, Session } from '@/types/views';

/**
 * The one server-side role gate every shell layout calls (ROLES.md, "Enforcement in Phase 1",
 * point 2 — proxy.ts is point 1, the data layer is point 3). Reads the real session module (never
 * the raw cookie — that is proxy.ts's job, which cannot import server-only session code) and
 * redirects instead of rendering: a `redirect()` call throws, so a layout that calls this first
 * renders nothing for the wrong role and never flashes the wrong shell (A0 / navigation.md).
 *
 * Decision order matches ROLES.md's own list: no session → sign in; a pending-only session → the
 * one route it may reach; a session whose role is not one of `allowed` → the session's own gate,
 * which resolves it to the shell it DOES belong in (never back to sign-in, since it is already
 * signed in — just not for this shell).
 */
export async function requireRole(
  locale: Locale,
  allowed: readonly Role[],
  options?: { noSessionTarget?: '/signin' | '/clinic' },
): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/${locale}${options?.noSessionTarget ?? '/signin'}`);
  if (session.pendingInvitationOnly) redirect(`/${locale}/invitation`);
  if (!session.role || !allowed.includes(session.role)) redirect(`/${locale}/gate`);
  return session;
}

/**
 * The invitation route's own, looser gate (rule 1: "/invitation requires a session — pending-only
 * or any role holding a pending invitation"). Any signed-in session may reach the consent screen;
 * WHETHER it actually names an invitation to answer is the data layer's call
 * (`getPendingInvitationsForSubject` / `getInvitationForConsent`, both session-scoped) — a coarser
 * check here, a precise one there, same two-place pattern as every other gate.
 */
export async function requireSession(locale: Locale): Promise<Session> {
  const session = await getSession();
  if (!session) redirect(`/${locale}/signin`);
  return session;
}

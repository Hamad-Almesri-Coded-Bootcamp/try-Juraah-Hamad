import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';
import { SESSION_COOKIE } from '@/lib/config';
import { verifySession } from '@/lib/session/verify';
import type { Session } from '@/types/views';

type Role = 'patient' | 'caregiver' | 'reviewer' | 'admin';

/**
 * The session proxy.ts acts on: the SIGNED cookie (D-018), verified by the one shared verifier
 * `lib/session/verify.ts` (Web Crypto only). A missing, unsigned, tampered, expired or
 * wrongly-signed cookie is NO session (E-25) — never an error. proxy.ts has no database, so a
 * signed-but-revoked cookie still passes here; the shell layouts' `requireRole` → `getSession()`
 * (which also requires the live `sessions` row) is the second gate (E-26), exactly as Phase 1's
 * two-place pattern. It never reads anything else in the request.
 *
 * The ONE exception to "no process.env outside lib/config.ts" (P2-WP2 brief): the secret is read
 * here directly, because proxy.ts runs in front of the app and must not depend on the server
 * config module's secrets. Unset → nothing verifies → every gated route behaves as signed out.
 */
async function readSession(request: NextRequest): Promise<Session | null> {
  const secret = (process.env.JURAH_SESSION_SECRET ?? '').trim();
  const payload = await verifySession(request.cookies.get(SESSION_COOKIE)?.value, secret);
  return payload?.session ?? null;
}

/**
 * Locale segment, then the role gates (ROLES.md, "Enforcement in Phase 1", point 1 — the shell
 * layouts are point 2, the data layer point 3). Every `NextResponse.next()` forwards the resolved
 * locale-stripped path as `x-jurah-path` so a Server Component layout can read it back via
 * `headers()` — the one place a layout needs to know its own pathname without a client component
 * (used by the clinic shell, which renders differently for X0's entry than for its two destinations).
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
    return NextResponse.redirect(url);
  }

  const locale: Locale = first;
  const rest = pathname.slice(`/${locale}`.length) || '/';
  const session = await readSession(request);

  const redirectTo = (path: string) => NextResponse.redirect(new URL(`/${locale}${path}`, request.url));
  const next = () => {
    const headers = new Headers(request.headers);
    headers.set('x-jurah-path', rest);
    headers.set('x-jurah-locale', locale);
    return NextResponse.next({ request: { headers } });
  };

  // ROLES.md "What is not a role": a pending-only session reaches exactly one route, and every
  // other route redirects there — checked before any per-route rule below.
  if (session?.pendingInvitationOnly && rest !== '/invitation') {
    return redirectTo('/invitation');
  }

  // "no session → /[locale]/signin (or /[locale]/clinic for clinic paths)".
  const requireRole = (roles: readonly Role[], noSessionTarget: '/signin' | '/clinic' = '/signin') => {
    if (!session) return redirectTo(noSessionTarget);
    if (session.pendingInvitationOnly) return redirectTo('/invitation');
    if (!session.role || !roles.includes(session.role)) return redirectTo('/gate');
    return next();
  };

  if (rest === '/gate') {
    return session ? next() : redirectTo('/signin');
  }
  if (rest === '/invitation') {
    return session ? next() : redirectTo('/signin');
  }
  if (rest.startsWith('/app')) return requireRole(['patient']);
  if (rest.startsWith('/care')) return requireRole(['caregiver']);
  if (rest.startsWith('/clinic/review')) return requireRole(['reviewer'], '/clinic');
  if (rest.startsWith('/clinic/audit')) return requireRole(['admin'], '/clinic');
  if (rest === '/clinic' || rest === '/clinic/choose') {
    // X0 is itself a sign-in surface: reachable with no session, or with a clinic role already
    // held. A patient/caregiver session hitting it is signed in, just for the wrong shell.
    if (session && !session.pendingInvitationOnly && session.role !== 'reviewer' && session.role !== 'admin') {
      return redirectTo('/gate');
    }
    return next();
  }

  return next();
}

export const config = {
  matcher: ['/((?!_next|api|icons|sw\\.js|manifest\\.webmanifest|favicon\\.ico|.*\\..*).*)'],
};

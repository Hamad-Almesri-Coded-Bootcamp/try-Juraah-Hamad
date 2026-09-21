import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';
import { SESSION_COOKIE } from '@/lib/config';

type Role = 'patient' | 'caregiver' | 'reviewer' | 'admin';
interface MockSession {
  subjectId: string;
  role?: Role;
  linkedPatientId?: string;
  pendingInvitationOnly?: true;
}

function isMockSession(value: unknown): value is MockSession {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return typeof v.subjectId === 'string' && (v.role === undefined || typeof v.role === 'string');
}

/** Reads the mock session cookie exactly as D-005 defines it — never anything else in the request. */
function readSession(request: NextRequest): MockSession | null {
  const raw = request.cookies.get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return isMockSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Locale segment, then the role gates (ROLES.md, "Enforcement in Phase 1", point 1 — the shell
 * layouts are point 2, the data layer point 3). Every `NextResponse.next()` forwards the resolved
 * locale-stripped path as `x-jurah-path` so a Server Component layout can read it back via
 * `headers()` — the one place a layout needs to know its own pathname without a client component
 * (used by the clinic shell, which renders differently for X0's entry than for its two destinations).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];

  if (!isLocale(first)) {
    const url = request.nextUrl.clone();
    url.pathname = pathname === '/' ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
    return NextResponse.redirect(url);
  }

  const locale: Locale = first;
  const rest = pathname.slice(`/${locale}`.length) || '/';
  const session = readSession(request);

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

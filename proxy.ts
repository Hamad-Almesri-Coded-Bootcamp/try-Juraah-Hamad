import { NextResponse, type NextRequest } from 'next/server';
import { DEFAULT_LOCALE, isLocale } from '@/i18n/locale';

/**
 * Locale segment: every path carries /ar or /en; anything else is redirected to the default locale.
 * Role gating for /app, /care, /clinic, /invitation and /gate is added by WP3 (see docs/ROLES.md,
 * "Enforcement in Phase 1"): it reads the mock session cookie named in lib/config.ts and redirects
 * a session that lacks the route's role. Being unlisted is filing, not security — the clinic route
 * is gated exactly like the others.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const first = pathname.split('/')[1];
  if (isLocale(first)) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = pathname === '/' ? `/${DEFAULT_LOCALE}` : `/${DEFAULT_LOCALE}${pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next|api|icons|sw\\.js|manifest\\.webmanifest|favicon\\.ico|.*\\..*).*)'],
};

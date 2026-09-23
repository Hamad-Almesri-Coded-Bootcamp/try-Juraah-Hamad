import { headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locale';

/**
 * Reads the locale and locale-stripped pathname proxy.ts stamps onto every request
 * (`x-jurah-locale` / `x-jurah-path`) — the one place a Server Component needs its own pathname
 * without a client hook: the special files that render with no `params` at all (`not-found.tsx`,
 * `error.tsx`, `global-error.tsx`) and the clinic shell layout, which renders differently for X0's
 * entry than for its two destinations.
 */
export async function currentLocale(): Promise<Locale> {
  const h = await headers();
  const value = h.get('x-jurah-locale');
  return isLocale(value ?? undefined) ? (value as Locale) : DEFAULT_LOCALE;
}

export async function currentPath(): Promise<string> {
  const h = await headers();
  return h.get('x-jurah-path') ?? '/';
}

/**
 * true while rendering the POST that ran a Server Action (Next marks it with the `next-action`
 * header, node_modules/next/dist/client/components/app-router-headers.js). When an action sets or
 * deletes a cookie, Next re-renders the current route inside that same request
 * (docs/01-app/01-getting-started/07-mutating-data.md, "Cookies"). F0's decline is the case this
 * exists for: it ends the pending-only session, and the re-render must still show the
 * acknowledgement instead of redirecting a person who just said no to the sign-in form (audit C9).
 * The request itself was admitted by proxy.ts while the session still existed; a crafted
 * session-less POST never reaches a render.
 */
export async function isServerActionRender(): Promise<boolean> {
  const h = await headers();
  return h.has('next-action');
}

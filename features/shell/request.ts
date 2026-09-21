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

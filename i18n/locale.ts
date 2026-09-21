export const LOCALES = ['ar', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ar';
export type Direction = 'rtl' | 'ltr';

export function isLocale(value: string | undefined): value is Locale {
  return value === 'ar' || value === 'en';
}

export function directionFor(locale: Locale): Direction {
  return locale === 'ar' ? 'rtl' : 'ltr';
}

/** Swap the locale segment of a pathname: /ar/app/x → /en/app/x. */
export function withLocale(pathname: string, locale: Locale): string {
  const parts = pathname.split('/');
  if (isLocale(parts[1])) parts[1] = locale;
  else parts.splice(1, 0, locale);
  return parts.join('/') || `/${locale}`;
}

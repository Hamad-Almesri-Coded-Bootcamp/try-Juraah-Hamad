'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useTransition } from 'react';
import { updateSettings } from '@/lib/data';
import { copy, t } from '@/i18n';
import { withLocale, type Locale } from '@/i18n/locale';
import type { Role } from '@/types/views';

type LanguageSwitchProps = { locale: Locale; role?: Role; subjectId?: string };

/**
 * G2: the language switch, in the app bar's action slot on every screen (and L1's own header,
 * reused there by bundle a). Swaps the locale segment with `withLocale`, keeping the rest of the
 * path and query, and — for a signed-in patient only — persists the choice via `updateSettings`;
 * every other role (or no session at all) only swaps the segment, per the WP3 brief.
 *
 * `useSearchParams` must sit under a Suspense boundary on any statically prerendered route
 * (`missing-suspense-with-csr-bailout`; the signin pages hit this at `next build`), so the
 * exported component wraps the query-aware link in one, with a pathname-only link as the
 * fallback — the control itself never disappears while the query resolves.
 */
export function LanguageSwitch(props: LanguageSwitchProps) {
  return (
    <Suspense fallback={<SwitchLink {...props} />}>
      <QueryAwareSwitchLink {...props} />
    </Suspense>
  );
}

function QueryAwareSwitchLink(props: LanguageSwitchProps) {
  const query = useSearchParams().toString();
  return <SwitchLink {...props} query={query} />;
}

function SwitchLink({ locale, role, subjectId, query }: LanguageSwitchProps & { query?: string }) {
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const other: Locale = locale === 'ar' ? 'en' : 'ar';
  const target = withLocale(query ? `${pathname}?${query}` : pathname, other);

  const handleClick = () => {
    if (role === 'patient' && subjectId) {
      startTransition(() => {
        void updateSettings(subjectId, { language: other });
      });
    }
  };

  return (
    <Link
      href={target}
      onClick={handleClick}
      className="wsf-btn wsf-btn--quiet wsf-focus type-label"
      aria-label={t(copy.shell.languageSwitchLabel, locale)}
    >
      {t(copy.shell.languageSwitch, locale)}
    </Link>
  );
}

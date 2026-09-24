import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { ButtonProps } from '@/components/ui/Button';
import type { LandingCta } from './types';

type SignInCtaProps = LandingCta & {
  locale: Locale;
  /** The header's short label ("Sign in"). The accessible name stays the full action, which
   * begins with the visible words (WCAG 2.5.3, label in name). */
  compact?: boolean;
} & Omit<ButtonProps, 'onClick' | 'children' | 'lang'>;

/**
 * The one action repeated at three scroll positions of L1 (header, hero, closing). Only the hero's
 * is `primary` (CR-071: one primary per screen); the header and the closing carry it as
 * `secondary`. Wraps the shared `NavigateButton` so this file adds no navigation logic of its own
 * and Button itself is never restyled (on the navy sky the theme draws it light, daylight.css).
 */
export function SignInCta({ href, signedIn, locale, compact = false, ...buttonProps }: SignInCtaProps) {
  const label = signedIn ? t(copy.landing.ctaContinue, locale) : t(copy.landing.ctaSignIn, locale);
  const short = signedIn ? t(copy.landing.ctaContinueShort, locale) : t(copy.landing.ctaSignInShort, locale);
  return (
    <NavigateButton href={href} lang={locale} icon="shield" aria-label={compact ? label : undefined} {...buttonProps}>
      {compact ? short : label}
    </NavigateButton>
  );
}

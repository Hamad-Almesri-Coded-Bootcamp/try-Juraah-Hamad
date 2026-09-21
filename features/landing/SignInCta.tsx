import { NavigateButton } from '@/features/shell/NavigateButton';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { ButtonProps } from '@/components/ui/Button';
import type { LandingCta } from './types';

type SignInCtaProps = LandingCta & {
  locale: Locale;
} & Omit<ButtonProps, 'onClick' | 'children' | 'lang'>;

/**
 * The one action repeated at three scroll positions of L1 (header, hero, closing — the approved
 * boards draw it `variant="primary"` in all three places; it is the same action, not competing
 * primaries). Wraps the shared `NavigateButton` (features/shell, "import, never edit") so this
 * file adds no navigation logic of its own and Button itself is never restyled.
 */
export function SignInCta({ href, signedIn, locale, ...buttonProps }: SignInCtaProps) {
  const label = signedIn ? t(copy.landing.ctaContinue, locale) : t(copy.landing.ctaSignIn, locale);
  return (
    <NavigateButton href={href} lang={locale} icon="shield" {...buttonProps}>
      {label}
    </NavigateButton>
  );
}

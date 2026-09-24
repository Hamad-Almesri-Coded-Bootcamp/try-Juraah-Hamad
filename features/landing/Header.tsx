import { copy, t } from '@/i18n';
import { Brand } from '@/components/ui/Brand';
import type { Locale } from '@/i18n/locale';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { HeaderSignInIcon } from './HeaderSignInIcon';
import { SignInCta } from './SignInCta';
import type { LandingCta } from './types';

/**
 * Section (1), the persistent header (G11 item 1): the wordmark, the assistant and the language
 * switch (G2: "on the landing page it sits in the page header"; CR-069(k): the assistant lives in
 * the bar, not floating), and the sign-in action, all on the hero's navy sky as V2Landing draws it.
 *
 * The sign-in here is `secondary`; the hero carries the page's one primary action. At phone width
 * the row has room for its shield only (the icon-only control, named in full for assistive
 * technology); from 600px it carries its short label. Only one of the two is ever displayed, so the
 * page always offers exactly one header sign-in.
 */
export function LandingHeader({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  const label = cta.signedIn ? t(copy.landing.ctaContinue, locale) : t(copy.landing.ctaSignIn, locale);
  return (
    <header className="flex min-h-hit-lg items-center gap-2">
      <Brand name={t(copy.shell.appName, locale)} className="jr-display flex-1 text-h2 font-bold" />
      <LanguageSwitch locale={locale} />
      <HeaderSignInIcon href={cta.href} label={label} className="@[600px]:hidden" />
      <SignInCta {...cta} locale={locale} variant="secondary" compact className="hidden @[600px]:inline-flex" />
    </header>
  );
}

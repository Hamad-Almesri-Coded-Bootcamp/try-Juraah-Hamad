import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { SignInCta } from './SignInCta';
import type { LandingCta } from './types';
import { SECTION_GUTTER } from './layout';

/**
 * Section (1) — the persistent header (G11 item 1): the wordmark, the language switch (G2 — "on
 * the landing page it sits in the page header"), and one persistent sign-in action.
 *
 * L1 is the one screen with its own layout markup (SCREENS.md), so this is a plain header, not
 * `AppBar` — `AppBar` allows exactly one trailing action, and this header needs two (the language
 * switch and the sign-in button) side by side, per the boards.
 */
export function LandingHeader({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <header className={`flex items-center gap-3 border-b border-border bg-surface-card ${SECTION_GUTTER} tablet:py-3 desktop:py-3`}>
      <span className="flex-1 text-body-strong text-navy">{t(copy.shell.appName, locale)}</span>
      <LanguageSwitch locale={locale} />
      <SignInCta {...cta} locale={locale} />
    </header>
  );
}

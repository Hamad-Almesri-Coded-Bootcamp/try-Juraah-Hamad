import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SignInCta } from './SignInCta';
import type { LandingCta } from './types';

/**
 * Section (10) — closing call to action and footer (G11 item 10). The second of the two places
 * sign-in must be reachable from (pass criteria: "reachable from the top and from the closing
 * section"). The footer line is the exact academic-attribution copy the approved boards carry —
 * not an invented credential (G11: "no claim of certification or approval").
 */
export function ClosingSection({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <section className="flex flex-col gap-3 p-3 tablet:p-5">
      <h2 className="text-h2 text-navy">{t(copy.landing.closingHeading, locale)}</h2>
      <SignInCta {...cta} locale={locale} size="lg" fullWidth />
      <p className="text-caption text-ink-muted">{t(copy.landing.footerLine, locale)}</p>
    </section>
  );
}

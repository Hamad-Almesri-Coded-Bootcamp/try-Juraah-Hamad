import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SignInCta } from './SignInCta';
import type { LandingCta } from './types';

/**
 * Section (10): the closing call to action, in the footer beside the project note (G11 item 10; the
 * spec's "reachable from the top and from the closing section"). `secondary`, since the hero carries
 * the page's one primary action.
 */
export function ClosingSection({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <section aria-labelledby="closing-title" className="flex flex-col items-start gap-3">
      <h2 id="closing-title" className="type-h2 m-0 text-navy">
        {t(copy.landing.closingHeading, locale)}
      </h2>
      <SignInCta {...cta} locale={locale} variant="secondary" size="lg" />
    </section>
  );
}

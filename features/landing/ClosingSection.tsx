import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SignInCta } from './SignInCta';
import type { LandingCta } from './types';
import { PROSE, SECTION_GUTTER } from './layout';

/**
 * Section (10) — closing call to action and footer (G11 item 10). The second of the two places
 * sign-in must be reachable from (pass criteria: "reachable from the top and from the closing
 * section"). The footer line is the exact academic-attribution copy the approved boards carry —
 * not an invented credential (G11: "no claim of certification or approval"). The action is full
 * width at phone (Landing.dc.html) and its own width once the page is wide: a button stretched
 * across a desktop window is a bar, not a button.
 */
export function ClosingSection({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <section className={`flex flex-col gap-3 ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.closingHeading, locale)}</h2>
      <div className={`flex ${PROSE} [&>*]:w-full @[1000px]:[&>*]:w-auto`}>
        <SignInCta {...cta} locale={locale} size="lg" />
      </div>
      <p className="text-caption text-ink-muted">{t(copy.landing.footerLine, locale)}</p>
    </section>
  );
}

import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { LandingCta } from './types';
import { Hero } from './Hero';
import { ProblemSection } from './ProblemSection';
import { SolutionSection } from './SolutionSection';
import { FeaturesSection } from './FeaturesSection';
import { AudienceSection } from './AudienceSection';
import { SafetySection } from './SafetySection';
import { TransparencySection } from './TransparencySection';
import { ClosingSection } from './ClosingSection';
import { SECTION_INNER, SECTION_OUTER } from './layout';

/**
 * L1, the public landing page (docs/Acceptance Criteria and Test Plan.md, G11), in the Daylight
 * look (CR-071, V2Landing): the header and the hero on one navy sky, then the problem as the bridge
 * between two prescriptions nobody saw together, how it works, what you get with the optional
 * follow-up beside it, the navy safety band, who it is for, and a footer with the project note and
 * the closing action. The spec's ten sections in its order; one h1, eight h2.
 *
 * No tab bar and no data-layer call: `cta` is the only session-derived value, computed once by
 * `app/[locale]/page.tsx` and threaded to the three places the sign-in action repeats (header, hero,
 * closing). Only the hero's is primary.
 */
export function LandingPage({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <main id="main-content" className="@container mx-auto flex min-h-dvh w-full max-w-content-wide flex-col bg-surface-app">
      <Hero locale={locale} cta={cta} />
      <div className="jr-sheet flex flex-col pt-3 tablet:pt-4">
        <ProblemSection locale={locale} />
        <SolutionSection locale={locale} />
        <FeaturesSection locale={locale} />
        <SafetySection locale={locale} />
        <AudienceSection locale={locale} />
        <footer className={`${SECTION_OUTER} border-t border-border`}>
          <div className={`${SECTION_INNER} @[1000px]:grid @[1000px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] @[1000px]:items-start`}>
            <TransparencySection locale={locale} />
            <ClosingSection locale={locale} cta={cta} />
            <p className="type-body-small m-0 text-ink-muted @[1000px]:col-span-2">{t(copy.landing.footerLine, locale)}</p>
          </div>
        </footer>
      </div>
    </main>
  );
}

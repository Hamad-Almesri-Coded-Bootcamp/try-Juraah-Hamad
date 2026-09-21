import type { Locale } from '@/i18n/locale';
import type { LandingCta } from './types';
import { LandingHeader } from './Header';
import { Hero } from './Hero';
import { ProblemSection } from './ProblemSection';
import { SolutionSection } from './SolutionSection';
import { FeaturesSection } from './FeaturesSection';
import { AdherenceSection } from './AdherenceSection';
import { AudienceSection } from './AudienceSection';
import { SafetySection } from './SafetySection';
import { TransparencySection } from './TransparencySection';
import { ClosingSection } from './ClosingSection';

/**
 * L1 — the public landing page (docs/Acceptance Criteria and Test Plan.md, G11; docs/wireframes/
 * Landing.dc.html, Landing1440.dc.html). The ten sections, in the spec's order, as the boards draw
 * them. No tab bar, no data-layer call — `cta` is the only session-derived value, computed once by
 * `app/[locale]/page.tsx` via `resolveLandingCta` and threaded to the three places the primary
 * action repeats (header, hero, closing).
 */
export function LandingPage({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <div className="flex min-h-dvh flex-col bg-surface-app">
      <LandingHeader locale={locale} cta={cta} />
      <main id="main-content" className="mx-auto flex w-full max-w-content flex-col">
        <Hero locale={locale} cta={cta} />
        <ProblemSection locale={locale} />
        <SolutionSection locale={locale} />
        <FeaturesSection locale={locale} />
        <AdherenceSection locale={locale} />
        <AudienceSection locale={locale} />
        <SafetySection locale={locale} />
        <TransparencySection locale={locale} />
        <ClosingSection locale={locale} cta={cta} />
      </main>
    </div>
  );
}

import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { LandingHeader } from './Header';
import { HeroDial } from './HeroDial';
import { ScrollToButton } from './ScrollToButton';
import { SignInCta } from './SignInCta';
import type { LandingCta } from './types';

/**
 * Sections (1) and (2) on one navy sky (V2Landing): the header, then the hero, with one sentence of
 * value, one supporting line, the page's one primary action ("Sign in with Hawiati") beside a
 * secondary "See how it works", and the real day dial as the picture of the product (G11 item 2).
 *
 * At phone width everything stacks, the actions full width. Once `<main>` is 1000px wide the hero
 * becomes a row, the words first in reading order and the dial beside them. On the sky the theme
 * draws the primary light and the secondary as a glass outline (daylight.css, `.jr-sky .wsf-btn`).
 */
export function Hero({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <div className="jr-sky gap-5 pb-6 tablet:gap-6 tablet:py-5">
      <LandingHeader locale={locale} cta={cta} />
      <section
        aria-labelledby="hero-title"
        className="grid gap-5 pb-2 @[1000px]:grid-cols-[minmax(0,1fr)_auto] @[1000px]:items-center @[1000px]:gap-6 @[1000px]:py-5"
      >
        <div className="flex flex-col gap-4">
          <h1 id="hero-title" className="jr-display m-0 text-display @[1000px]:text-[3.5rem] @[1000px]:leading-[4.25rem]">
            {t(copy.landing.heroHeadline, locale)}
          </h1>
          <p className="jr-sky__eyebrow m-0 max-w-content text-body @[1000px]:text-h2 @[1000px]:font-normal">{t(copy.landing.heroSupportingLine, locale)}</p>
          <div className="flex flex-col gap-2 pt-2 @[600px]:flex-row @[600px]:flex-wrap [&>*]:w-full @[600px]:[&>*]:w-auto">
            <SignInCta {...cta} locale={locale} variant="primary" size="lg" />
            <ScrollToButton targetId="how-it-works" variant="secondary" size="lg" lang={locale}>
              {t(copy.landing.heroSeeHowItWorks, locale)}
            </ScrollToButton>
          </div>
        </div>
        <HeroDial locale={locale} />
      </section>
    </div>
  );
}

import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SignInCta } from './SignInCta';
import { ScrollToButton } from './ScrollToButton';
import { SECTION_GUTTER } from './layout';
import type { LandingCta } from './types';

/**
 * Section (2) — hero: one sentence of value, one supporting line, two actions, and a mockup of
 * the Today screen (G11 item 2).
 *
 * Two shapes, both from the approved boards. At phone (Landing.dc.html) everything stacks: the
 * headline, the line, two full-width actions, then the mockup card. Once the page is wide enough
 * (Landing1440.dc.html: a 620px text column beside a 390px mockup card) the hero becomes a row —
 * text first in reading order, the actions side by side at their own width, the mockup card fixed
 * at the image's intrinsic 390px so it is never stretched across the column. The switch keys off
 * `<main>`'s container width (`@[1000px]`), so a 1280 laptop gets the row as well as 1440.
 *
 * The mockup is the real B1 export (CR-019, swapped in at bundle c's gate by the lead):
 * `public/landing/today-preview.png`, a 2x screenshot of `/ar/app` as حمد on the day of
 * `REFERENCE_NOW` — tracking off, no status pills, the state G11 calls "a screen that exists".
 * Width/height are set so the layout reserves the same space with or without the image loading
 * (the images-unavailable required state), and the alt text is a full text alternative
 * (CR-019 / images-unavailable).
 */
export function Hero({ locale, cta }: { locale: Locale; cta: LandingCta }) {
  return (
    <section className={`flex flex-col gap-4 ${SECTION_GUTTER} @[1000px]:flex-row @[1000px]:items-center @[1000px]:gap-6 @[1000px]:py-6`}>
      <div className="flex flex-1 flex-col gap-4 @[1000px]:max-w-content">
        <h1 className="text-display text-navy">{t(copy.landing.heroHeadline, locale)}</h1>
        <p className="text-body text-ink-muted">{t(copy.landing.heroSupportingLine, locale)}</p>
        <div className="flex flex-col gap-2 @[1000px]:flex-row [&>*]:w-full @[1000px]:[&>*]:w-auto">
          <SignInCta {...cta} locale={locale} size="lg" />
          <ScrollToButton targetId="how-it-works" variant="secondary" size="lg" lang={locale}>
            {t(copy.landing.heroSeeHowItWorks, locale)}
          </ScrollToButton>
        </div>
      </div>
      <figure className="m-0 flex flex-col gap-2 rounded-lg border border-border bg-surface-card p-3 shadow-md @[1000px]:w-[390px] @[1000px]:shrink-0">
        <figcaption className="text-caption text-ink-muted">{t(copy.landing.heroMockupCaption, locale)}</figcaption>
        <img
          src="/landing/today-preview.png"
          width={390}
          height={844}
          alt={t(copy.landing.heroMockupAlt, locale)}
          className="h-auto w-full rounded-md"
        />
      </figure>
    </section>
  );
}

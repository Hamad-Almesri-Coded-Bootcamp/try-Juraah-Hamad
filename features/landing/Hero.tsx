import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SignInCta } from './SignInCta';
import { ScrollToButton } from './ScrollToButton';
import type { LandingCta } from './types';

/**
 * Section (2) — hero: one sentence of value, one supporting line, two actions, and a mockup of
 * the Today screen (G11 item 2).
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
    <section className="flex flex-col gap-4 p-3 tablet:p-5">
      <h1 className="text-display text-navy">{t(copy.landing.heroHeadline, locale)}</h1>
      <p className="text-body text-ink-muted">{t(copy.landing.heroSupportingLine, locale)}</p>
      <div className="flex flex-col gap-2">
        <SignInCta {...cta} locale={locale} size="lg" fullWidth />
        <ScrollToButton targetId="how-it-works" variant="secondary" size="lg" fullWidth lang={locale}>
          {t(copy.landing.heroSeeHowItWorks, locale)}
        </ScrollToButton>
      </div>
      <figure className="m-0 flex flex-col gap-2 rounded-md border border-border bg-surface-card p-3 shadow-sm">
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

import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SECTION_GUTTER } from './layout';
import { Card } from '@/components/ui/Card';

/**
 * Section (5) — six feature cards, each naming a feature that exists in the inventory (G11 item 5):
 * the unified record (B2), the day schedule (B1), interaction screening (C1/C2), refill requests
 * (D1), the photo drug check (C3), calendar sync (E1). No feature named here that the build lacks.
 * One card per row at phone (Landing.dc.html), three across from tablet, all six in one row once
 * the page is wide enough for it (Landing1440.dc.html draws the single row at 1440).
 */
export function FeaturesSection({ locale }: { locale: Locale }) {
  const features = [
    [copy.landing.feature1Title, copy.landing.feature1Body],
    [copy.landing.feature2Title, copy.landing.feature2Body],
    [copy.landing.feature3Title, copy.landing.feature3Body],
    [copy.landing.feature4Title, copy.landing.feature4Body],
    [copy.landing.feature5Title, copy.landing.feature5Body],
    [copy.landing.feature6Title, copy.landing.feature6Body],
  ] as const;
  return (
    <section className={`flex flex-col gap-3 border-y border-border bg-surface-card ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.featuresHeading, locale)}</h2>
      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-3 @[1200px]:grid-cols-6">
        {features.map(([title, body], i) => (
          <Card key={i} className="flex flex-col gap-2">
            <span className="text-body-strong">{t(title, locale)}</span>
            <span className="text-body-small text-ink-muted">{t(body, locale)}</span>
          </Card>
        ))}
      </div>
    </section>
  );
}

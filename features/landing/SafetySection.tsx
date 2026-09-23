import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SECTION_GUTTER } from './layout';
import { Card } from '@/components/ui/Card';

/**
 * Section (8) — safety and privacy: the app never records a dose by itself (G1), a danger finding
 * stops at a human reviewer, screening is grounded in published drug data (G11 item 8). Plain
 * factual statements, not an alert — `danger` stays out of this section entirely (UX Principles
 * §8: "danger never exceeds 5–10% of a screen" and belongs to an actual finding, not to marketing
 * copy about the feature).
 */
export function SafetySection({ locale }: { locale: Locale }) {
  const items = [
    [copy.landing.safety1Title, copy.landing.safety1Body],
    [copy.landing.safety2Title, copy.landing.safety2Body],
    [copy.landing.safety3Title, copy.landing.safety3Body],
  ] as const;
  return (
    <section className={`flex flex-col gap-3 ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.safetyHeading, locale)}</h2>
      <div className="flex flex-col gap-4 tablet:flex-row">
        {items.map(([title, body], i) => (
          <Card key={i} className="flex flex-1 flex-col gap-2">
            <span className="text-body-strong">{t(title, locale)}</span>
            <span className="text-body-small text-ink-muted">{t(body, locale)}</span>
          </Card>
        ))}
      </div>
    </section>
  );
}

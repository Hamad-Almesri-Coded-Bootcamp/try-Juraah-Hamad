import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SECTION_GUTTER } from './layout';
import { Card } from '@/components/ui/Card';

/**
 * Section (4) — the solution in three steps (G11 item 4). Carries the `how-it-works` anchor the
 * hero's secondary action jumps to.
 */
export function SolutionSection({ locale }: { locale: Locale }) {
  const steps = [
    [copy.landing.solutionStep1Title, copy.landing.solutionStep1Body],
    [copy.landing.solutionStep2Title, copy.landing.solutionStep2Body],
    [copy.landing.solutionStep3Title, copy.landing.solutionStep3Body],
  ] as const;
  return (
    <section id="how-it-works" className={`flex flex-col gap-3 ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.solutionHeading, locale)}</h2>
      <div className="flex flex-col gap-4 tablet:flex-row">
        {steps.map(([title, body], i) => (
          <Card key={i} className="flex-1">
            <span className="text-body-strong">{t(title, locale)}</span>
            <span className="text-body-small text-ink-muted">{t(body, locale)}</span>
          </Card>
        ))}
      </div>
    </section>
  );
}

import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SECTION_GUTTER } from './layout';
import { Card } from '@/components/ui/Card';

/** Section (3) — the problem, in two parts: instruction loss, and fragmented records (G11 item 3). */
export function ProblemSection({ locale }: { locale: Locale }) {
  return (
    <section className={`flex flex-col gap-3 border-y border-border bg-surface-card ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.problemHeading, locale)}</h2>
      <div className="flex flex-col gap-4 tablet:flex-row">
        <Card className="flex flex-1 flex-col gap-2">
          <span className="text-body-strong">{t(copy.landing.problemInstructionsTitle, locale)}</span>
          <span className="text-body-small text-ink-muted">{t(copy.landing.problemInstructionsBody, locale)}</span>
        </Card>
        <Card className="flex flex-1 flex-col gap-2">
          <span className="text-body-strong">{t(copy.landing.problemRecordsTitle, locale)}</span>
          <span className="text-body-small text-ink-muted">{t(copy.landing.problemRecordsBody, locale)}</span>
        </Card>
      </div>
    </section>
  );
}

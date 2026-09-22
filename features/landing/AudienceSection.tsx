import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { SECTION_GUTTER } from './layout';
import { Card } from '@/components/ui/Card';
import { NavigateButton } from '@/features/shell/NavigateButton';

/**
 * Section (7) — who it's for: the patient, the family caregiver (who enters with the same Civil
 * ID after being invited and accepting), and one plain line naming the reviewer path **without
 * linking it** (G11 item 7 / pass criteria: "the clinic route is not linked or named" — this line
 * names the audience, "clinical reviewers", never the route or the word "clinic route").
 *
 * Both buttons here go to the same sign-in route regardless of a viewer's session — this section
 * frames the two audiences the product serves, not the repeated primary action (header/hero/
 * closing carry that, and read the continue-variant copy per `resolveLandingCta`).
 */
export function AudienceSection({ locale }: { locale: Locale }) {
  return (
    <section className={`flex flex-col gap-3 border-y border-border bg-surface-card ${SECTION_GUTTER}`}>
      <h2 className="text-h2 text-navy">{t(copy.landing.audienceHeading, locale)}</h2>
      <div className="flex flex-col gap-4 tablet:flex-row">
        <Card className="flex flex-1 flex-col gap-2">
          <span className="text-body-strong">{t(copy.landing.audiencePatientTitle, locale)}</span>
          <span className="text-body-small text-ink-muted">{t(copy.landing.audiencePatientBody, locale)}</span>
          <NavigateButton href={`/${locale}/signin`} variant="secondary" fullWidth lang={locale}>
            {t(copy.landing.audiencePatientCta, locale)}
          </NavigateButton>
        </Card>
        <Card className="flex flex-1 flex-col gap-2">
          <span className="text-body-strong">{t(copy.landing.audienceCaregiverTitle, locale)}</span>
          <span className="text-body-small text-ink-muted">{t(copy.landing.audienceCaregiverBody, locale)}</span>
          <NavigateButton href={`/${locale}/signin`} variant="secondary" fullWidth lang={locale}>
            {t(copy.landing.audienceCaregiverCta, locale)}
          </NavigateButton>
        </Card>
      </div>
      <p className="text-caption text-ink-muted">{t(copy.landing.audienceReviewerNote, locale)}</p>
    </section>
  );
}

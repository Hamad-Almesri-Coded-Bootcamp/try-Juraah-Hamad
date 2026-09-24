import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { Card } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { SECTION_HEADING, SECTION_INNER, SECTION_OUTER } from './layout';

/**
 * Section (7): who it is for. Two equal cards, the patient and the family caregiver (who enters with
 * their own Civil ID after being invited and accepting), each with its own sign-in action, and one
 * plain line naming the reviewers' separate address without linking or naming the route (G11 item 7).
 * Both actions are `secondary`: the hero holds the page's one primary.
 */
export function AudienceSection({ locale }: { locale: Locale }) {
  const cards = [
    ['person', copy.landing.audiencePatientTitle, copy.landing.audiencePatientBody, copy.landing.audiencePatientCta],
    ['users', copy.landing.audienceCaregiverTitle, copy.landing.audienceCaregiverBody, copy.landing.audienceCaregiverCta],
  ] as const;
  return (
    <section aria-labelledby="audience-title" className={SECTION_OUTER}>
      <div className={SECTION_INNER}>
        <h2 id="audience-title" className={SECTION_HEADING}>
          {t(copy.landing.audienceHeading, locale)}
        </h2>
        <div className="grid gap-4 @[700px]:grid-cols-2 @[700px]:gap-5">
          {cards.map(([icon, title, body, cta]) => (
            <Card key={title.en} className="flex flex-col items-start gap-3 p-5">
              <span className="inline-flex size-hit-lg items-center justify-center rounded-full bg-navy-tint text-navy" aria-hidden="true">
                <Icon name={icon} />
              </span>
              <h3 className="type-h2 m-0 text-navy">{t(title, locale)}</h3>
              <p className="type-body m-0 flex-1 text-ink-muted">{t(body, locale)}</p>
              <NavigateButton href={`/${locale}/signin`} variant="secondary" size="lg" lang={locale}>
                {t(cta, locale)}
              </NavigateButton>
            </Card>
          ))}
        </div>
        <p className="type-body-small m-0 text-ink-muted">{t(copy.landing.audienceReviewerNote, locale)}</p>
      </div>
    </section>
  );
}

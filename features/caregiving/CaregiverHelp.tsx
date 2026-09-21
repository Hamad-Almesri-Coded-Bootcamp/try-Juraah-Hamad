/**
 * F5 — caregiver help (docs/wireframes/CaregiverHelp.dc.html). Static copy only, written for the
 * relative (SCREENS.md): what they can and cannot see, what to do on a danger alert, tracking-off,
 * and how to be re-invited. No data function — none is listed for F5 in docs/SCREENS.md.
 */
import { Card } from '@/components/ui/Card';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export function CaregiverHelp({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      <Card>
        <span className="type-body-strong">{t(copy.caregiving.f5CanSeeTitle, locale)}</span>
        <span className="type-body-small">{t(copy.caregiving.f5CanSeeBody, locale)}</span>
      </Card>
      <Card>
        <span className="type-body-strong">{t(copy.caregiving.f5CannotTitle, locale)}</span>
        <span className="type-body-small">{t(copy.caregiving.f5CannotBody, locale)}</span>
      </Card>
      <Card>
        <span className="type-body-strong">{t(copy.caregiving.f5DangerTitle, locale)}</span>
        <span className="type-body-small">{t(copy.caregiving.f5DangerBody, locale)}</span>
      </Card>
      <Card>
        <span className="type-body-strong">{t(copy.caregiving.f5TrackingOffTitle, locale)}</span>
        <span className="type-body-small">{t(copy.caregiving.f5TrackingOffBody, locale)}</span>
      </Card>
      <Card>
        <span className="type-body-strong">{t(copy.caregiving.f5AccessEndedTitle, locale)}</span>
        <span className="type-body-small">{t(copy.caregiving.f5AccessEndedBody, locale)}</span>
      </Card>
    </div>
  );
}

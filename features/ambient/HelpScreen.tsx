/**
 * E4 — help & support (patient) (`docs/wireframes/Help.dc.html`): static copy from the catalogue,
 * per SCREENS.md's topic list. No data function (`none (copy catalogue only)`), no clinical advice.
 */
import { Card } from '@/components/ui/Card';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

export function HelpScreen({ locale }: { locale: Locale }) {
  return (
    <div className="flex flex-col gap-3" data-testid="help-screen">
      <Card className="flex flex-col gap-2">
        <span className="type-body-strong">{t(copy.ambient.e4HowItWorksTitle, locale)}</span>
        <span className="type-body-small">{t(copy.ambient.e4HowItWorksBody, locale)}</span>
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="type-body-strong">{t(copy.ambient.e4CheckInsTitle, locale)}</span>
        <span className="type-body-small">{t(copy.ambient.e4CheckInsBody, locale)}</span>
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="type-body-strong">{t(copy.ambient.e4DoseWrongTitle, locale)}</span>
        <span className="type-body-small">{t(copy.ambient.e4DoseWrongBody, locale)}</span>
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="type-body-strong">{t(copy.ambient.e4SafetyAlertTitle, locale)}</span>
        <span className="type-body-small">{t(copy.ambient.e4SafetyAlertBody, locale)}</span>
      </Card>
      <Card className="flex flex-col gap-2">
        <span className="type-body-strong">{t(copy.ambient.e4ContactClinicTitle, locale)}</span>
        <span className="type-body-small">{t(copy.ambient.e4ContactClinicBody, locale)}</span>
      </Card>
      <p className="type-caption">{t(copy.ambient.e4NoAdviceNote, locale)}</p>
    </div>
  );
}

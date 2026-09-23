import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverMedicines } from '@/features/caregiving/CaregiverMedicines';
import { copy, t } from '@/i18n';

/**
 * F2 — caregiver home, Medicines (docs/wireframes/CaregiverHome.dc.html). The app bar carries the
 * caregiver tab's own title and the language switch, as F3 does (UX Principles §1 and §12; audit
 * C7). A top-level tab destination, so there is no back control.
 */
export default async function CaregiverMedicinesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.shell.careTabMedicines, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverMedicines caregiverId={session.subjectId} locale={locale} />
    </div>
  );
}

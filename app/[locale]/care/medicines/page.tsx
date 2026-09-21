import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { requireRole } from '@/features/shell/gate';
import { CaregiverMedicines } from '@/features/caregiving/CaregiverMedicines';

/** F2 — caregiver home, Medicines (docs/wireframes/CaregiverHome.dc.html). */
export default async function CaregiverMedicinesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  return <CaregiverMedicines caregiverId={session.subjectId} locale={locale} />;
}

import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { MoreMenu } from '@/features/shell/MoreMenu';

/** The caregiver shell's More tab (shared shell chrome, not a counted screen). Real, not a placeholder. */
export default async function CaregiverMorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <MoreMenu role="caregiver" locale={locale} />;
}

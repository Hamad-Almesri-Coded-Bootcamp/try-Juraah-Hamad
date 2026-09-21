import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { MoreMenu } from '@/features/shell/MoreMenu';

/**
 * The patient shell's More tab (shared shell chrome, not a counted screen — SCREENS.md). Real, not
 * a placeholder: WP3 builds this list itself.
 */
export default async function PatientMorePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <MoreMenu role="patient" locale={locale} />;
}

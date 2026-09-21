import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { ProfileScreen } from '@/features/identity/ProfileScreen';

/** A3 — profile / account (patient). `app/[locale]/app/layout.tsx` (WP3's) already `requireRole`s
 * this route to `patient` and keeps the tab bar showing (it starts with `/app/more`). */
export default async function ProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <ProfileScreen locale={locale} />;
}

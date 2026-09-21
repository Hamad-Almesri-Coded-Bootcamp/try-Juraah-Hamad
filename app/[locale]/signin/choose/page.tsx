import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getRoleOptions } from '@/lib/session';
import { homePathFor } from '@/features/shell/tabs';
import { RoleChooser } from '@/features/identity/RoleChooser';

/**
 * A1b — role chooser. Reached only from `signIn`'s `multiple_roles` outcome (patient + caregiver;
 * the clinic pair goes to `/clinic/choose` instead — see `gate/page.tsx`). Defensive redirects
 * mirror `gate/page.tsx`'s own fallback: no options → sign in again; exactly one → straight to that
 * shell's home (a single-role ID must never see this screen, ROLES.md pass criterion).
 */
export default async function SignInChoosePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const options = await getRoleOptions();
  if (options.length === 0) redirect(`/${locale}/signin`);
  if (options.length === 1 && options[0]) redirect(homePathFor(options[0].role, locale));

  return <RoleChooser options={options} locale={locale} />;
}

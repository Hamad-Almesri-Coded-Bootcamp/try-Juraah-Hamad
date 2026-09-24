import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getRoleOptions, getSession } from '@/lib/session';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
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

  const [options, session] = await Promise.all([getRoleOptions(), getSession()]);
  if (options.length === 0) redirect(`/${locale}/signin`);
  if (options.length === 1 && options[0]) redirect(homePathFor(options[0].role, locale));

  return (
    <RoleChooser
      options={options}
      locale={locale}
      actions={<LanguageSwitch locale={locale} role={session?.role} subjectId={session?.subjectId} />}
    />
  );
}

import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { copy, t } from '@/i18n';
import { getSession } from '@/lib/session';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';

/**
 * A1/A1b's layout: no shell, no tab bar — only the minimal header the boards draw (app name, the
 * language switch) that navigation.md describes for sign-in ("no tabs, no navigation, nothing to
 * get lost in").
 */
export default async function SignInLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await getSession();

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppBar title={t(copy.shell.appName, locale)} action={<LanguageSwitch locale={locale} role={session?.role} subjectId={session?.subjectId} />} />
      <div id="main-content" className="flex-1">
        {children}
      </div>
    </div>
  );
}

import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { copy, t } from '@/i18n';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireSession } from '@/features/shell/gate';

/**
 * F0's layout: no shell, only the app bar with the language switch (WP3 brief) — the consent
 * screen's only ways out are its own two buttons (navigation.md), so no back control, no tab bar.
 * `requireSession` is the loose gate rule (1) describes for `/invitation`: any signed-in session may
 * reach it; whether it actually names an invitation to answer is the data layer's own, precise check.
 */
export default async function InvitationLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireSession(locale);

  return (
    <div className="relative flex min-h-dvh flex-col">
      <AppBar title={t(copy.shell.appName, locale)} action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />} />
      <div id="main-content" className="flex-1">
        {children}
      </div>
    </div>
  );
}

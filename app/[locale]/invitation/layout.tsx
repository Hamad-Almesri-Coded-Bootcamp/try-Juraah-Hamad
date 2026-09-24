import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { copy, t } from '@/i18n';
import { Brand } from '@/components/ui/Brand';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { isServerActionRender } from '@/features/shell/request';

/**
 * F0's layout: no shell, only the app bar with the language switch (WP3 brief) — the consent
 * screen's only ways out are its own two buttons (navigation.md), so no back control, no tab bar.
 * The gate below is the loose rule (1) describes for `/invitation`: any signed-in session may reach
 * it; whether it actually names an invitation to answer is the data layer's own, precise check.
 */
export default async function InvitationLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  // The loose gate rule (1) describes — any signed-in session — with one exception: the render that
  // follows a decline, inside the same Server Action request that ended the pending-only session
  // (audit C9). Without it the person who just declined was bounced to /signin and never saw the
  // acknowledgement F0 requires. That render shows only the acknowledgement: with no session the
  // page asks the data layer for no invitation at all, so nothing is revealed.
  const session = await getSession();
  if (!session && !(await isServerActionRender())) redirect(`/${locale}/signin`);

  return (
    // F0's only exits are its two answers: no assistant here (CR-069(k)).
    <div className="relative flex min-h-dvh flex-col" data-no-assistant="">
      {/* The bar names the product, not the screen: F0's own heading is the page's one h1. */}
      <header className="wsf-appbar">
        <Brand name={t(copy.shell.appName, locale)} className="jr-wordmark" />
        <LanguageSwitch locale={locale} role={session?.role} subjectId={session?.subjectId} assistant={false} />
      </header>
      <div id="main-content" className="flex-1">
        {children}
      </div>
    </div>
  );
}

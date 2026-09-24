import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { copy, t } from '@/i18n';
import { requireRole } from '@/features/shell/gate';
import { currentPath } from '@/features/shell/request';
import { AppShell } from '@/features/shell/AppShell';
import { patientTabs } from '@/features/shell/tabs';

/**
 * The patient shell (`/[locale]/app/**`): `requireRole` re-checks the session server-side (point 2
 * of ROLES.md's three-place enforcement) and renders nothing for the wrong role.
 *
 * Navigation chrome by screen (D-010): the four tab roots and every More sub-page carry the TabBar
 * at every width (the boards keep it there — Profile, Settings, Caregivers, … all with `more`
 * current). The deeper pushed screens (prescription/alert detail, add/scan, drug check) carry no
 * bottom bar below 834px — none of their 390 boards draws one — but keep the side rail from 834px
 * up, where navigation.md's side navigation is persistent and the rail marks the tab the screen
 * was pushed from. First-run setup (A2) is the one screen with no chrome at any width: it runs once,
 * step by step, before the shell has anything to navigate.
 */
export default async function PatientShellLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireRole(locale, ['patient']);

  const path = await currentPath();

  if (path.startsWith('/app/setup')) {
    return (
      // First-run setup carries no chrome and no assistant (CR-069(k)).
      <div className="relative min-h-dvh" id="main-content" data-no-assistant="">
        {children}
      </div>
    );
  }

  const isTabRoot = path === '/app' || path === '/app/medicines' || path === '/app/safety' || path.startsWith('/app/more');
  const value = path.startsWith('/app/more')
    ? 'more'
    : path.startsWith('/app/medicines')
      ? 'medicines'
      : path.startsWith('/app/safety')
        ? 'safety'
        : 'today';

  return (
    <AppShell
      items={patientTabs(locale)}
      value={value}
      label={t(copy.shell.mainNavigationLabel, locale)}
      wordmark={t(copy.shell.appName, locale)}
      railOnly={!isTabRoot}
      tabRootPaths={[`/${locale}/app`, `/${locale}/app/medicines`, `/${locale}/app/safety`]}
      tabRootPrefixes={[`/${locale}/app/more`]}
    >
      <div id="main-content">{children}</div>
    </AppShell>
  );
}

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
 * of ROLES.md's three-place enforcement) and renders nothing for the wrong role. The TabBar shows on
 * the four tab roots and every More sub-page (the boards keep it there — Profile, Settings,
 * Caregivers, … all carry it with `more` current) and hides on the deeper pushed screens (setup,
 * prescription/alert detail, add/scan, drug check — none of those boards carry a TabBar).
 */
export default async function PatientShellLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  await requireRole(locale, ['patient']);

  const path = await currentPath();
  const showTabs = path === '/app' || path === '/app/medicines' || path === '/app/safety' || path.startsWith('/app/more');

  if (!showTabs) {
    return (
      <div className="relative min-h-dvh" id="main-content">
        {children}
      </div>
    );
  }

  const value = path.startsWith('/app/more') ? 'more' : path === '/app/medicines' ? 'medicines' : path === '/app/safety' ? 'safety' : 'today';

  return (
    <AppShell items={patientTabs(locale)} value={value} label={t(copy.shell.mainNavigationLabel, locale)}>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}

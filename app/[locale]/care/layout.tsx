import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { copy, t } from '@/i18n';
import { requireRole } from '@/features/shell/gate';
import { currentPath } from '@/features/shell/request';
import { AppShell } from '@/features/shell/AppShell';
import { caregiverTabs } from '@/features/shell/tabs';
import { CaregiverBanner } from '@/features/shell/CaregiverBanner';

/**
 * The caregiver shell (`/[locale]/care/**`): `requireRole` re-checks the session server-side, and
 * `CaregiverBanner` renders on every screen of this shell (UX Principles §10) — unlike the patient
 * shell, the boards keep the TabBar visible even on pushed detail screens here (CaregiverDetail),
 * so this layout never hides it.
 */
export default async function CaregiverShellLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  const path = await currentPath();
  const value = path.startsWith('/care/more') ? 'more' : path === '/care' ? 'today' : 'medicines';

  return (
    <AppShell items={caregiverTabs(locale)} value={value} label={t(copy.shell.mainNavigationLabel, locale)} wordmark={t(copy.shell.appName, locale)}>
      <div className="sticky top-0 z-10">
        <CaregiverBanner caregiverId={session.subjectId} locale={locale} />
      </div>
      <div id="main-content">{children}</div>
    </AppShell>
  );
}

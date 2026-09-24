import type { ReactNode } from 'react';
import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession, getRoleOptions } from '@/lib/session';
import { requireRole } from '@/features/shell/gate';
import { currentPath } from '@/features/shell/request';
import { ClinicNav } from '@/features/shell/ClinicNav';
import type { Role } from '@/types/views';

/**
 * The clinic shell (`/[locale]/clinic/**`): one layout for both X0's entry (no chrome — "none
 * until a role resolves", SCREENS.md) and the two-destination shell behind it (`ClinicNav`),
 * distinguished by the pathname proxy.ts stamps on the request (`x-jurah-path`, read via
 * `features/shell/request.ts`) since a Server Component layout gets no pathname of its own.
 *
 * Board gap recorded in DECISIONS.md: `ReviewerQueue.dc.html` and `ReviewerDecision.dc.html` omit
 * the TabBar the written spec (G8) and the `FieldQueue`/`AuditLog` boards both keep — the spec wins,
 * so this shell renders it on every screen behind X0, including G1s/G2s.
 */
export default async function ClinicShellLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const path = await currentPath();
  const isEntry = path === '/clinic' || path === '/clinic/choose';

  if (isEntry) {
    // proxy.ts already redirects a patient/caregiver session away from X0 (rule 1); this re-check
    // is the layout's own point-2 defence, against the real session module rather than the cookie.
    const session = await getSession();
    if (session && !session.pendingInvitationOnly && session.role !== 'reviewer' && session.role !== 'admin') {
      redirect(`/${locale}/gate`);
    }
    return (
      // The assistant is not offered anywhere in the clinic (CR-069(k)).
      <div className="relative min-h-dvh" id="main-content" data-no-assistant="">
        {children}
      </div>
    );
  }

  const requiredRole: Role = path.startsWith('/clinic/audit') ? 'admin' : 'reviewer';
  const session = await requireRole(locale, [requiredRole], { noSessionTarget: '/clinic' });
  const options = await getRoleOptions();
  const roles = options.map((o) => o.role);
  const switchOption = options.find((o) => o.role !== session.role);
  const active = path.startsWith('/clinic/audit') ? 'audit' : 'review';

  return (
    <ClinicNav locale={locale} active={active} roles={roles} switchOption={switchOption}>
      <div id="main-content" data-no-assistant="">
        {children}
      </div>
    </ClinicNav>
  );
}

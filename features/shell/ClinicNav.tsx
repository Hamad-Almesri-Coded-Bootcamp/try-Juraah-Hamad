import { ContextBanner } from '@/components/ui/ContextBanner';
import type { TabBarItems } from '@/components/ui/TabBar';
import { AppShell } from './AppShell';
import { RoleSwitch } from './RoleSwitch';
import { SignOutButton } from './SignOutButton';
import { clinicTabs } from './tabs';
import { copy, t } from '@/i18n';
import type { ReactNode } from 'react';
import type { Locale } from '@/i18n/locale';
import type { Role, RoleOption } from '@/types/views';

const ROLE_LABEL: Record<'reviewer' | 'admin', (locale: Locale) => string> = {
  reviewer: (l) => t(copy.shell.clinicRoleReviewer, l),
  admin: (l) => t(copy.shell.clinicRoleAdmin, l),
};

/**
 * The clinic shell's chrome, on the shared `AppShell`: the simulated-role banner on every screen
 * (G9 — "medical review (simulated)" in words, never the role string), the Review/Audit
 * destinations built from the signed-in role SET (never filtered down from a fixed two — TabBar.md;
 * a single-role account gets no bar, CR-030, and the rail column still stands), the clinic wordmark
 * at the top of the rail (boards ReviewerDesktop · AuditLog1440), and the role switch and sign-out
 * at the bottom of the same rail column (CR-020) — one column, not two. At phone width the quiet
 * sign-out sits beside the banner (D-007).
 *
 * The content column is capped at `--spacing-content-wide` rather than the reading cap: navigation.md
 * lets the audit log and the reviewer queues use the extra width for their columns (D-011). Screens
 * that are forms or single lists (X0, G3s's detail) cap themselves at `max-w-content` inside it.
 */
export function ClinicNav({
  locale,
  active,
  roles,
  switchOption,
  children,
}: {
  locale: Locale;
  active: 'review' | 'audit';
  roles: readonly Role[];
  switchOption?: RoleOption;
  children: ReactNode;
}) {
  const items = clinicTabs(locale, roles);
  const roleLabel = active === 'review' ? ROLE_LABEL.reviewer(locale) : ROLE_LABEL.admin(locale);
  const banner = <ContextBanner variant="simulated" title={t(copy.vocabulary.simulatedRole, locale)} detail={roleLabel} icon="shield" />;

  return (
    <AppShell
      items={items.length >= 2 ? (items as TabBarItems) : undefined}
      value={active}
      label={t(copy.shell.mainNavigationLabel, locale)}
      wordmark={t(copy.shell.clinicWordmark, locale)}
      contentClassName="tablet:max-w-content-wide"
      beforeContent={
        <>
          <div className="sticky top-0 z-10 flex items-center justify-between gap-2 tablet:hidden">
            <ContextBanner variant="simulated" title={t(copy.vocabulary.simulatedRole, locale)} detail={roleLabel} icon="shield" className="flex-1" />
            <SignOutButton locale={locale} variant="quiet" />
          </div>
          <div className="hidden tablet:block">{banner}</div>
        </>
      }
      railFooter={
        <>
          {switchOption && <RoleSwitch option={switchOption} locale={locale} />}
          <SignOutButton locale={locale} variant="secondary" fullWidth />
        </>
      }
    >
      {children}
    </AppShell>
  );
}

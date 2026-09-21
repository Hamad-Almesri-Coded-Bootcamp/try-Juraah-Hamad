import { ContextBanner } from '@/components/ui/ContextBanner';
import { TabBar, type TabBarItems } from '@/components/ui/TabBar';
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
 * The clinic shell's chrome: the simulated-role banner on every screen (G9 — "medical review
 * (simulated)" in words, never the role string), the Review/Audit destinations built from the
 * signed-in role SET (never filtered down from a fixed two — TabBar.md; see the report's
 * needed-change request for the single-role case, where TabBar's own type refuses a one-item tuple
 * and this renders no bar at all rather than a disabled or invented second tab), and the sign-out
 * control CR-020 places at the bottom of the rail — mirrored here as a quiet control beside the
 * banner at phone width, since the clinic screens this wraps carry no shared AppBar action slot of
 * their own to hold it (flagged as an interpretation in the WP3 report).
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

  return (
    <div className="relative flex h-dvh flex-col tablet:flex-row">
      <div className="flex-1 overflow-y-auto">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-2 tablet:hidden">
          <ContextBanner variant="simulated" title={t(copy.vocabulary.simulatedRole, locale)} detail={roleLabel} icon="shield" className="flex-1" />
          <SignOutButton locale={locale} variant="quiet" />
        </div>
        <div className="hidden tablet:block">
          <ContextBanner variant="simulated" title={t(copy.vocabulary.simulatedRole, locale)} detail={roleLabel} icon="shield" />
        </div>
        <div className="mx-auto w-full desktop:max-w-content">{children}</div>
      </div>
      {items.length >= 2 && (
        <TabBar items={items as TabBarItems} value={active} layout="auto" label={t(copy.shell.mainNavigationLabel, locale)} className="tablet:order-first" />
      )}
      <div className="hidden flex-col gap-2 p-3 tablet:order-first tablet:flex">
        {switchOption && <RoleSwitch option={switchOption} locale={locale} />}
        <SignOutButton locale={locale} variant="secondary" fullWidth />
      </div>
    </div>
  );
}

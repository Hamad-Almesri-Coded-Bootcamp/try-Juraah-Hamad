import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Role } from '@/types/views';
import type { TabBarItem, TabBarItems } from '@/components/ui/TabBar';

/** The patient shell's four destinations (G8) — fixed, never filtered. */
export function patientTabs(locale: Locale): TabBarItems {
  return [
    { id: 'today', label: t(copy.shell.tabToday, locale), icon: 'clock', href: `/${locale}/app` },
    { id: 'medicines', label: t(copy.shell.tabMedicines, locale), icon: 'capsule', href: `/${locale}/app/medicines` },
    { id: 'safety', label: t(copy.shell.tabSafety, locale), icon: 'shield', href: `/${locale}/app/safety` },
    { id: 'more', label: t(copy.shell.tabMore, locale), icon: 'settings', href: `/${locale}/app/more` },
  ];
}

/** The caregiver shell's three destinations — its own item set, not the patient's filtered down
 * (navigation.md: "the caregiver shell does not reuse the patient's items"). */
export function caregiverTabs(locale: Locale): TabBarItems {
  return [
    { id: 'today', label: t(copy.shell.careTabToday, locale), icon: 'clock', href: `/${locale}/care` },
    {
      id: 'medicines',
      label: t(copy.shell.careTabMedicines, locale),
      icon: 'capsule',
      href: `/${locale}/care/medicines`,
      // A read-only alert opens from the caregiver's Medicines (F2 → F3), so it stays under that tab.
      activePrefixes: [`/${locale}/care/alerts`],
    },
    { id: 'more', label: t(copy.shell.careTabMore, locale), icon: 'settings', href: `/${locale}/care/more` },
  ];
}

/**
 * The clinic shell's items, built from the signed-in role SET, never filtered down from a fixed
 * two (TabBar.md, WHAT TO BUILD): reviewer-only → Review only; admin-only → Audit only; both → both.
 * TabBar's own type refuses a single-item tuple (`[T,T] | [T,T,T] | [T,T,T,T]`), so a one-role
 * account gets no bar at all here — see the WP3 report's needed-change request against
 * components/ui/TabBar.tsx.
 */
export function clinicTabs(locale: Locale, roles: readonly Role[]): TabBarItem[] {
  const items: TabBarItem[] = [];
  if (roles.includes('reviewer')) items.push({ id: 'review', label: t(copy.shell.tabReview, locale), icon: 'review', href: `/${locale}/clinic/review` });
  if (roles.includes('admin')) items.push({ id: 'audit', label: t(copy.shell.tabAudit, locale), icon: 'inbox', href: `/${locale}/clinic/audit` });
  return items;
}

/** Where a role's own shell home is — used by A0 (the session gate) and RoleSwitch (never signOut). */
export function homePathFor(role: Role, locale: Locale): string {
  switch (role) {
    case 'patient':
      return `/${locale}/app`;
    case 'caregiver':
      return `/${locale}/care`;
    case 'reviewer':
      return `/${locale}/clinic/review`;
    case 'admin':
      return `/${locale}/clinic/audit`;
  }
}

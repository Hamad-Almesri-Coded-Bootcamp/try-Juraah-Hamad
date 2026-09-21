import { AppBar } from '@/components/ui/AppBar';
import { MenuRow } from '@/components/ui/MenuRow';
import { LanguageSwitch } from './LanguageSwitch';
import { RoleSwitch } from './RoleSwitch';
import { interpolate } from './interpolate';
import { getRoleOptions, getSession } from '@/lib/session';
import { getPendingInvitationsForSubject } from '@/lib/data';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { CopyEntry } from '@/i18n/copy/shell';
import type { IconName } from '@/components/ui/Icon';

interface Row {
  label: CopyEntry;
  icon: IconName;
  path: string;
}

/** G8 order, patient shell: Refill · Calendar sync · Notifications & messaging · Caregivers ·
 * Activity · Settings · Profile · Help. */
const PATIENT_ROWS: Row[] = [
  { label: copy.shell.moreRefill, icon: 'refresh', path: '/app/more/refill' },
  { label: copy.shell.moreCalendar, icon: 'calendar', path: '/app/more/calendar' },
  { label: copy.shell.moreNotifications, icon: 'link', path: '/app/more/notifications' },
  { label: copy.shell.moreCaregivers, icon: 'users', path: '/app/more/caregivers' },
  { label: copy.shell.moreActivity, icon: 'clock', path: '/app/more/activity' },
  { label: copy.shell.moreSettings, icon: 'settings', path: '/app/more/settings' },
  { label: copy.shell.moreProfile, icon: 'home', path: '/app/more/profile' },
  { label: copy.shell.moreHelp, icon: 'info', path: '/app/more/help' },
];

/** Caregiver shell: Activity · Profile & notifications · Help — no Settings row (F4, CLAUDE.md rule 8). */
const CAREGIVER_ROWS: Row[] = [
  { label: copy.shell.moreActivity, icon: 'clock', path: '/care/more/activity' },
  { label: copy.shell.moreProfileNotifications, icon: 'home', path: '/care/more/profile' },
  { label: copy.shell.moreHelp, icon: 'info', path: '/care/more/help' },
];

/**
 * The shared More screen for both shells (WP3, not a counted screen): the fixed item set in G8
 * order, the in-shell role switch when the signed-in Civil ID holds a second active role, and — for
 * a patient only — the quiet pending-invitation notice (B1/More, F0's second entry point) when
 * `getPendingInvitationsForSubject` is non-empty. No write control lives here (G1): every row only
 * navigates.
 */
export async function MoreMenu({ role, locale }: { role: 'patient' | 'caregiver'; locale: Locale }) {
  const [session, options, pendingInvitations] = await Promise.all([
    getSession(),
    getRoleOptions(),
    role === 'patient' ? getPendingInvitationsForSubject() : Promise.resolve([]),
  ]);
  const otherRole = options.find((o) => o.role !== role);
  const rows = role === 'patient' ? PATIENT_ROWS : CAREGIVER_ROWS;
  const title = role === 'patient' ? copy.shell.tabMore : copy.shell.careTabMore;

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(title, locale)}
        action={<LanguageSwitch locale={locale} role={role} subjectId={role === 'patient' ? session?.subjectId : undefined} />}
      />
      <div className="flex flex-col">
        {rows.map((row) => (
          <MenuRow key={row.path} label={t(row.label, locale)} icon={row.icon} href={`/${locale}${row.path}`} />
        ))}
        {pendingInvitations.map((invitation) => (
          <MenuRow
            key={invitation.id}
            label={interpolate(t(copy.shell.pendingInvitationNoticeTemplate, locale), { name: invitation.patientFirstName })}
            value={t(copy.shell.pendingInvitationNoticeValue, locale)}
            tone="relationship"
            href={`/${locale}/invitation?id=${invitation.id}`}
          />
        ))}
        {otherRole && <RoleSwitch option={otherRole} locale={locale} />}
      </div>
    </div>
  );
}

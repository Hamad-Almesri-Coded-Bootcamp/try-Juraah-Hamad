import type { ReactNode } from 'react';
import { AppBar } from '@/components/ui/AppBar';
import { MenuRow } from '@/components/ui/MenuRow';
import { LanguageSwitch } from './LanguageSwitch';
import { RoleSwitch } from './RoleSwitch';
import { interpolate } from './interpolate';
import { getRoleOptions, getSession } from '@/lib/session';
import { getCaregivers, getMessagingLink, getPendingInvitationsForSubject, getRefillRequests, getSettings } from '@/lib/data';
import { copy, t } from '@/i18n';
import { formatCount, type PluralCopy } from '@/i18n/format';
import { localizeFirstName } from '@/i18n/localize';
import type { Locale } from '@/i18n/locale';
import type { CopyEntry } from '@/i18n/copy/shell';
import type { IconName } from '@/components/ui/Icon';
import type { MessagingLink } from '@/types/contracts';

interface Row {
  label: CopyEntry;
  icon: IconName;
  path: string;
}

/** G8 order, patient shell, in the board's three groups (Daylight, CR-071): Refill · Calendar sync |
 * Caregivers · Notifications & messaging | Activity · Settings · Profile · Help. */
const ROWS = {
  refill: { label: copy.shell.moreRefill, icon: 'refresh', path: '/app/more/refill' },
  calendar: { label: copy.shell.moreCalendar, icon: 'calendar', path: '/app/more/calendar' },
  caregivers: { label: copy.shell.moreCaregivers, icon: 'users', path: '/app/more/caregivers' },
  notifications: { label: copy.shell.moreNotifications, icon: 'bell', path: '/app/more/notifications' },
  activity: { label: copy.shell.moreActivity, icon: 'clock', path: '/app/more/activity' },
  settings: { label: copy.shell.moreSettings, icon: 'settings', path: '/app/more/settings' },
  profile: { label: copy.shell.moreProfile, icon: 'person', path: '/app/more/profile' },
  help: { label: copy.shell.moreHelp, icon: 'info', path: '/app/more/help' },
} as const satisfies Record<string, Row>;

/** Caregiver shell: Activity · Profile & notifications · Help — no Settings row (F4, CLAUDE.md rule 8). */
const CAREGIVER_ROWS: Row[] = [
  { label: copy.shell.moreActivity, icon: 'clock', path: '/care/more/activity' },
  { label: copy.shell.moreProfileNotifications, icon: 'person', path: '/care/more/profile' },
  { label: copy.shell.moreHelp, icon: 'info', path: '/care/more/help' },
];

const REFILL_PENDING: PluralCopy = {
  one: copy.ambient.moreRefillPendingOne,
  two: copy.ambient.moreRefillPendingTwo,
  few: copy.ambient.moreRefillPendingFew,
  many: copy.ambient.moreRefillPendingMany,
  other: copy.ambient.moreRefillPendingOther,
};
const FOLLOWING: PluralCopy = {
  one: copy.ambient.moreFollowingOne,
  two: copy.ambient.moreFollowingTwo,
  few: copy.ambient.moreFollowingFew,
  many: copy.ambient.moreFollowingMany,
  other: copy.ambient.moreFollowingOther,
};
const INVITES_WAITING: PluralCopy = {
  one: copy.ambient.moreInvitesWaitingOne,
  two: copy.ambient.moreInvitesWaitingTwo,
  few: copy.ambient.moreInvitesWaitingFew,
  many: copy.ambient.moreInvitesWaitingMany,
  other: copy.ambient.moreInvitesWaitingOther,
};

/** The chat's state, neutral whichever it is (rule 2: not connected is a normal state, never a fault). */
function chatState(link: MessagingLink): CopyEntry {
  if (link.status === 'connected') return copy.ambient.moreChatConnected;
  if (link.status === 'pending') return copy.ambient.moreChatPending;
  return copy.ambient.moreChatNotConnected;
}

function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      {title ? <h2 className="jr-group-title">{title}</h2> : null}
      <div className="jr-group">{children}</div>
    </section>
  );
}

/**
 * The shared More screen for both shells (WP3, not a counted screen), Daylight (CR-071, the More
 * board): the fixed item set in G8 order, grouped into cards, each row carrying its state as the
 * board draws it ("1 request waiting for approval", "Telegram connected", "2 people following your
 * record", calendar on or off), read from the same data functions the rows open. For a patient only:
 * the quiet pending-invitation row (B1/More, F0's second entry point). The in-shell role switch when
 * the signed-in Civil ID holds a second active role. No write control lives here (G1): every row only
 * navigates. The caregiver shell reads no patient data here and shows no state lines (rule 8).
 */
export async function MoreMenu({ role, locale }: { role: 'patient' | 'caregiver'; locale: Locale }) {
  const [session, options] = await Promise.all([getSession(), getRoleOptions()]);
  const otherRole = options.find((o) => o.role !== role);
  const title = role === 'patient' ? copy.shell.tabMore : copy.shell.careTabMore;
  const href = (row: Row) => `/${locale}${row.path}`;

  let body: ReactNode;
  if (role === 'patient') {
    // The shell layout already requires a patient session; without one the rows still render, stateless.
    const patientId = session?.subjectId;
    const [pendingInvitations, refills, settings, caregivers, messaging] = patientId
      ? await Promise.all([
          getPendingInvitationsForSubject(),
          getRefillRequests(patientId),
          getSettings(patientId),
          getCaregivers(patientId),
          getMessagingLink({ subjectType: 'patient', subjectId: patientId }),
        ])
      : [[], [], null, [], null];
    const refillsWaiting = refills.filter((r) => r.status === 'requested').length;
    const following = caregivers.filter((c) => c.status === 'active').length;
    const invitesWaiting = caregivers.filter((c) => c.status === 'pending').length;
    const caregiverState = [
      following > 0 ? formatCount(following, locale, FOLLOWING) : null,
      invitesWaiting > 0 ? formatCount(invitesWaiting, locale, INVITES_WAITING) : null,
    ]
      .filter(Boolean)
      .join(' · ');

    body = (
      <>
        {pendingInvitations.length > 0 && (
          <Group>
            {pendingInvitations.map((invitation) => (
              <MenuRow
                key={invitation.id}
                icon="inbox"
                label={interpolate(t(copy.shell.pendingInvitationNoticeTemplate, locale), {
                  name: localizeFirstName(invitation.patientFirstName, locale),
                })}
                description={t(copy.shell.pendingInvitationNoticeValue, locale)}
                href={`/${locale}/invitation?id=${invitation.id}`}
              />
            ))}
          </Group>
        )}
        <Group title={t(copy.ambient.moreGroupMedicines, locale)}>
          <MenuRow
            label={t(ROWS.refill.label, locale)}
            icon={ROWS.refill.icon}
            href={href(ROWS.refill)}
            description={refillsWaiting > 0 ? formatCount(refillsWaiting, locale, REFILL_PENDING) : undefined}
          />
          <MenuRow
            label={t(ROWS.calendar.label, locale)}
            icon={ROWS.calendar.icon}
            href={href(ROWS.calendar)}
            description={settings ? t(settings.calendarSyncEnabled ? copy.ambient.moreCalendarOn : copy.ambient.moreCalendarOff, locale) : undefined}
          />
        </Group>
        <Group title={t(copy.ambient.moreGroupPeople, locale)}>
          <MenuRow
            label={t(ROWS.caregivers.label, locale)}
            icon={ROWS.caregivers.icon}
            href={href(ROWS.caregivers)}
            description={caregiverState || undefined}
          />
          <MenuRow
            label={t(ROWS.notifications.label, locale)}
            icon={ROWS.notifications.icon}
            href={href(ROWS.notifications)}
            description={messaging ? t(chatState(messaging), locale) : undefined}
          />
        </Group>
        <Group title={t(copy.ambient.moreGroupAccount, locale)}>
          {[ROWS.activity, ROWS.settings, ROWS.profile, ROWS.help].map((row) => (
            <MenuRow key={row.path} label={t(row.label, locale)} icon={row.icon} href={href(row)} />
          ))}
        </Group>
      </>
    );
  } else {
    body = (
      <Group>
        {CAREGIVER_ROWS.map((row) => (
          <MenuRow key={row.path} label={t(row.label, locale)} icon={row.icon} href={href(row)} />
        ))}
      </Group>
    );
  }

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(title, locale)}
        action={<LanguageSwitch locale={locale} role={role} subjectId={role === 'patient' ? session?.subjectId : undefined} />}
      />
      <div className="flex flex-col gap-5 px-3 pb-5 pt-2 tablet:px-5" data-testid="more-menu">
        {body}
        {otherRole && (
          <Group>
            <RoleSwitch option={otherRole} locale={locale} />
          </Group>
        )}
      </div>
    </div>
  );
}

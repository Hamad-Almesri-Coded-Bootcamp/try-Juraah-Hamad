import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getDosesForDay, getPendingInvitationsForSubject, getPrescriptions, getSettings } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { IconButton } from '@/components/ui/IconButton';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { LastKnown } from '@/features/shell/LastKnown';
import { interpolate } from '@/features/shell/interpolate';
import { DoseDayList } from '@/features/day/DoseDayList';
import { DayErrorState } from '@/features/day/DayErrorState';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { formatDayLabel, formatNumber } from '@/i18n/format';
import { kuwaitNow } from '@/lib/config';
import { addDays, kuwaitToday } from '@/lib/schedule/dates';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * B1 — Dose Schedule "Today", the patient shell's home (`/[locale]/app`, `?day=YYYY-MM-DD`; absent
 * means `REFERENCE_DATE` — G3/rule 9, never `Date.now()`). Read-only per G1, most of all in the
 * tracking-off state: the list itself (`DoseDayList`'s `data-testid="dose-list"` root) never carries
 * a control that could create or change a `Dose.status`.
 *
 * `?view=loading` / `?view=error` / `?view=offline` are a dev-only, self-contained way to demonstrate
 * B1's G7 states in `tests/e2e/day.spec.ts` without a fetch, a mock import, or `Date.now()`: read
 * here, from this page's own `searchParams` prop (D-008 — never `useSearchParams`), and nowhere
 * else. `lib/data/mock/faults.ts` was deliberately not used for this — guard 3 (the seam) refuses
 * any import of `lib/data/mock/**` outside `lib/data/`, so a screen reading it directly would fail
 * its own guard; see `docs/backend-notes/wp4c.md` §7. These flags are not a documented product
 * feature and carry no seed data of their own.
 */
export default async function TodayPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ day?: string; view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { day, view: rawView } = await searchParams;
  // Gated like the dev gallery: the G7 demo flag never acts in a production build (lead, wave-1 gate).
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  const baseHref = `/${locale}/app`;
  const title = t(screenTitles.B1, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="list" rows={4} label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <DayErrorState locale={locale} backHref={baseHref} />
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this
  const patientId = session.subjectId;
  const action = <LanguageSwitch locale={locale} role="patient" subjectId={patientId} />;

  const today = kuwaitToday();
  const isoDate = day && ISO_DATE.test(day) ? day : today;
  const prevHref = `${baseHref}?day=${addDays(isoDate, -1)}`;
  const nextHref = `${baseHref}?day=${addDays(isoDate, 1)}`;
  const isToday = isoDate === today;

  const [doses, settings, prescriptions, pendingInvitations] = await Promise.all([
    getDosesForDay(patientId, isoDate),
    getSettings(patientId),
    getPrescriptions(patientId),
    getPendingInvitationsForSubject(),
  ]);

  const hasActivePrescriptions = prescriptions.some((p) => p.status === 'active');
  const pendingInvitation = pendingInvitations[0];
  const caption = interpolate(t(isToday ? copy.day.doseCountTodayTemplate : copy.day.doseCountTemplate, locale), {
    count: formatNumber(doses.length, locale),
  });

  const content = (
    <div className="flex flex-col gap-4 p-3 tablet:p-5">
      <div className="flex items-center gap-2">
        <IconButton label={t(copy.day.previousDay, locale)} icon="chevron" mirrorIcon href={prevHref} />
        <div className="flex flex-1 flex-col">
          <span className="type-body-strong">{formatDayLabel(isoDate, locale)}</span>
          <span className="type-caption">{caption}</span>
        </div>
        <IconButton label={t(copy.day.nextDay, locale)} icon="chevron" href={nextHref} />
      </div>

      {!isToday && (
        <NavigateButton href={baseHref} variant="quiet" lang={locale}>
          {t(copy.day.returnToToday, locale)}
        </NavigateButton>
      )}

      {pendingInvitation && (
        <InlineNotice>
          <span className="flex flex-col items-start gap-2">
            <span>{interpolate(t(copy.shell.pendingInvitationNoticeTemplate, locale), { name: pendingInvitation.patientFirstName })}</span>
            <NavigateButton href={`/${locale}/invitation?id=${pendingInvitation.id}`} variant="quiet" lang={locale}>
              {t(copy.shell.pendingInvitationNoticeValue, locale)}
            </NavigateButton>
          </span>
        </InlineNotice>
      )}

      <DoseDayList
        doses={doses}
        tracked={settings.adherenceCheckInEnabled}
        locale={locale}
        hrefBuilder={(dose) => `/${locale}/app/medicines/${dose.prescriptionId}`}
        settingsHref={`/${locale}/app/more/settings`}
        emptyTitle={!hasActivePrescriptions ? t(copy.day.emptyNoPrescriptionsTitle, locale) : undefined}
        emptyDescription={!hasActivePrescriptions ? t(copy.day.emptyNoPrescriptionsDescription, locale) : undefined}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} action={action} />
      {view === 'offline' ? <LastKnown asOf={kuwaitNow()} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

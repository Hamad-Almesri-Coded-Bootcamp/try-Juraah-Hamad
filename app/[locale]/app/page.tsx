import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getAlerts, getDosesForDay, getPatient, getPendingInvitationsForSubject, getPrescriptions, getSettings } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { InlineNotice } from '@/components/ui/InlineNotice';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { NavigateButton } from '@/features/shell/NavigateButton';
import { LastKnown } from '@/features/shell/LastKnown';
import { interpolate } from '@/features/shell/interpolate';
import { DayErrorState } from '@/features/day/DayErrorState';
import { greetingFor } from '@/features/day/today';
import { TodayView, standingDangerAlerts } from '@/features/day/TodayView';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';

import { localizeFirstName } from '@/i18n/localize';
import { kuwaitNow } from '@/lib/config';
import { kuwaitToday } from '@/lib/schedule/dates';

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
  const nowIso = kuwaitNow();

  const [doses, settings, prescriptions, pendingInvitations, alerts, patient] = await Promise.all([
    getDosesForDay(patientId, isoDate),
    getSettings(patientId),
    getPrescriptions(patientId),
    getPendingInvitationsForSubject(),
    getAlerts(patientId),
    getPatient(patientId),
  ]);

  const hasActivePrescriptions = prescriptions.some((p) => p.status === 'active');
  const pendingInvitation = pendingInvitations[0];
  const drugNameById = new Map(prescriptions.map((p) => [p.id, p.drug.genericName] as const));

  return (
    <TodayView
      locale={locale}
      title={title}
      eyebrow={greetingFor(nowIso, patient ? localizeFirstName(patient.name, locale) : undefined, locale)}
      actions={action}
      isoDate={isoDate}
      today={today}
      nowIso={nowIso}
      dayHref={(iso) => (iso === today ? baseHref : `${baseHref}?day=${iso}`)}
      homeHref={baseHref}
      doses={doses}
      tracked={settings.adherenceCheckInEnabled}
      hrefBuilder={(dose) => `/${locale}/app/medicines/${dose.prescriptionId}`}
      settingsHref={`/${locale}/app/more/settings`}
      // CR-069(g): a danger finding that still stands is pointed to from the day it concerns. One row,
      // linking to C2; it is not a pill and not a dose status.
      alerts={standingDangerAlerts(alerts).map((a) => ({
        id: a.id,
        severity: a.severity,
        reviewStatus: a.reviewStatus,
        drugs: a.involvedPrescriptionIds.map((id) => drugNameById.get(id) ?? '').filter(Boolean),
        href: `/${locale}/app/safety/${a.id}`,
      }))}
      notices={
        pendingInvitation ? (
          <InlineNotice>
            <span className="flex flex-col items-start gap-2">
              <span>
                {interpolate(t(copy.shell.pendingInvitationNoticeTemplate, locale), {
                  name: localizeFirstName(pendingInvitation.patientFirstName, locale),
                })}
              </span>
              <NavigateButton href={`/${locale}/invitation?id=${pendingInvitation.id}`} variant="secondary" lang={locale}>
                {t(copy.shell.pendingInvitationNoticeValue, locale)}
              </NavigateButton>
            </span>
          </InlineNotice>
        ) : undefined
      }
      emptyTitle={!hasActivePrescriptions ? t(copy.day.emptyNoPrescriptionsTitle, locale) : undefined}
      emptyDescription={!hasActivePrescriptions ? t(copy.day.emptyNoPrescriptionsDescription, locale) : undefined}
      // Audit M12: a patient with no prescription at all is offered the one action that fills this
      // screen, B4 (SCREENS.md: "push from B2 / B1 empty state"), in B2's own empty-state words.
      // A day that merely has no dose gets none: the week strip above is the way on.
      emptyAction={
        !hasActivePrescriptions ? (
          <NavigateButton href={`/${locale}/app/medicines/add`} variant="secondary" icon="camera" lang={locale}>
            {t(copy.day.addPrescriptionAction, locale)}
          </NavigateButton>
        ) : undefined
      }
      wrapSheet={
        view === 'offline'
          ? (sheet) => (
              <LastKnown asOf={nowIso} locale={locale}>
                {sheet}
              </LastKnown>
            )
          : undefined
      }
    />
  );
}

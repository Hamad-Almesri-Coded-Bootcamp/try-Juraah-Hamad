import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getActivity, getAlerts, getDosesForDay, getPrescriptions, getSettings } from '@/lib/data';
import { newPrescriptionsAwaitScreening } from '@/lib/agent-webhooks/state';
import { prescriptionsBeingChecked } from '@/features/prescription/screening-state';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { MedicinesList, type NextDoseInfo } from '@/features/day/MedicinesList';
import { DayErrorState } from '@/features/day/DayErrorState';
import { pickNextOrMostRecent, formatTodayDoseTimeLabel } from '@/features/day/format';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { kuwaitNow } from '@/lib/config';
import { kuwaitToday } from '@/lib/schedule/dates';

/**
 * B2 — My Medicines (`/[locale]/app/medicines`): active prescriptions as cards, the danger-severity
 * `InteractionAlert` always the most prominent element, and a de-emphasised past group with no
 * refill action. The "next or most-recent dose" is always resolved against today
 * (`REFERENCE_DATE`) — this screen has no day navigation of its own (that is B1's).
 *
 * `?view=loading` / `?view=error` / `?view=offline` — see `app/[locale]/app/page.tsx`'s doc comment
 * for why these dev-only flags exist and why `lib/data/mock/faults.ts` is not imported here either.
 */
export default async function MedicinesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { view: rawView } = await searchParams;
  // Gated like the dev gallery: the G7 demo flag never acts in a production build (lead, wave-1 gate).
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  const baseHref = `/${locale}/app/medicines`;
  const title = t(screenTitles.B2, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="alert" label={t(copy.vocabulary.loading, locale)} />
          <LoadingState variant="list" rows={3} label={t(copy.vocabulary.loading, locale)} />
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

  // CR-089: a new prescription reads "being checked" until its interaction screening answers. The
  // audit rows it is derived from are read only where screening runs at all (not in production today).
  const screeningLive = newPrescriptionsAwaitScreening();
  const [prescriptions, alerts, settings, todaysDoses, activity] = await Promise.all([
    getPrescriptions(patientId),
    getAlerts(patientId),
    getSettings(patientId),
    getDosesForDay(patientId, kuwaitToday()),
    screeningLive ? getActivity(patientId) : [],
  ]);
  const beingCheckedIds = prescriptionsBeingChecked({ prescriptions, alerts, activity, nowIso: kuwaitNow(), screeningLive });

  const nextDoseByPrescriptionId: Record<string, NextDoseInfo | undefined> = {};
  for (const rx of prescriptions) {
    if (rx.status !== 'active') continue;
    const dosesForRx = todaysDoses.filter((d) => d.prescriptionId === rx.id);
    const chosen = pickNextOrMostRecent(dosesForRx, kuwaitNow());
    if (chosen) nextDoseByPrescriptionId[rx.id] = { status: chosen.status, timeLabel: formatTodayDoseTimeLabel(chosen.scheduledAt, locale) };
  }

  const content = (
    <div className="p-3 tablet:p-5">
      <MedicinesList
        prescriptions={prescriptions}
        alerts={alerts}
        nextDoseByPrescriptionId={nextDoseByPrescriptionId}
        tracked={settings.adherenceCheckInEnabled}
        locale={locale}
        hrefBuilder={(rx) => `/${locale}/app/medicines/${rx.id}`}
        alertHrefBuilder={(alert) => `/${locale}/app/safety/${alert.id}`}
        addHref={`/${locale}/app/medicines/add`}
        safetyHref={`/${locale}/app/safety`}
        beingCheckedIds={beingCheckedIds}
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

import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getAlerts, getPrescription, getPrescriptions } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { SafetyList } from '@/features/safety/SafetyList';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { kuwaitNow } from '@/lib/config';

/**
 * C1 — Safety alerts list (`/[locale]/app/safety`, the Safety tab): the navy summary of what was
 * checked, the findings that need attention (most severe and most recent first), the photo check,
 * then `reviewed`/`auto_cleared` history; none → a reassuring `EmptyState`. Read-only per G1 — this
 * route calls only `getAlerts`/`getPrescriptions`/`getPrescription`.
 *
 * `?view=loading` / `?view=error` / `?view=offline` — dev-only G7-state flags, gated so they never
 * act in a production build, matching `app/[locale]/app/page.tsx`'s own pattern exactly (the
 * wave-1 gate's standing instruction for any bundle that reuses it).
 */
export default async function SafetyPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  const baseHref = `/${locale}/app/safety`;
  const title = t(screenTitles.C1, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
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

  const [alerts, allPrescriptions] = await Promise.all([getAlerts(patientId), getPrescriptions(patientId)]);
  // The navy card's facts (Daylight, CR-071): every active prescription is screened together, whatever
  // its sector, so the count is the active list's own length.
  const active = allPrescriptions.filter((rx) => rx.status === 'active');
  const summary = {
    checkedCount: active.length,
    mixedSectors: new Set(active.map((rx) => rx.source.sector)).size > 1,
  };
  const prescriptionIds = Array.from(new Set(alerts.flatMap((a) => a.involvedPrescriptionIds)));
  const prescriptions = await Promise.all(prescriptionIds.map((id) => getPrescription(id)));
  const nameById = new Map(prescriptions.filter((rx) => rx != null).map((rx) => [rx.id, rx.drug.genericName]));

  const drugNamesByAlertId: Record<string, string[] | undefined> = {};
  for (const alert of alerts) {
    drugNamesByAlertId[alert.id] = alert.involvedPrescriptionIds
      .map((id) => nameById.get(id))
      .filter((name): name is string => name != null);
  }

  const content = (
    <div className="px-3 pb-5 pt-2 tablet:px-5">
      <SafetyList
        alerts={alerts}
        drugNamesByAlertId={drugNamesByAlertId}
        locale={locale}
        hrefBuilder={(alert) => `${baseHref}/${alert.id}`}
        checkHref={`/${locale}/app/safety/check`}
        summary={summary}
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

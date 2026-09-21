import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getAlerts, getPrescription } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { SafetyList } from '@/features/safety/SafetyList';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { REFERENCE_NOW } from '@/lib/config';

/**
 * C1 — Safety alerts list (`/[locale]/app/safety`, the Safety tab): every `InteractionAlert` the
 * patient has, most severe and most recent first, `reviewed`/`auto_cleared` history included, none →
 * a reassuring `EmptyState`. Read-only per G1 — this route calls only `getAlerts`/`getPrescription`.
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
        <div className="flex flex-col gap-4 p-3">
          <LoadingState variant="list" rows={3} label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3">
          <DayErrorState locale={locale} backHref={baseHref} />
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this
  const patientId = session.subjectId;
  const action = <LanguageSwitch locale={locale} role="patient" subjectId={patientId} />;

  const alerts = await getAlerts(patientId);
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
    <div className="p-3">
      <SafetyList
        alerts={alerts}
        drugNamesByAlertId={drugNamesByAlertId}
        locale={locale}
        hrefBuilder={(alert) => `${baseHref}/${alert.id}`}
        checkHref={`/${locale}/app/safety/check`}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} action={action} />
      {view === 'offline' ? <LastKnown asOf={REFERENCE_NOW} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

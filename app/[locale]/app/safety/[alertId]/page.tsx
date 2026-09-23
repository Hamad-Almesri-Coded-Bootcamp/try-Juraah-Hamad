import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getAlert, getPrescription } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { AlertDetail } from '@/features/safety/AlertDetail';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { kuwaitNow } from '@/lib/config';

/**
 * C2 — interaction alert detail (`/[locale]/app/safety/[alertId]`), pushed from C1 / B2 / C3. Read
 * only per G1: this route calls `getAlert` and `getPrescription`, both reads — opening it never
 * changes `InteractionAlert.reviewStatus` or anything else. `getAlert` already enforces that only the
 * alert's own patient (or their active caregiver, via F3's own route) may read it (`canReadPatient`),
 * so a `notFound()` here for anyone else is the same defensive re-check every B/C-group page makes.
 *
 * `?view=loading` / `?view=error` / `?view=offline` — the same dev-only, production-gated G7-state
 * flags as C1 and every sibling B/C page.
 */
export default async function AlertDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; alertId: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { locale, alertId } = await params;
  if (!isLocale(locale)) notFound();
  const { view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  const backHref = `/${locale}/app/safety`;
  const title = t(screenTitles.C2, locale);
  const backLabel = t(copy.safety.c1BackLabel, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={backHref} backLabel={backLabel} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="detail" label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={backHref} backLabel={backLabel} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <DayErrorState locale={locale} backHref={`${backHref}/${alertId}`} />
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this

  const alert = await getAlert(alertId);
  if (!alert) notFound();

  const prescriptions = (await Promise.all(alert.involvedPrescriptionIds.map((id) => getPrescription(id)))).filter(
    (rx): rx is NonNullable<typeof rx> => rx != null,
  );

  const content = (
    <div className="p-3 tablet:p-5">
      <AlertDetail
        alert={alert}
        prescriptions={prescriptions}
        locale={locale}
        prescriptionHrefBuilder={(rx) => `/${locale}/app/medicines/${rx.id}`}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} backHref={backHref} backLabel={backLabel} />
      {view === 'offline' ? <LastKnown asOf={kuwaitNow()} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

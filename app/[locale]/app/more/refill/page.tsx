import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getPrescriptions, getRefillOverview, getRefillRequests } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { RefillList } from '@/features/supply/RefillList';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { kuwaitNow } from '@/lib/config';

/**
 * D1 — refill request (`/[locale]/app/more/refill`, a More sub-page — back to `/app/more`, per
 * every sibling More screen's own AppBar; also pushed from B3 with `?rx=`, read here from this
 * page's own `searchParams` prop, never `useSearchParams` — D-008).
 *
 * `?view=loading` / `?view=error` / `?view=offline` — the same dev-only, production-gated G7-state
 * flags `app/[locale]/app/page.tsx` and every sibling B/C page already use.
 */
export default async function RefillPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ rx?: string; view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { rx, view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;

  const backHref = `/${locale}/app/more`;
  const title = t(screenTitles.D1, locale);
  const backLabel = t(copy.vocabulary.back, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={backHref} backLabel={backLabel} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="list" rows={2} label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={backHref} backLabel={backLabel} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <DayErrorState locale={locale} backHref={`${backHref}/refill`} />
        </div>
      </div>
    );
  }

  const session = await getSession();
  if (!session || session.role !== 'patient') notFound(); // defensive — the shell layout already gates this
  const patientId = session.subjectId;
  const action = <LanguageSwitch locale={locale} role="patient" subjectId={patientId} />;

  // The patient's own prescriptions, for each card's facility (RefillLine carries only the routing)
  // and for naming a request whose prescription is no longer active. No contract change.
  const [overview, requests, prescriptions] = await Promise.all([
    getRefillOverview(patientId),
    getRefillRequests(patientId),
    getPrescriptions(patientId),
  ]);

  const content = (
    <div className="p-3 tablet:p-5">
      <RefillList
        overview={overview}
        requests={requests}
        prescriptions={prescriptions}
        patientId={patientId}
        locale={locale}
        highlightPrescriptionId={rx}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} backHref={backHref} backLabel={backLabel} action={action} />
      {view === 'offline' ? <LastKnown asOf={kuwaitNow()} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

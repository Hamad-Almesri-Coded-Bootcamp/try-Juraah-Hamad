import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getAuditLog } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { AuditLogView } from '@/features/clinic/AuditLogView';
import { ClinicErrorState } from '@/features/clinic/ClinicErrorState';
import { auditPeriodFrom, type AuditPeriod } from '@/features/clinic/format';
import { copy, t } from '@/i18n';

const PERIODS = new Set<AuditPeriod>(['all', 'last7', 'last30']);

/**
 * X1 — the system audit log (`/[locale]/clinic/audit`). Filter state is the URL's own
 * `searchParams`, read here (a Server Component prop, never `useSearchParams` — D-008) and passed to
 * `getAuditLog`, whose result this page renders through `AuditLogView`.
 *
 * `?view=loading` / `?view=error` — same dev-only, production-gated G7-state flag as G1s/G3s/X0's own
 * pages; checked before `view` is otherwise read as a filter value, so the two never collide.
 */
export default async function AuditLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ actor?: string; type?: string; period?: string; view?: string }>;
}) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const { actor, type, period: rawPeriod, view: rawView } = await searchParams;
  const view = process.env.NODE_ENV === 'production' ? undefined : rawView;
  const title = t(copy.clinic.x1Title, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} />
        <div className="flex flex-col gap-4 p-3">
          <LoadingState variant="list" rows={4} label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} />
        <div className="flex flex-col gap-4 p-3">
          <ClinicErrorState locale={locale} backHref={`/${locale}/clinic/audit`} />
        </div>
      </div>
    );
  }

  const period: AuditPeriod = rawPeriod && PERIODS.has(rawPeriod as AuditPeriod) ? (rawPeriod as AuditPeriod) : 'all';
  const events = await getAuditLog({ actorRole: actor, type, from: auditPeriodFrom(period) });

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} />
      <AuditLogView events={events} locale={locale} filters={{ actor, type, period }} basePath={`/${locale}/clinic/audit`} />
    </div>
  );
}

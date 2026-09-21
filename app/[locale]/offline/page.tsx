import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { copy, t } from '@/i18n';
import { getSession } from '@/lib/session';
import { readLastKnownSnapshot } from '@/lib/data';
import { LastKnown } from '@/features/shell/LastKnown';
import { RefreshButton } from '@/features/shell/RefreshButton';
import { EmptyState } from '@/components/ui/EmptyState';
import { DetailRow } from '@/components/ui/DetailRow';

function isNamedRecord(value: unknown): value is { name?: unknown } {
  return typeof value === 'object' && value !== null;
}

/**
 * H3 — offline / failed refresh. Shows the last successfully read snapshot for the signed-in
 * patient (the mock data layer keeps the last successful read per function — `readLastKnownSnapshot`)
 * with its "as of" line, or the calm "nothing saved yet" state when there is none; never a blank
 * screen (UX Principles §6). The same `LastKnown` wrapper is exported for any list screen's own
 * failed-refresh state.
 */
export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  const session = await getSession();
  const snapshot = session?.role === 'patient' ? await readLastKnownSnapshot(`getPatient:${session.subjectId}`) : null;

  if (!snapshot) {
    return (
      <main id="main-content" className="mx-auto flex min-h-dvh max-w-content flex-col justify-center gap-3 p-3">
        <EmptyState icon="refresh" title={t(copy.shell.lastKnownEmptyTitle, locale)} description={t(copy.shell.lastKnownEmptyBody, locale)} />
        <RefreshButton locale={locale} label={t(copy.shell.refresh, locale)} />
      </main>
    );
  }

  const name = isNamedRecord(snapshot.data) && typeof snapshot.data.name === 'string' ? snapshot.data.name : undefined;

  return (
    <main id="main-content" className="mx-auto flex min-h-dvh max-w-content flex-col justify-center p-3">
      <LastKnown asOf={snapshot.asOf} locale={locale}>
        <DetailRow label={t(copy.shell.moreProfile, locale)} value={name} />
      </LastKnown>
    </main>
  );
}

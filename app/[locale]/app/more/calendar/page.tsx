import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getCalendarSubscription } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { CalendarSync } from '@/features/ambient/CalendarSync';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { kuwaitNow } from '@/lib/config';

/**
 * E1 — calendar sync (`/[locale]/app/more/calendar`, also reachable in one tap from B1's notice).
 * Read-only besides the one subscribe action, which never touches `Dose.status` (G1) — it only ever
 * creates a `CalendarSubscription` row and flips `Settings.calendarSyncEnabled`.
 *
 * `?view=loading` / `?view=error` / `?view=offline` — the dev-only G7-state flags, gated exactly as
 * `app/[locale]/app/page.tsx`'s own pattern (every WP4 bundle that reuses it follows the same gate).
 */
export default async function CalendarPage({
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

  const baseHref = `/${locale}/app/more/calendar`;
  const title = t(screenTitles.E1, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="detail" label={t(copy.vocabulary.loading, locale)} />
        </div>
      </div>
    );
  }
  if (view === 'error') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
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

  const subscription = await getCalendarSubscription(patientId);

  const content = (
    <div className="p-3 tablet:p-5">
      <CalendarSync patientId={patientId} subscription={subscription} locale={locale} />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={action} />
      {view === 'offline' ? <LastKnown asOf={kuwaitNow()} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

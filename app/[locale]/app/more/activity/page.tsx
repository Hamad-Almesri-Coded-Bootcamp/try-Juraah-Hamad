import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getActivity } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { ActivityFeed } from '@/features/ambient/ActivityFeed';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { REFERENCE_NOW } from '@/lib/config';

/**
 * E2 — activity feed (`/[locale]/app/more/activity`). Read-only per G1 — this route calls only
 * `getActivity`, and `ActivityRow`'s only affordance is a link to the thing an event happened to.
 *
 * `?view=loading` / `?view=error` / `?view=offline` — the dev-only G7-state flags, gated exactly as
 * `app/[locale]/app/page.tsx`'s own pattern.
 */
export default async function ActivityPage({
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

  const baseHref = `/${locale}/app/more/activity`;
  const title = t(screenTitles.E2, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="list" rows={5} label={t(copy.vocabulary.loading, locale)} />
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

  const events = await getActivity(patientId);

  const content = (
    <div className="p-3 tablet:p-5">
      <ActivityFeed events={events} locale={locale} />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={action} />
      {view === 'offline' ? <LastKnown asOf={REFERENCE_NOW} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getPatient, getSettings, getMessagingLink } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { SettingsScreen } from '@/features/ambient/SettingsScreen';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { kuwaitNow } from '@/lib/config';

/**
 * E3 — settings (`/[locale]/app/more/settings`). CR-011: **exactly** the permitted controls — no
 * channel `Select`, no language control (G2 keeps it in the app bar).
 *
 * `?view=loading` / `?view=error` / `?view=offline` — the dev-only G7-state flags, gated exactly as
 * `app/[locale]/app/page.tsx`'s own pattern.
 */
export default async function SettingsPage({
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

  const baseHref = `/${locale}/app/more/settings`;
  const title = t(screenTitles.E3, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="lines" rows={6} label={t(copy.vocabulary.loading, locale)} />
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

  const [patient, settings, messaging] = await Promise.all([
    getPatient(patientId),
    getSettings(patientId),
    getMessagingLink({ subjectType: 'patient', subjectId: patientId }),
  ]);

  const content = (
    <div className="px-3 pb-5 pt-2 tablet:px-5">
      <SettingsScreen
        patientId={patientId}
        settings={settings}
        chatConnected={messaging.status === 'connected'}
        phone={patient?.phone ?? null}
        locale={locale}
        notificationsHref={`/${locale}/app/more/notifications`}
      />
    </div>
  );

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={action} />
      {view === 'offline' ? <LastKnown asOf={kuwaitNow()} locale={locale}>{content}</LastKnown> : content}
    </div>
  );
}

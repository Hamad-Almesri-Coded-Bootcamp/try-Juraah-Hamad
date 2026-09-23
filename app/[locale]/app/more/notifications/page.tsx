import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { getSession } from '@/lib/session';
import { getMessagingLink, getPushCapability, getPushState } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { LoadingState } from '@/components/ui/LoadingState';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { LastKnown } from '@/features/shell/LastKnown';
import { DayErrorState } from '@/features/day/DayErrorState';
import { NotificationsScreen } from '@/features/ambient/NotificationsScreen';
import { copy, t } from '@/i18n';
import { screenTitles } from '@/i18n/copy/shell';
import { BOT_HANDLE, kuwaitNow } from '@/lib/config';

/**
 * E5 — notifications & messaging (`/[locale]/app/more/notifications`).
 *
 * `?view=loading` / `?view=error` / `?view=offline` — the dev-only G7-state flags, gated exactly as
 * `app/[locale]/app/page.tsx`'s own pattern.
 *
 * `?view=ios` — one further dev-only flag, same gate, added because no seed **patient** carries
 * `PushSubscription.permission: 'unsupported'` (only عبدالله's caregiver row does — `getPushCapability`
 * is also hardcoded `{ supported: true, iosNeedsInstall: false }` in the mock for every subject,
 * `lib/data/index.ts`'s own comment: "Real detection is client-side... WP4"). Nothing in the
 * published API can produce the iOS-not-installed combination for a signed-in patient, so it is
 * demonstrated the same way the G7 flags already are — a page-level render override, never a lib/**
 * change, inert in production. Recorded in `docs/backend-notes/wp4g.md` §7.
 */
export default async function NotificationsPage({
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

  const baseHref = `/${locale}/app/more/notifications`;
  const title = t(screenTitles.E5, locale);

  if (view === 'loading') {
    return (
      <div className="relative flex min-h-full flex-col">
        <AppBar title={title} backHref={`/${locale}/app/more`} backLabel={t(copy.vocabulary.back, locale)} action={<LanguageSwitch locale={locale} />} />
        <div className="flex flex-col gap-4 p-3 tablet:p-5">
          <LoadingState variant="lines" rows={8} label={t(copy.vocabulary.loading, locale)} />
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
  const subject = { subjectType: 'patient' as const, subjectId: patientId };

  const [capability, push, messaging] = await Promise.all([
    getPushCapability(),
    getPushState(subject),
    getMessagingLink(subject),
  ]);

  const iosFixture = view === 'ios';
  const permission = iosFixture ? 'unsupported' : (push?.permission ?? (capability.supported ? 'default' : 'unsupported'));
  const iosNeedsInstall = iosFixture ? true : capability.iosNeedsInstall;
  const active = !iosFixture && push?.status === 'active';

  const content = (
    <div className="p-3 tablet:p-5">
      <NotificationsScreen
        patientId={patientId}
        permission={permission}
        active={active}
        iosNeedsInstall={iosNeedsInstall}
        messaging={messaging}
        botHandle={BOT_HANDLE}
        locale={locale}
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

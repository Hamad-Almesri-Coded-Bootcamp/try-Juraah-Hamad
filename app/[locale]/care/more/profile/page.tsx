import { notFound } from 'next/navigation';
import { isLocale } from '@/i18n/locale';
import { AppBar } from '@/components/ui/AppBar';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { requireRole } from '@/features/shell/gate';
import { CaregiverProfile } from '@/features/caregiving/CaregiverProfile';
import { getCaregiverLink, getMessagingLink, getPushCapability, getPushState } from '@/lib/data';
import { copy, t } from '@/i18n';

/** F4 — caregiver profile & notifications (docs/wireframes/CaregiverProfile.dc.html). */
export default async function CaregiverProfilePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await requireRole(locale, ['caregiver']);

  const subject = { subjectType: 'caregiver' as const, subjectId: session.subjectId };
  const [link, capability, push, messaging] = await Promise.all([
    getCaregiverLink(session.subjectId),
    getPushCapability(),
    getPushState(subject),
    getMessagingLink(subject),
  ]);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(copy.shell.moreProfileNotifications, locale)}
        backHref={`/${locale}/care/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role={session.role} subjectId={session.subjectId} />}
      />
      <CaregiverProfile
        caregiverId={session.subjectId}
        patientFirstName={link.patientFirstName}
        acceptedAt={link.acceptedAt}
        pushCapabilitySupported={capability.supported}
        push={push}
        messaging={messaging}
        locale={locale}
      />
    </div>
  );
}

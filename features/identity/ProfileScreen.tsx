import { getSession } from '@/lib/session';
import { getPatient, getSettings, getPushState, getMessagingLink, getCaregivers } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { DetailRow } from '@/components/ui/DetailRow';
import { MenuRow } from '@/components/ui/MenuRow';
import { Monogram } from '@/components/ui/Monogram';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { SignOutButton } from '@/features/shell/SignOutButton';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { localizePersonName } from '@/i18n/localize';
import { screenTitles } from '@/i18n/copy/shell';
import { PhoneEditor } from './PhoneEditor';
import type { Locale } from '@/i18n/locale';
import type { MessagingLink, PushSubscription } from '@/types/views';

function pushLabel(push: PushSubscription | null): keyof typeof copy.identity {
  if (push?.permission === 'denied') return 'pushBlocked';
  if (push?.permission === 'granted' && push.status === 'active') return 'pushOn';
  return 'pushOff';
}

function chatLabel(link: MessagingLink): keyof typeof copy.identity {
  return link.status === 'connected' ? 'chatConnected' : 'chatNotConnected';
}

/**
 * A3 — profile / account (patient), Daylight (CR-071): grouped cards, the name (in the reader's
 * language, CR-071) beside its monogram. Name and identity line (CR-001/CR-026: no Civil ID, masked or
 * whole — "signed in via Hawiati (simulated)" instead) · notification status, both neutral, each
 * linking to E5 · optional contact phone · language, display-only (G2: the switch lives in the app
 * bar) · linked-caregiver count, linking to F1 · sign out, which exists nowhere else in this shell.
 */
export async function ProfileScreen({ locale }: { locale: Locale }) {
  const session = await getSession();
  if (!session || session.role !== 'patient') return null; // the shell layout already enforces this
  const patientId = session.subjectId;

  const [patient, settings, push, chat, caregivers] = await Promise.all([
    getPatient(patientId),
    getSettings(patientId),
    getPushState({ subjectType: 'patient', subjectId: patientId }),
    getMessagingLink({ subjectType: 'patient', subjectId: patientId }),
    getCaregivers(patientId),
  ]);
  if (!patient) return null;

  const activeCaregivers = caregivers.filter((c) => c.status === 'active').length;
  const languageLabel = t(settings.language === 'en' ? copy.identity.languageEn : copy.identity.languageAr, locale);
  // The patient's own name, in the reader's language (CR-071); the monogram takes its first letters.
  const name = localizePersonName(patient.name, locale);

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.A3, locale)}
        backHref={`/${locale}/app/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role="patient" subjectId={patientId} />}
      />
      <div className="flex w-full flex-col gap-5 px-3 pb-5 pt-2 tablet:px-5">
        <section className="jr-group flex items-center gap-4 p-4" data-testid="profile-identity">
          <Monogram name={name} size="lg" />
          <span className="flex min-w-0 flex-col">
            <span className="jr-display type-h2 text-navy">{name}</span>
            <span className="type-body-small text-ink-muted">{t(copy.identity.profileRoleLabel, locale)}</span>
          </span>
        </section>

        <div className="jr-group flex flex-col px-4 py-2">
          <DetailRow label={t(copy.identity.identityLineLabel, locale)} value={t(copy.identity.identityLineValue, locale)} lang={locale} />
          <DetailRow label={t(copy.identity.languageLabel, locale)} value={languageLabel} lang={locale} />
        </div>

        <div className="jr-group px-4 py-4">
          <PhoneEditor patientId={patientId} initialPhone={patient.phone ?? null} locale={locale} />
        </div>

        <div className="jr-group">
          <MenuRow
            icon="bell"
            label={t(copy.identity.browserNotifLabel, locale)}
            value={t(copy.identity[pushLabel(push)], locale)}
            href={`/${locale}/app/more/notifications`}
          />
          <MenuRow
            icon="link"
            label={t(copy.identity.chatLabel, locale)}
            value={t(copy.identity[chatLabel(chat)], locale)}
            href={`/${locale}/app/more/notifications`}
          />
          <MenuRow
            icon="users"
            label={t(copy.identity.caregiverCountLabel, locale)}
            value={interpolate(t(copy.identity.caregiverCountTemplate, locale), { count: formatNumber(activeCaregivers, locale) })}
            href={`/${locale}/app/more/caregivers`}
          />
        </div>

        <SignOutButton locale={locale} variant="secondary" fullWidth />
      </div>
    </div>
  );
}

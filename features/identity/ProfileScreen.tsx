import { getSession } from '@/lib/session';
import { getPatient, getSettings, getPushState, getMessagingLink, getCaregivers } from '@/lib/data';
import { AppBar } from '@/components/ui/AppBar';
import { Card } from '@/components/ui/Card';
import { DetailRow } from '@/components/ui/DetailRow';
import { MenuRow } from '@/components/ui/MenuRow';
import { LanguageSwitch } from '@/features/shell/LanguageSwitch';
import { SignOutButton } from '@/features/shell/SignOutButton';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { screenTitles } from '@/i18n/copy/shell';
import { PhoneEditor } from './PhoneEditor';
import type { Locale } from '@/i18n/locale';
import type { MessagingLink, PushSubscription } from '@/types/views';

/** Two letters for the avatar mark — the patient's own name, shown in full elsewhere on this
 * screen; nothing here is another person's identity (rule 6 only guards OTHER people's names). */
function initialsOf(name: string): string {
  const parts = name.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]).join(' ');
}

function pushLabel(push: PushSubscription | null): keyof typeof copy.identity {
  if (push?.permission === 'denied') return 'pushBlocked';
  if (push?.permission === 'granted' && push.status === 'active') return 'pushOn';
  return 'pushOff';
}

function chatLabel(link: MessagingLink): keyof typeof copy.identity {
  return link.status === 'connected' ? 'chatConnected' : 'chatNotConnected';
}

/**
 * A3 — profile / account (patient). Name and identity line (CR-001/CR-026: no Civil ID, masked or
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

  return (
    <div className="relative flex min-h-full flex-col">
      <AppBar
        title={t(screenTitles.A3, locale)}
        backHref={`/${locale}/app/more`}
        backLabel={t(copy.vocabulary.back, locale)}
        action={<LanguageSwitch locale={locale} role="patient" subjectId={patientId} />}
      />
      <div className="mx-auto flex w-full max-w-content flex-col gap-4 p-3 tablet:p-5">
        <Card className="flex items-center gap-3">
          <span aria-hidden="true" className="flex size-avatar items-center justify-center rounded-full bg-navy-tint type-body-strong">
            {initialsOf(patient.name)}
          </span>
          <span className="flex flex-col">
            <span className="type-body-strong">{patient.name}</span>
            <span className="type-body-small">{t(copy.identity.profileRoleLabel, locale)}</span>
          </span>
        </Card>

        <Card className="flex flex-col gap-3">
          <DetailRow label={t(copy.identity.identityLineLabel, locale)} value={t(copy.identity.identityLineValue, locale)} lang={locale} />
          <PhoneEditor patientId={patientId} initialPhone={patient.phone ?? null} locale={locale} />
          <DetailRow label={t(copy.identity.languageLabel, locale)} value={languageLabel} lang={locale} />
        </Card>

        <div className="flex flex-col">
          <MenuRow
            label={t(copy.identity.browserNotifLabel, locale)}
            value={t(copy.identity[pushLabel(push)], locale)}
            href={`/${locale}/app/more/notifications`}
          />
          <MenuRow
            label={t(copy.identity.chatLabel, locale)}
            value={t(copy.identity[chatLabel(chat)], locale)}
            href={`/${locale}/app/more/notifications`}
          />
          <MenuRow
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

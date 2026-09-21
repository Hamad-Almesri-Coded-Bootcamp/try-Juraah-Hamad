import { ContextBanner } from '@/components/ui/ContextBanner';
import { getCaregiverLink } from '@/lib/data';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';

/**
 * The persistent "whose data is this" banner (UX Principles §10, F2/F3): on every caregiver screen,
 * naming the patient's first name and that the view is read-only. `getCaregiverLink` is
 * session-scoped (lib/data) — a session that is not this caregiver gets the empty view back, so an
 * empty first name here is itself the access model working, not a bug to paper over.
 */
export async function CaregiverBanner({ caregiverId, locale }: { caregiverId: string; locale: Locale }) {
  const link = await getCaregiverLink(caregiverId);
  const title = `${t(copy.vocabulary.viewingRecordOf, locale)} ${link.patientFirstName}`.trim();
  return <ContextBanner variant="caregiver" title={title} detail={t(copy.shell.caregiverBannerReadOnly, locale)} icon="users" />;
}

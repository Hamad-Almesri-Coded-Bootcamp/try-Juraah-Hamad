/**
 * F3 — caregiver detail access, activity feed: E2's own content, read-only (SCREENS.md; UX
 * Principles §10). It renders the patient's `ActivityFeed` over the same `getActivity` rows (already
 * session-scoped to an `active` caregiver, lib/data/mock/access.ts; this file adds no access check of
 * its own), so the day grouping, the messages in the reader's language (`localizeText`) and the
 * actor lines are the patient's, and never more (rule 8). Rows link only into this shell's own
 * read-only routes (`activityHrefFor` in ./format): a prescription or an alert; a caregiver or
 * settings event links nowhere, since those screens are the patient's alone.
 */
import { ActivityFeed } from '@/features/ambient/ActivityFeed';
import { getActivity, getCaregiverLink } from '@/lib/data';
import { activityHrefFor } from './format';
import type { Locale } from '@/i18n/locale';

export async function CaregiverActivity({ caregiverId, locale }: { caregiverId: string; locale: Locale }) {
  const link = await getCaregiverLink(caregiverId);
  const events = await getActivity(link.patientId);

  return (
    <div className="px-3 pb-5 pt-2 tablet:px-5">
      <ActivityFeed events={events} locale={locale} hrefFor={(event) => activityHrefFor(event, locale)} />
    </div>
  );
}

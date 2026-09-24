/**
 * UX Principles §8 — a danger finding, wherever it appears, answers three things in order: what the
 * risk is · what to do now · who is checking it. The InteractionAlert draws the risk (title,
 * description, drugs) and then its review line; the review line is the one slot it offers after the
 * risk, so this returns the line that carries parts two and three together, in that order — the
 * approved what-to-do heading as its lead-in, then the approved body (do not stop or change any
 * medication yourself; a doctor or pharmacist is reviewing this, and the result will appear here).
 * Both halves are the wireframe's own wording (AlertDanger.dc.html), each kept once in
 * the catalogue (`c2WhatToDoHeading`, `c2WhatToDoPendingBody`), and the line is the alert's
 * `reviewLabel` on B2/F2's card and on C2 alike (audit C6, M11).
 *
 * Only for `danger` while `pending_medical_review` holds: telling a patient "don't stop any
 * medicine" on a warning or info finding would manufacture alarm (§8's reverse clause), and once a
 * reviewer has decided, the built-in "checked by a medical reviewer" sentence is the truth.
 * `undefined` everywhere else, so the component keeps its own built-in review sentence.
 */
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert } from '@/types/contracts';

/** Who is reading: the patient, or a caregiver reading about the patient (F2, F3). */
export type AlertAudience = 'patient' | 'caregiver';

export function pendingDangerGuidance(
  alert: Pick<InteractionAlert, 'severity' | 'reviewStatus'>,
  locale: Locale,
  audience: AlertAudience = 'patient',
): string | undefined {
  if (alert.severity !== 'danger' || alert.reviewStatus !== 'pending_medical_review') return undefined;
  const body = audience === 'caregiver' ? copy.safety.c2WhatToDoPendingBodyCaregiver : copy.safety.c2WhatToDoPendingBody;
  return `${t(copy.safety.c2WhatToDoHeading, locale)}: ${t(body, locale)}`;
}

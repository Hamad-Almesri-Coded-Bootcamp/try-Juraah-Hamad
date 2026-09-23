/**
 * Small, caregiving-scoped formatting helpers (WP4 bundle h). F2 (Today/Medicines) renders through
 * `features/day`'s `DoseDayList`/`MedicinesList` once bundle c landed (DEPENDENCIES §1); F3's
 * prescription/alert/activity detail routes have no shared renderer to reuse, so those helpers stay
 * here. No date maths beyond what `lib/schedule/dates` and `i18n/format` already expose (read-only
 * imports; this file lives in `features/caregiving`, not `lib/**`).
 */
import { formatDate, formatStrength as formatStrengthValue, formatTime, formatUnit } from '@/i18n/format';
import { dateOf } from '@/lib/schedule/dates';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Caregiver, Prescription } from '@/types/contracts';

/** `Prescription.drug.strengthUnit`'s word — the one shared unit vocabulary (i18n/format.ts, audit
 * M7), no longer this bundle's own catalogue copy. */
export function unitLabel(unit: Prescription['drug']['strengthUnit'], locale: Locale): string {
  return formatUnit(unit, locale);
}

/** "500 mg" / "٥٠٠ ملغم" — a thin wrapper over the one shared strength formatter (i18n/format.ts,
 * audit M7), kept because the clinic's ReviewerDecision imports it from here. Never converted. `null`
 * when strengthMg is absent (an unread/flagged prescription, CR-002) — the caller renders nothing
 * rather than "undefined". */
export function formatStrength(drug: { strengthMg?: number; strengthUnit?: Prescription['drug']['strengthUnit'] }, locale: Locale): string | null {
  if (drug.strengthMg == null) return null;
  return formatStrengthValue(drug.strengthMg, drug.strengthUnit, locale);
}

// F3 itself now reads B3's own formatDoseTimes / rxStatusLabel / patternLabel from
// features/prescription/format (audit M10: one word per field across both shells). This patternLabel
// stays only for the clinic's ReviewerDecision, which imports it from here.
export function patternLabel(pattern: Prescription['dosingPattern'], locale: Locale): string {
  if (pattern === 'alternate_day') return t(copy.caregiving.f3RxPatternAlternate, locale);
  if (pattern === 'other') return t(copy.caregiving.f3RxPatternOther, locale);
  return t(copy.caregiving.f3RxPatternDaily, locale);
}

/** A dose's "day time" cell for DoseTimeline — newest-first is the caller's sort, not this helper's. */
export function timelineWhen(scheduledAt: string, locale: Locale): { dateLabel: string; timeLabel: string } {
  const isoDate = dateOf(scheduledAt);
  return { dateLabel: formatDate(isoDate, locale), timeLabel: formatTime(scheduledAt.slice(11, 16), locale) };
}

/** F1's relationship-state rule (CLAUDE.md rule 8; MenuRow.md): every state neutral, no colour. */
export function relationshipStateLabel(
  caregiver: Pick<Caregiver, 'status' | 'acceptedAt' | 'expiresAt' | 'acceptedAt'>,
  locale: Locale,
): string {
  if (caregiver.status === 'active') {
    return t(copy.caregiving.f1StatusActiveTemplate, locale).replace('{date}', caregiver.acceptedAt ? formatDate(caregiver.acceptedAt.slice(0, 10), locale) : '');
  }
  if (caregiver.status === 'pending') {
    return t(copy.caregiving.f1StatusPendingTemplate, locale).replace('{date}', formatDate(caregiver.expiresAt.slice(0, 10), locale));
  }
  if (caregiver.status === 'declined') return t(copy.caregiving.f1StatusDeclined, locale);
  if (caregiver.status === 'expired') return t(copy.caregiving.f1StatusExpired, locale);
  // 'revoked' — acceptedAt set/unset tells the two kinds apart (seed rule 1; CR-027), wording only.
  return caregiver.acceptedAt ? t(copy.caregiving.f1StatusRevokedAccepted, locale) : t(copy.caregiving.f1StatusRevokedCancelled, locale);
}

/** F3's activity feed: the route the event's `relatedId` opens, read-only, within the caregiver
 * shell's own routes only (a caregiver has no access to F1 or the patient's Settings/E-group). */
export function activityHrefFor(event: { type: string; relatedId?: string }, locale: Locale): string | undefined {
  if (!event.relatedId) return undefined;
  if (event.type.startsWith('prescription_')) return `/${locale}/care/medicines/${event.relatedId}`;
  if (event.type.startsWith('alert_')) return `/${locale}/care/alerts/${event.relatedId}`;
  return undefined;
}

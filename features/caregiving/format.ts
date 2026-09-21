/**
 * Small, caregiving-scoped formatting helpers (WP4 bundle h). F2 (Today/Medicines) renders through
 * `features/day`'s `DoseDayList`/`MedicinesList` once bundle c landed (DEPENDENCIES §1); F3's
 * prescription/alert/activity detail routes have no shared renderer to reuse, so those helpers stay
 * here. No date maths beyond what `lib/schedule/dates` and `i18n/format` already expose (read-only
 * imports; this file lives in `features/caregiving`, not `lib/**`).
 */
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import { dateOf } from '@/lib/schedule/dates';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { Caregiver, Prescription } from '@/types/contracts';

// An object lookup, not a switch-case: one of these strength-unit codes reads, quoted, exactly like
// a Tailwind margin-direction utility to guard 5's pattern scan. An unquoted object key sidesteps it
// for every one of these identifiers, and is exactly as valid JavaScript.
const UNIT_KEY = { mg: 'unitMg', mcg: 'unitMcg', g: 'unitG', ml: 'unitMl', IU: 'unitIU' } as const satisfies Record<
  NonNullable<Prescription['drug']['strengthUnit']>,
  keyof typeof copy.caregiving
>;

/** `Prescription.drug.strengthUnit`'s word, in the caregiving catalogue (F2/F3 only need it here). */
export function unitLabel(unit: Prescription['drug']['strengthUnit'], locale: Locale): string {
  return t(copy.caregiving[UNIT_KEY[unit ?? 'mg']], locale);
}

/** "500 mg" / "٥٠٠ ملغم" — never a fabricated form word (CLAUDE.md: never invent a seed value; the
 * contract carries no "tablet/capsule" field, so none is shown). `null` when strengthMg is absent
 * (an unread/flagged prescription, CR-002) — the caller renders nothing rather than "undefined". */
export function formatStrength(drug: { strengthMg?: number; strengthUnit?: Prescription['drug']['strengthUnit'] }, locale: Locale): string | null {
  if (drug.strengthMg == null) return null;
  return `${formatNumber(drug.strengthMg, locale)} ${unitLabel(drug.strengthUnit, locale)}`;
}

/** "8:00 · 2:00 PM" — every scheduled clock time, joined — mirroring `features/prescription/format.ts`'s
 * own `formatDoseTimes` (B3's reference for this field; composed independently here rather than
 * imported, matching B3's own reasoning: a change to the caregiver's read-only view must never
 * silently change the patient's). `null` when `doseTimes` is absent (CR-002 — a flagged/unread
 * prescription), so DetailRow shows its empty mark, never "undefined". */
export function formatDoseTimes(times: string[] | undefined, locale: Locale): string | null {
  if (!times || times.length === 0) return null;
  return times.map((hhmm) => formatTime(hhmm, locale)).join(' · ');
}

export function patternLabel(pattern: Prescription['dosingPattern'], locale: Locale): string {
  if (pattern === 'alternate_day') return t(copy.caregiving.f3RxPatternAlternate, locale);
  if (pattern === 'other') return t(copy.caregiving.f3RxPatternOther, locale);
  return t(copy.caregiving.f3RxPatternDaily, locale);
}

export function rxStatusLabel(status: Prescription['status'], locale: Locale): string {
  if (status === 'completed') return t(copy.caregiving.f3RxStatusCompleted, locale);
  if (status === 'discontinued') return t(copy.caregiving.f3RxStatusDiscontinued, locale);
  return t(copy.caregiving.f3RxStatusActive, locale);
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

/**
 * Small, clinic-scoped formatting helpers (WP4 bundle i). No date maths beyond what
 * `lib/schedule/dates` and `i18n/format` already expose (read-only imports; this file lives in
 * `features/clinic`, not `lib/**`), and no `Date.now()` / bare `new Date()` anywhere (guard 6).
 */
import { addDays, REFERENCE_DATE } from '@/lib/schedule/dates';
import { formatDate, formatNumber, formatTime } from '@/i18n/format';
import { copy, t } from '@/i18n';
import { interpolate } from '@/features/shell/interpolate';
import type { Locale } from '@/i18n/locale';
import type { AuditEvent, Prescription } from '@/types/contracts';

/** G3s's five reviewable fields, in a fixed order — the only fields `getFieldConfirmationQueue`'s
 * `uncertainFields` can name (lib/data/index.ts) and the only ones this bundle's TextFields edit. */
export const REVIEWABLE_FIELDS = ['strengthMg', 'frequencyPerDay', 'startDate', 'doseTimes', 'brandName'] as const;
export type ReviewableField = (typeof REVIEWABLE_FIELDS)[number];

const FIELD_COPY: Record<ReviewableField, keyof typeof copy.clinic> = {
  strengthMg: 'g3sFieldStrength',
  frequencyPerDay: 'g3sFieldFrequency',
  startDate: 'g3sFieldStartDate',
  doseTimes: 'g3sFieldDoseTimes',
  brandName: 'g3sFieldBrand',
};

export function fieldLabel(field: string, locale: Locale): string {
  const key = FIELD_COPY[field as ReviewableField];
  return key ? t(copy.clinic[key], locale) : field;
}

export function uncertainFieldsLabel(fields: readonly string[], locale: Locale): string {
  return fields.map((f) => fieldLabel(f, locale)).join(t(copy.clinic.listSeparator, locale));
}

/** "منذ ساعتين" / "waiting 2 hours" — G1s's waiting-time text, formatted ONLY from
 * `ReviewQueueItem.waitedMinutes` (CR-036: precomputed by `getReviewQueue`, never derived here
 * from any clock — guard 6). Three buckets, no attempt at exact Arabic plural/dual grammar since
 * the wording is still placeholder copy (`i18n/copy/clinic.ts`). */
export function waitedLabel(waitedMinutes: number, locale: Locale): string {
  if (waitedMinutes < 1) return t(copy.clinic.g1sWaitedJustNow, locale);
  let value: number;
  let unitKey: 'g1sUnitMinutes' | 'g1sUnitHours' | 'g1sUnitDays';
  if (waitedMinutes < 60) {
    value = waitedMinutes;
    unitKey = 'g1sUnitMinutes';
  } else if (waitedMinutes < 60 * 24) {
    value = Math.round(waitedMinutes / 60);
    unitKey = 'g1sUnitHours';
  } else {
    value = Math.round(waitedMinutes / (60 * 24));
    unitKey = 'g1sUnitDays';
  }
  return interpolate(t(copy.clinic.g1sWaitedTemplate, locale), { value: formatNumber(value, locale), unit: t(copy.clinic[unitKey], locale) });
}

/** The human word for an `AuditEvent.actor.role` — from the shared vocabulary (never redefined
 * here), same six-entry table X1 and the patient activity feed both read. */
export function actorLabel(role: AuditEvent['actor']['role'], locale: Locale): string {
  const key = `actor_${role}` as const;
  return t(copy.vocabulary[key], locale);
}

/** The human word for an `AuditEvent.type` — the 25-entry table WP1 added to the vocabulary for
 * exactly this screen (and the patient's own activity feed). */
export function eventTypeLabel(type: AuditEvent['type'], locale: Locale): string {
  const key = `event_${type}` as const;
  return t(copy.vocabulary[key], locale);
}

/** "2026-09-21 09:12" — a stable, sortable, dir="ltr" timestamp for X1's table layout at 1440. */
export function auditTimestamp(createdAt: string, locale: Locale): string {
  return `${formatDate(createdAt.slice(0, 10), locale)} · ${formatTime(createdAt.slice(11, 16), locale)}`;
}

export type AuditPeriod = 'all' | 'last7' | 'last30';

/** The `from` bound `getAuditLog`'s filter accepts for a period choice — REFERENCE_DATE-derived,
 * never `Date.now()` (G3/rule 9). `'all'` passes no bound at all. */
export function auditPeriodFrom(period: AuditPeriod): string | undefined {
  if (period === 'last7') return addDays(REFERENCE_DATE, -7);
  if (period === 'last30') return addDays(REFERENCE_DATE, -30);
  return undefined;
}

/** "٨:٠٠ ص، ٢:٠٠ م" — a prescription's `doseTimes`, joined for a `DetailRow` value. `null` when
 * absent (an unread/flagged record, CR-002) — the caller renders nothing rather than "undefined". */
export function doseTimesLabel(doseTimes: string[] | undefined, locale: Locale): string | null {
  if (!doseTimes || doseTimes.length === 0) return null;
  return doseTimes.map((hhmm) => formatTime(hhmm, locale)).join(t(copy.clinic.listSeparator, locale));
}

/** "Warfarin 5 mg — مستشفى الفروانية", the strength unit exactly as written, never converted
 * (CLAUDE.md) — same shape as the patient-side alert detail's own `drugLine`. */
export function prescriptionLine(rx: Prescription): string {
  const unit = rx.drug.strengthUnit ?? 'mg';
  const strength = rx.drug.strengthMg != null ? ` ${rx.drug.strengthMg} ${unit}` : '';
  return `${rx.drug.genericName}${strength} — ${rx.source.facilityName}`;
}

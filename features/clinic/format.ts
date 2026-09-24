/**
 * Small, clinic-scoped formatting helpers (WP4 bundle i). No date maths beyond what
 * `lib/schedule/dates` and `i18n/format` already expose (read-only imports; this file lives in
 * `features/clinic`, not `lib/**`), and no `Date.now()` / bare `new Date()` anywhere (guard 6).
 *
 * Everything a clinic screen prints from the data goes through `i18n/localize.ts` here (CR-071: each
 * locale shows only its own language), and two data parts are joined with " · ", never a dash.
 */
import { addDays, kuwaitToday } from '@/lib/schedule/dates';
import { formatCount, formatStrength, formatTime, type PluralCopy } from '@/i18n/format';
import { localizeDrugName, localizeFacility } from '@/i18n/localize';
import { copy, t } from '@/i18n';
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

const c = copy.clinic;
const WAITED_MINUTES: PluralCopy = {
  one: c.g1sWaitedMinutesOne,
  two: c.g1sWaitedMinutesTwo,
  few: c.g1sWaitedMinutesFew,
  many: c.g1sWaitedMinutesMany,
  other: c.g1sWaitedMinutesOther,
};
const WAITED_HOURS: PluralCopy = {
  one: c.g1sWaitedHoursOne,
  two: c.g1sWaitedHoursTwo,
  few: c.g1sWaitedHoursFew,
  many: c.g1sWaitedHoursMany,
  other: c.g1sWaitedHoursOther,
};
const WAITED_DAYS: PluralCopy = {
  one: c.g1sWaitedDaysOne,
  two: c.g1sWaitedDaysTwo,
  few: c.g1sWaitedDaysFew,
  many: c.g1sWaitedDaysMany,
  other: c.g1sWaitedDaysOther,
};

/** "منذ يومين" / "waiting 2 days" — G1s's waiting-time text, formatted ONLY from
 * `ReviewQueueItem.waitedMinutes` (CR-036: precomputed by `getReviewQueue`, never derived here
 * from any clock — guard 6). Three buckets, each in the plural form its number takes. */
export function waitedLabel(waitedMinutes: number, locale: Locale): string {
  if (waitedMinutes < 1) return t(copy.clinic.g1sWaitedJustNow, locale);
  if (waitedMinutes < 60) return formatCount(waitedMinutes, locale, WAITED_MINUTES);
  if (waitedMinutes < 60 * 24) return formatCount(Math.round(waitedMinutes / 60), locale, WAITED_HOURS);
  return formatCount(Math.round(waitedMinutes / (60 * 24)), locale, WAITED_DAYS);
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

/** Rows grouped by the calendar day they happened on, in the order they arrive (newest first from
 * `getAuditLog`). The day is the stored timestamp's own date, never a clock read. */
export function groupByDay<T extends { createdAt: string }>(rows: readonly T[]): { day: string; rows: T[] }[] {
  const groups: { day: string; rows: T[] }[] = [];
  for (const row of rows) {
    const day = row.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.rows.push(row);
    else groups.push({ day, rows: [row] });
  }
  return groups;
}

/**
 * Which sentence X1's proof notice may say (CLAUDE.md rule 1), so it stays true whatever the filters
 * show: "all from the assistant or the system" only when no actor filter narrows the rows and every
 * row really is `agent` or `system`; otherwise what the rows show instead.
 */
export type ProofNoticeKind = 'filtered' | 'none' | 'all' | 'mixed';
export function proofNoticeKind(rows: readonly Pick<AuditEvent, 'actor'>[], actorFiltered: boolean): ProofNoticeKind {
  if (actorFiltered) return 'filtered';
  if (rows.length === 0) return 'none';
  return rows.every((r) => r.actor.role === 'agent' || r.actor.role === 'system') ? 'all' : 'mixed';
}

export type AuditPeriod = 'all' | 'last7' | 'last30';

/** The `from` bound `getAuditLog`'s filter accepts for a period choice — REFERENCE_DATE-derived,
 * never `Date.now()` (G3/rule 9). `'all'` passes no bound at all. */
export function auditPeriodFrom(period: AuditPeriod): string | undefined {
  if (period === 'last7') return addDays(kuwaitToday(), -7);
  if (period === 'last30') return addDays(kuwaitToday(), -30);
  return undefined;
}

/** "٨:٠٠، ٢٠:٠٠" — a prescription's `doseTimes`, joined for a line of text. `null` when absent (an
 * unread/flagged record, CR-002) — the caller renders nothing rather than "undefined". */
export function doseTimesLabel(doseTimes: string[] | undefined, locale: Locale): string | null {
  if (!doseTimes || doseTimes.length === 0) return null;
  return doseTimes.map((hhmm) => formatTime(hhmm, locale)).join(t(copy.clinic.listSeparator, locale));
}

/** The name on the box first, then its strength in its own unit, never converted (guard U; audit
 * M7; CR-069(l)): "ماريفان ٥ ملغم" / "Marevan 5 mg". */
export function rxHeadline(rx: Prescription, locale: Locale): string {
  const name = localizeDrugName(rx.drug.brandName ?? rx.drug.genericName, locale);
  return rx.drug.strengthMg != null ? `${name} ${formatStrength(rx.drug.strengthMg, rx.drug.strengthUnit, locale)}` : name;
}

/** "Warfarin 5 mg · Farwaniya Hospital" / "وارفارين ٥ ملغم · مستشفى الفروانية": the generic name and
 * strength, then the issuing facility, each in the reader's language, joined with " · ". */
export function prescriptionLine(rx: Prescription, locale: Locale): string {
  const strength = rx.drug.strengthMg != null ? ` ${formatStrength(rx.drug.strengthMg, rx.drug.strengthUnit, locale)}` : '';
  return `${localizeDrugName(rx.drug.genericName, locale)}${strength} · ${localizeFacility(rx.source.facilityName, locale)}`;
}

// ---------------------------------------------------------------------------------------------
// G3s — what a reviewer types into the correction form

const ARABIC_INDIC_ZERO = 0x0660;
const EXTENDED_ARABIC_INDIC_ZERO = 0x06f0;

/**
 * A reviewer typing in Arabic writes the Arabic comma and Arabic-Indic digits ("٠٨:٠٠، ٢٠:٠٠", as the
 * helper line itself shows). The stored values are Western digits split on ",", so the input is
 * normalised first: both Arabic-Indic digit sets become 0–9, the Arabic comma (،) becomes ",", and the
 * Arabic decimal separator (٫) becomes ".".
 */
export function normaliseTypedDigits(value: string): string {
  return value
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - ARABIC_INDIC_ZERO))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - EXTENDED_ARABIC_INDIC_ZERO))
    .replace(/\u060C/g, ',')
    .replace(/\u066B/g, '.');
}

export interface FieldDraft {
  brandName: string;
  strengthMg: string;
  frequencyPerDay: string;
  startDate: string;
  doseTimes: string;
}

export type FieldDraftError = 'number' | 'date' | 'times';

export interface ParsedFields {
  values: {
    brandName?: string;
    strengthMg?: number;
    frequencyPerDay?: number;
    startDate?: string;
    doseTimes?: string[];
  };
  errors: Partial<Record<keyof FieldDraft, FieldDraftError>>;
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const ISO_DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/**
 * G3s's form, read into the values `confirmPrescriptionFields` stores. Every numeric field is
 * normalised first (`normaliseTypedDigits`). An empty field stays absent; a field that is not empty
 * but cannot be read is reported, so a wrong value never reaches the schedule. Times come out as
 * "HH:mm" ("8:00" → "08:00").
 */
export function parseFieldDraft(draft: FieldDraft): ParsedFields {
  const values: ParsedFields['values'] = {};
  const errors: ParsedFields['errors'] = {};

  const brand = draft.brandName.trim();
  if (brand) values.brandName = brand;

  const strength = normaliseTypedDigits(draft.strengthMg).trim();
  if (strength) {
    const n = Number(strength);
    if (Number.isFinite(n) && n > 0) values.strengthMg = n;
    else errors.strengthMg = 'number';
  }

  const frequency = normaliseTypedDigits(draft.frequencyPerDay).trim();
  if (frequency) {
    const n = Number(frequency);
    if (Number.isInteger(n) && n > 0) values.frequencyPerDay = n;
    else errors.frequencyPerDay = 'number';
  }

  const start = normaliseTypedDigits(draft.startDate).trim();
  if (start) {
    if (ISO_DATE.test(start)) values.startDate = start;
    else errors.startDate = 'date';
  }

  const times = normaliseTypedDigits(draft.doseTimes)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (times.length > 0) {
    const parsed = times.map((s) => TIME.exec(s));
    if (parsed.every(Boolean)) values.doseTimes = parsed.map((m) => `${m![1]!.padStart(2, '0')}:${m![2]}`);
    else errors.doseTimes = 'times';
  }

  return { values, errors };
}

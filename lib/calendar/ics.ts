/**
 * The calendar feed's body (P2-WP6, API-SURFACE §B `GET /api/calendar/{token}.ics`) — RFC 5545,
 * pure: doses in, text out. Nothing here reads a clock (`dtstampIso` is REFERENCE_NOW, passed by
 * the caller — D-021), a database or the environment.
 *
 * One VEVENT per dose: UID = the dose id, DTSTART in Asia/Kuwait (with its VTIMEZONE, as RFC 5545
 * §3.2.19 requires for every TZID used), SUMMARY = drug name + strength + dose per administration —
 * data only, no label, so no user-facing word leaves the copy catalogue. TRANSP:TRANSPARENT: a
 * dose reminder never blocks the patient's calendar as busy.
 *
 * Rule 3: a dose with `tracked: false` carries NO status word of any kind. The decision keys off
 * `Dose.tracked` — never off the status word (every untracked seed dose also reads `upcoming`,
 * so a builder that switched on the word would look right and be wrong). A tracked dose carries
 * its status only as the machine property X-JURAH-DOSE-STATUS, which calendar clients do not
 * display (RFC 5545 §3.8.8.2) — the feed shows no clinical wording a screen does not show.
 *
 * Output: CRLF line endings, lines folded at 75 octets (UTF-8 bytes, never splitting a code
 * point; continuation lines begin with one space), TEXT values escaped (§3.3.11).
 */
import type { DoseWithPrescription } from '@/types/views';

export const ICS_PRODID = '-//Jurah//Dose calendar 1.0//EN';
export const ICS_TZID = 'Asia/Kuwait';
const KUWAIT_OFFSET_MS = 3 * 60 * 60 * 1000; // UTC+3 all year; Kuwait observes no DST.

/** The fixed VTIMEZONE for Asia/Kuwait (+03:00, no daylight saving). */
const VTIMEZONE = [
  'BEGIN:VTIMEZONE',
  `TZID:${ICS_TZID}`,
  'BEGIN:STANDARD',
  'DTSTART:19700101T000000',
  'TZOFFSETFROM:+0300',
  'TZOFFSETTO:+0300',
  'TZNAME:+03',
  'END:STANDARD',
  'END:VTIMEZONE',
];

function instant(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new RangeError(`ics: not an ISO datetime: ${JSON.stringify(iso)}`);
  return t;
}

/** `YYYYMMDDTHHMMSS` of the instant as Kuwait wall-clock time (for `DTSTART;TZID=Asia/Kuwait`). */
export function kuwaitLocal(iso: string): string {
  const shifted = new Date(instant(iso) + KUWAIT_OFFSET_MS).toISOString(); // UTC fields = Kuwait fields
  return shifted.slice(0, 19).replace(/[-:]/g, '');
}

/** `YYYYMMDDTHHMMSSZ` in UTC (for DTSTAMP, which RFC 5545 requires in UTC). */
export function utcStamp(iso: string): string {
  return new Date(instant(iso)).toISOString().slice(0, 19).replace(/[-:]/g, '') + 'Z';
}

/** RFC 5545 §3.3.11 TEXT escaping. */
export function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n');
}

/** RFC 5545 §3.1: fold a content line so no physical line exceeds 75 octets. */
export function foldLine(line: string): string {
  const encoder = new TextEncoder();
  const out: string[] = [];
  let current = '';
  let octets = 0;
  let limit = 75;
  for (const ch of line) {
    const n = encoder.encode(ch).length;
    if (octets + n > limit) {
      out.push(current);
      current = ' ';
      octets = 1;
      limit = 75;
    }
    current += ch;
    octets += n;
  }
  out.push(current);
  return out.join('\r\n');
}

/** SUMMARY: generic name, brand in parentheses, strength in its OWN unit (never converted — the
 * contract's warning; absent unit reads mg, CR-003), then "× dose per administration". */
export function doseSummary(dose: DoseWithPrescription): string {
  const { genericName, brandName, strengthMg, strengthUnit } = dose.drug;
  let s = genericName;
  if (brandName) s += ` (${brandName})`;
  if (strengthMg !== undefined && strengthMg !== null) s += ` ${strengthMg} ${strengthUnit ?? 'mg'}`;
  s += ` × ${dose.dosePerAdministration}`;
  return s;
}

function vevent(dose: DoseWithPrescription, dtstamp: string): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeText(dose.id)}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;TZID=${ICS_TZID}:${kuwaitLocal(dose.scheduledAt)}`,
    `SUMMARY:${escapeText(doseSummary(dose))}`,
    'TRANSP:TRANSPARENT',
  ];
  // Rule 3 — keyed off `tracked` (default true), never off the status word.
  if (dose.tracked !== false) lines.push(`X-JURAH-DOSE-STATUS:${dose.status}`);
  lines.push('END:VEVENT');
  return lines;
}

/** The whole feed. Doses are emitted in the order given (the caller orders by scheduledAt, id). */
export function buildIcs(doses: readonly DoseWithPrescription[], dtstampIso: string): string {
  const dtstamp = utcStamp(dtstampIso);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${ICS_PRODID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...VTIMEZONE,
    ...doses.flatMap((d) => vevent(d, dtstamp)),
    'END:VCALENDAR',
  ];
  return lines.map(foldLine).join('\r\n') + '\r\n';
}

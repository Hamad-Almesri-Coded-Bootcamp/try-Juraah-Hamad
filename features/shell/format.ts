/**
 * The H3 "as of" line (offline page and the LastKnown failed-refresh wrapper). Composes
 * i18n/format.ts's own date/time formatters against Asia/Kuwait so a snapshot's timestamp reads the
 * same way REFERENCE_NOW does everywhere else (G3) — this file does not touch i18n/format.ts (out
 * of WP3's file list) or lib/config.ts (read-only import of the timezone constant every module uses).
 */
import { REFERENCE_TIME_ZONE } from '@/lib/config';
import { formatDate, formatTime } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

/** `iso` is a full instant (REFERENCE_NOW or a recorded snapshot time), never `Date.now()` — the
 * caller always supplies it (guard 6: only lib/config.ts constructs a clock reading). */
export function formatAsOf(iso: string, locale: Locale): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: REFERENCE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const isoDate = `${get('year')}-${get('month')}-${get('day')}`;
  const hhmm = `${get('hour')}:${get('minute')}`;
  return `${formatDate(isoDate, locale)} ${formatTime(hhmm, locale)}`;
}

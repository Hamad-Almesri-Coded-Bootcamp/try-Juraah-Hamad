/**
 * Pure calendar-date helpers for the schedule generator. Every date is a plain ISO date string
 * ("YYYY-MM-DD") compared and shifted with UTC-only arithmetic so results never depend on the
 * machine's local timezone (Kuwait, UTC+3, no DST — G3, REFERENCE_NOW). `new Date(...)` below
 * always takes an argument, so guard 6 (no bare `new Date()`) does not apply.
 */
import { REFERENCE_NOW } from '@/lib/config';

/** The Kuwait calendar date REFERENCE_NOW falls on — read straight off the constant's own ISO text. */
export const REFERENCE_DATE: string = REFERENCE_NOW.slice(0, 10);

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** b - a, in whole days. */
export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00Z`).getTime();
  const db = new Date(`${b}T00:00:00Z`).getTime();
  return Math.round((db - da) / 86_400_000);
}

export function isBeforeOrEqual(a: string, b: string): boolean {
  return a <= b;
}

/** Combine a "YYYY-MM-DD" date and an "HH:mm" time into a full Kuwait-offset ISO datetime. */
export function toKuwaitIso(isoDate: string, hhmm: string): string {
  return `${isoDate}T${hhmm}:00+03:00`;
}

/** The "YYYY-MM-DD" a scheduledAt (Kuwait-offset ISO datetime) falls on — string slicing, no Date. */
export function dateOf(scheduledAtIso: string): string {
  return scheduledAtIso.slice(0, 10);
}

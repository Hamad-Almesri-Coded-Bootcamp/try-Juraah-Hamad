/**
 * features/ambient/format.ts — E2's own href map and timestamp composition (WP4 bundle g).
 */
import { describe, expect, it } from 'vitest';
import { activityHrefFor, activityTimeLabel } from '@/features/ambient/format';

describe('activityHrefFor — patient-shell destinations only where SCREENS.md names one', () => {
  it('a prescription event links to B3', () => {
    expect(activityHrefFor({ type: 'prescription_added', relatedId: 'rx-001' }, 'en')).toBe('/en/app/medicines/rx-001');
    expect(activityHrefFor({ type: 'prescription_discontinued', relatedId: 'rx-004' }, 'ar')).toBe('/ar/app/medicines/rx-004');
  });

  it('an alert event links to C2', () => {
    expect(activityHrefFor({ type: 'alert_raised', relatedId: 'ia-001' }, 'en')).toBe('/en/app/safety/ia-001');
    expect(activityHrefFor({ type: 'alert_reviewed', relatedId: 'ia-002' }, 'ar')).toBe('/ar/app/safety/ia-002');
  });

  it('a caregiver-lifecycle event links to the F1 list (no per-caregiver route exists)', () => {
    expect(activityHrefFor({ type: 'caregiver_invited', relatedId: 'cg-01' }, 'en')).toBe('/en/app/more/caregivers');
    expect(activityHrefFor({ type: 'caregiver_revoked', relatedId: 'cg-06' }, 'en')).toBe('/en/app/more/caregivers');
  });

  it('tracking on/off links to E3 (settings) — relatedId is a patientId, never used as a path segment', () => {
    expect(activityHrefFor({ type: 'tracking_enabled', relatedId: 'pt-03' }, 'en')).toBe('/en/app/more/settings');
    expect(activityHrefFor({ type: 'tracking_disabled', relatedId: 'pt-02' }, 'ar')).toBe('/ar/app/more/settings');
  });

  it('a dose-status, schedule, refill, messaging, push or sign-in/out event has no destination named in SCREENS.md — no href, never invented', () => {
    for (const type of ['dose_status_recorded', 'schedule_recomputed', 'refill_requested', 'refill_status_changed', 'messaging_connected', 'messaging_disconnected', 'push_enabled', 'push_disabled', 'signed_in', 'signed_out'] as const) {
      expect(activityHrefFor({ type, relatedId: 'x' }, 'en')).toBeUndefined();
    }
  });

  it('a prescription/alert event with no relatedId renders no link rather than a broken one', () => {
    expect(activityHrefFor({ type: 'prescription_added' }, 'en')).toBeUndefined();
    expect(activityHrefFor({ type: 'alert_raised' }, 'en')).toBeUndefined();
  });
});

describe('activityTimeLabel', () => {
  it('composes the date and time from a single ISO instant, in the requested locale’s numerals', () => {
    const label = activityTimeLabel('2026-09-19T11:04:00+03:00', 'en');
    expect(label).toContain('September');
    expect(label).toContain('11:04');
  });

  it('renders Arabic-Indic numerals on the ar locale — never a Latin literal', () => {
    const label = activityTimeLabel('2026-09-19T11:04:00+03:00', 'ar');
    expect(label).not.toMatch(/[0-9]/);
  });
});

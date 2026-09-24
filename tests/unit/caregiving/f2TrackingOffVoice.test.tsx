/**
 * F2 Today — the tracking-off line speaks to the caregiver (audit 2026-09-23, M10).
 *
 * The shared day list's own line is written for the PATIENT ("ما نتابع التزامك… شغّل المتابعة" — we
 * are not tracking YOUR doses, turn it on), which a caregiver can neither be addressed by nor act on.
 * The caregiver sees the same plan and the same fact (UX Principles §10), in the caregiver's voice,
 * naming the patient — and with no action (rule 8: write controls absent, not disabled).
 *
 * Rule 3 still holds: the pill's absence keys off each `Dose.tracked`, so no dose row gains a pill.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CaregiverToday } from '@/features/caregiving/CaregiverToday';
import { interpolate } from '@/features/shell/interpolate';
import { copy, t } from '@/i18n';
import { localizeFirstName } from '@/i18n/localize';
import { REFERENCE_DATE } from '@/lib/schedule/dates';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
});

describe('F2 Today, حمد (tracking off)', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale}: the caregiver-voice line names the patient; the patient-voice line and its action are absent`, async () => {
      const { container } = render(await CaregiverToday({ caregiverId: 'cg-01', locale, day: REFERENCE_DATE }));

      // The patient named in the reader's language (CR-071): حمد in Arabic, Hamad in English.
      const name = localizeFirstName('حمد', locale);
      expect(screen.getByText(interpolate(t(copy.caregiving.f2TrackingOffNoticeTitleTemplate, locale), { name }))).toBeInTheDocument();
      expect(screen.getByText(interpolate(t(copy.caregiving.f2TrackingOffNoticeBodyTemplate, locale), { name }))).toBeInTheDocument();

      expect(container.textContent).not.toContain(t(copy.day.trackingOffNotice, locale));
      expect(container.textContent).not.toContain(t(copy.day.turnTrackingOn, locale));
      expect(container.querySelector('a[href*="settings"]')).toBeNull();
      expect(container.querySelectorAll('button')).toHaveLength(0);

      // Rule 3 / G10 — still no status pill on an untracked dose.
      expect(container.querySelectorAll('[data-testid="dose-row"]').length).toBe(6);
      expect(container.querySelectorAll('[data-testid="status-pill"]')).toHaveLength(0);
    });
  }
});

describe('F2 Today, tracking on', () => {
  it('no tracking-off line at all when the patient has tracking on', async () => {
    const settings = getStore().settings.find((s) => s.patientId === 'pt-01')!;
    settings.adherenceCheckInEnabled = true;
    const { container } = render(await CaregiverToday({ caregiverId: 'cg-01', locale: 'en', day: REFERENCE_DATE }));
    expect(container.textContent).not.toContain(interpolate(t(copy.caregiving.f2TrackingOffNoticeTitleTemplate, 'en'), { name: 'Hamad' }));
    expect(container.textContent).not.toContain(t(copy.day.trackingOffNotice, 'en'));
  });
});

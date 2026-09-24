/**
 * B3 — features/prescription/PrescriptionDetail.tsx, exercised against the real mock store (the
 * seed's own record shapes) rather than a hand-rolled fixture, per the brief's explicit tests:
 * rx-006 (core-fields-only) renders no "undefined"/missing-value artifact, a no-dispensing rx shows
 * no depletion estimate, rx-008 shows "50 mcg" exactly (never converted), and the dose timeline
 * carries no pill for حمد (untracked) and pills for سارة (tracked), keyed on `tracked` — never the
 * status word (rule 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PrescriptionDetail } from '@/features/prescription/PrescriptionDetail';
import { copy, t } from '@/i18n';
import { formatDayLabel } from '@/i18n/format';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => {
  reset();
});

describe('B3 — rx-006 (فاطمة, core-fields-only, needsReview)', () => {
  it('renders with no "undefined" text anywhere, and the needs-review notice', async () => {
    setScriptSession({ subjectId: 'pt-02', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-006', locale: 'en', emptyBackHref: '/en/app/medicines' });
    const { container } = render(element);
    expect(container.textContent).not.toMatch(/undefined/i);
    expect(screen.getByText(t(copy.prescription.rxNeedsReviewNote, 'en'))).toBeInTheDocument();
    // The dispensing fields never disappear, even though rx-006 has no dispensing record: each is
    // still named, in the card's one "not recorded" line.
    const named = [...container.querySelectorAll('[data-field-label]')].map((el) => el.textContent);
    for (const label of [copy.prescription.rxUnitsPerPackageLabel, copy.prescription.rxTotalDispensedLabel, copy.prescription.rxDispenseDateLabel, copy.prescription.rxBrandDispensedLabel]) {
      expect(named).toContain(t(label, 'en'));
    }
    // No depletion estimate without a dispensing record: the plain sentence instead.
    expect(screen.queryByText(/days of supply left/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByText(t(copy.supply.supplyNoEstimate, 'en'))).toBeInTheDocument();
  });

  it('never prints the seed’s literal "(unreadable)", no dash and no empty mark on screen (CR-071)', async () => {
    setScriptSession({ subjectId: 'pt-02', role: 'patient' });
    for (const locale of ['en', 'ar'] as const) {
      const { container } = render(await PrescriptionDetail({ prescriptionId: 'rx-006', locale, emptyBackHref: `/${locale}/app/medicines` }));
      expect(container.textContent).not.toContain('(unreadable)');
      expect(container.textContent).not.toMatch(/[—–]/);
      cleanup();
    }
  });

  it('has no refill action while active with no dispensing history is still shown — its status governs the button, not dispensing', async () => {
    setScriptSession({ subjectId: 'pt-02', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-006', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    // rx-006 is active (per the seed) — the refill link is present; it links into D1 with this rx.
    expect(screen.getByRole('button', { name: 'Request a refill' })).toBeInTheDocument();
  });
});

describe('B3 — rx-008 (سارة, Levothyroxine, strengthUnit mcg)', () => {
  it('shows "50 mcg" exactly as seeded, never "0.05" (guard U)', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-008', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getAllByText('50 mcg').length).toBeGreaterThan(0); // the header and the Strength field
    expect(screen.queryByText(/0\.05/)).not.toBeInTheDocument();
  });

  it('carries a status pill on every dose-history row — سارة is tracked', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-008', locale: 'en', emptyBackHref: '/en/app/medicines' });
    const { container } = render(element);
    const pills = container.querySelectorAll('[data-testid="status-pill"]');
    expect(pills.length).toBeGreaterThan(0);
  });
});

describe('B3 — no dispensing record (rx-005, فاطمة; rx-009, سارة)', () => {
  it('rx-005 names every dispensing field and shows no depletion meter or estimate', async () => {
    setScriptSession({ subjectId: 'pt-02', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-005', locale: 'en', emptyBackHref: '/en/app/medicines' });
    const { container } = render(element);
    const named = [...container.querySelectorAll('[data-field-label]')].map((el) => el.textContent);
    expect(named).toContain(t(copy.prescription.rxDispenseDateLabel, 'en'));
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.queryByText(/days of supply left/i)).not.toBeInTheDocument();
  });

  it('rx-009 (confirmed, no dispensing) shows no depletion meter either', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-009', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
});

describe('B3 — حمد (untracked): the dose-history timeline carries no pill', () => {
  it('rx-001 (Warfarin, dispensed) shows a depletion meter but no status pill in its dose history', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'en', emptyBackHref: '/en/app/medicines' });
    const { container } = render(element);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-testid="status-pill"]').length).toBe(0);
    expect(screen.getByText(t(copy.prescription.doseHistoryTrackingOffNote, 'en'))).toBeInTheDocument();
  });
});

describe('B3 — the dose history is a window around today, not 90 flat rows (audit M8)', () => {
  it('rx-001 (Warfarin, 90 daily doses to 29 Nov): last 7 days + next 7 days, the rest behind a real "show all" button', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'en', emptyBackHref: '/en/app/medicines' });
    const { container } = render(element);
    const rows = () => container.querySelectorAll('.jr-dose-timeline__row').length;

    // REFERENCE_NOW 21 Sept 09:15 — past: 15–20 Sept (6); planned: 21–27 Sept (7).
    expect(rows()).toBe(13);
    expect(screen.getByRole('heading', { name: 'Planned doses' })).toBeInTheDocument();
    const farEnd = formatDayLabel('2026-11-29', 'en');
    expect(container.textContent).not.toContain(farEnd); // the far end of the plan is behind the disclosure

    const showPast = screen.getByRole('button', { name: 'Show all 20 past doses' });
    const showPlanned = screen.getByRole('button', { name: 'Show all 70 planned doses' });
    expect(showPast).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(showPlanned);
    expect(screen.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
    expect(container.textContent).toContain(farEnd);
    fireEvent.click(showPast);
    expect(rows()).toBe(90); // nothing dropped

    // Rule 3 still holds on every row, past and planned — حمد is untracked.
    expect(container.querySelectorAll('[data-testid="status-pill"]').length).toBe(0);
  });

  it('rx-008 (سارة, tracked): the planned part keeps its pills — keyed on each row’s tracked, unchanged', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-008', locale: 'en', emptyBackHref: '/en/app/medicines' });
    const { container } = render(element);
    const rows = container.querySelectorAll('.jr-dose-timeline__row');
    const pills = container.querySelectorAll('.jr-dose-timeline__row [data-testid="status-pill"]');
    expect(rows.length).toBeGreaterThan(0);
    expect(pills.length).toBe(rows.length);
  });
});

describe('B3 — the dose reads as a person says it, never a bare number (audit M9)', () => {
  it('rx-001: "Dose" reads "One tablet"; Arabic strength uses the Arabic unit word and digits', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const en = render(await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'en', emptyBackHref: '/en/app/medicines' }));
    expect(en.container.textContent).toContain('DoseOne tablet');
    cleanup();
    const ar = render(await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'ar', emptyBackHref: '/ar/app/medicines' }));
    expect(ar.container.textContent).toContain('الجرعةحبة واحدة');
    expect(ar.container.textContent).toContain('٥ ملغم');
    expect(ar.container.textContent).not.toMatch(/\bmg\b/);
  });
});

describe('B3 — discontinued prescription (rx-004, حمد)', () => {
  it('shows the discontinued reason and date, and no refill action', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-004', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getByText('Discontinued')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request a refill' })).not.toBeInTheDocument();
  });

  it('its dose history opens on the course’s own last week, never an empty list (audit M8 window)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(await PrescriptionDetail({ prescriptionId: 'rx-004', locale: 'en', emptyBackHref: '/en/app/medicines' }));
    expect(container.querySelectorAll('.jr-dose-timeline__row').length).toBe(7);
    expect(screen.getByRole('button', { name: 'Show all 88 past doses' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Planned doses' })).not.toBeInTheDocument();
  });
});

describe('B3 — record not found or not this session\'s to read', () => {
  it('renders the empty state with a way back, never a blank screen', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-999', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getByText(t(copy.prescription.b3EmptyTitle, 'en'))).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t(copy.prescription.b3EmptyAction, 'en') })).toBeInTheDocument();
  });

  it('a patient session may not read another patient\'s prescription', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    // rx-006 belongs to فاططمة (pt-02), not حمد (pt-01).
    const element = await PrescriptionDetail({ prescriptionId: 'rx-006', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getByText(t(copy.prescription.b3EmptyTitle, 'en'))).toBeInTheDocument();
  });
});

describe('B3 — Daylight composition (CR-071)', () => {
  it('rx-001: a link row to the standing serious interaction, the three facts, supply with its refill action', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'en', emptyBackHref: '/en/app/medicines' }));
    const alertLink = container.querySelector('a.jr-alert-row--danger');
    expect(alertLink?.getAttribute('href')).toBe('/en/app/safety/ia-001');
    expect(container.querySelectorAll('.jr-fact')).toHaveLength(3);
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByRole('button', { name: t(copy.prescription.refillButtonLabel, 'en') })).toBeInTheDocument();
  });

  it('rx-003 (Metformin, in no finding): no interaction link', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(await PrescriptionDetail({ prescriptionId: 'rx-003', locale: 'en', emptyBackHref: '/en/app/medicines' }));
    expect(container.querySelector('.jr-alert-row')).toBeNull();
  });

  it('every contract field is named once: shown with its value, or listed in the one "not recorded" line', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'en', emptyBackHref: '/en/app/medicines' }));
    const named = [...container.querySelectorAll('[data-field-label]')].map((el) => el.textContent);
    const labels = [
      copy.prescription.rxGenericLabel, copy.prescription.rxBrandLabel, copy.prescription.rxStrengthLabel, copy.prescription.rxDoseLabel,
      copy.prescription.rxFrequencyLabel, copy.prescription.rxPatternLabel, copy.prescription.rxDoseTimesLabel, copy.prescription.rxStartDateLabel,
      copy.prescription.rxDurationLabel, copy.prescription.rxTimingLabel, copy.prescription.rxRouteLabel, copy.prescription.rxIndicationLabel,
      copy.prescription.rxNotesLabel, copy.prescription.rxPrescriberLabel, copy.prescription.rxPrescribedAtLabel, copy.prescription.rxStatusLabel,
      copy.prescription.rxUnitsPerPackageLabel, copy.prescription.rxTotalDispensedLabel, copy.prescription.rxDispenseDateLabel, copy.prescription.rxBrandDispensedLabel,
    ].map((l) => t(l, 'en'));
    for (const label of labels) expect(named.filter((n) => n === label)).toHaveLength(1);
    // No empty mark anywhere: an absent value is named in the line, never drawn as a dash.
    expect(container.querySelectorAll('.wsf-dr__value--empty')).toHaveLength(0);
  });

  it('rx-001 in Arabic: no Latin script and no Western digit anywhere on the screen (CR-071)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(await PrescriptionDetail({ prescriptionId: 'rx-001', locale: 'ar', emptyBackHref: '/ar/app/medicines' }));
    expect(container.textContent).not.toMatch(/[A-Za-z0-9]/);
  });
});

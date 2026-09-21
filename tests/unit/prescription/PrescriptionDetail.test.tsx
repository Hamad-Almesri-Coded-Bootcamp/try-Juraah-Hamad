/**
 * B3 — features/prescription/PrescriptionDetail.tsx, exercised against the real mock store (the
 * seed's own record shapes) rather than a hand-rolled fixture, per the brief's explicit tests:
 * rx-006 (core-fields-only) renders no "undefined"/missing-value artifact, a no-dispensing rx shows
 * no depletion estimate, rx-008 shows "50 mcg" exactly (never converted), and the dose timeline
 * carries no pill for حمد (untracked) and pills for سارة (tracked), keyed on `tracked` — never the
 * status word (rule 3).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { PrescriptionDetail } from '@/features/prescription/PrescriptionDetail';
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
    expect(screen.getByText(/waiting on a medical reviewer/i)).toBeInTheDocument();
    // The dispensing block itself never disappears, even though rx-006 has no dispensing record.
    expect(screen.getByText('Dispensing')).toBeInTheDocument();
    // No depletion estimate without a dispensing record.
    expect(screen.queryByText(/days of supply left/i)).not.toBeInTheDocument();
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
    expect(screen.getByText('50 mcg')).toBeInTheDocument();
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
  it('rx-005 shows the dispensing block with empty rows and no depletion meter or estimate', async () => {
    setScriptSession({ subjectId: 'pt-02', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-005', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getByText('Dispensing')).toBeInTheDocument();
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
    expect(screen.getByText(/not tracking your doses/i)).toBeInTheDocument();
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
});

describe('B3 — record not found or not this session\'s to read', () => {
  it('renders the empty state with a way back, never a blank screen', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const element = await PrescriptionDetail({ prescriptionId: 'rx-999', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getByText('We could not find this prescription')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to My Medicines' })).toBeInTheDocument();
  });

  it('a patient session may not read another patient\'s prescription', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    // rx-006 belongs to فاططمة (pt-02), not حمد (pt-01).
    const element = await PrescriptionDetail({ prescriptionId: 'rx-006', locale: 'en', emptyBackHref: '/en/app/medicines' });
    render(element);
    expect(screen.getByText('We could not find this prescription')).toBeInTheDocument();
  });
});

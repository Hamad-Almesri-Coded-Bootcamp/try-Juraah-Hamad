/**
 * AlertDetail — C2's own content (features/safety/AlertDetail.tsx): the three-part safety shape
 * (UX Principles §8) for a pending danger finding, with no OK/dismiss/resolve control anywhere on
 * the screen; the reviewed state's decision/note/who; citation honesty — an unverified/`[TO BE
 * SUPPLIED]` citation renders the explicit catalogue line, a real one renders verbatim, never
 * invented; and every involved prescription as a read-only, linked `PrescriptionCard`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AlertDetail } from '@/features/safety/AlertDetail';
import { TO_BE_SUPPLIED } from '@/lib/config';
import type { InteractionAlert, Prescription } from '@/types/contracts';

afterEach(cleanup);

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const rxWarfarin: Prescription = {
  id: 'rx-001',
  patientId: 'pt-01',
  source: { facilityName: 'Farwaniya Hospital', sector: 'public' },
  drug: { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 },
  dosePerAdministration: 1,
  frequencyPerDay: 1,
  durationDays: 90,
  dosingPattern: 'daily',
  startDate: '2026-09-01',
  doseTimes: ['18:00'],
  needsReview: false,
  status: 'active',
};

const rxIbuprofen: Prescription = {
  id: 'rx-002',
  patientId: 'pt-01',
  source: { facilityName: 'Elite Medical Clinic', sector: 'private' },
  drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 },
  dosePerAdministration: 1,
  frequencyPerDay: 3,
  durationDays: 7,
  dosingPattern: 'daily',
  startDate: '2026-09-19',
  doseTimes: ['08:00', '14:00', '20:00'],
  needsReview: false,
  status: 'active',
};

const pendingDanger: InteractionAlert = {
  id: 'ia-001',
  patientId: 'pt-01',
  involvedPrescriptionIds: ['rx-001', 'rx-002'],
  severity: 'danger',
  description: 'Taking warfarin with ibuprofen raises the risk of bleeding.',
  sourceCitation: TO_BE_SUPPLIED,
  createdAt: '2026-09-19T11:04:00+03:00',
  reviewStatus: 'pending_medical_review',
};

const reviewedWarning: InteractionAlert = {
  id: 'ia-002',
  patientId: 'pt-03',
  involvedPrescriptionIds: ['rx-001'],
  severity: 'warning',
  description: 'Calcium may reduce how much levothyroxine the body absorbs.',
  sourceCitation: '',
  createdAt: '2026-09-05T09:00:00+03:00',
  reviewStatus: 'reviewed',
  reviewerDecision: 'confirmed',
  reviewerNote: 'Take on an empty stomach, four hours apart from calcium.',
  reviewedAt: '2026-09-08T12:40:00+03:00',
  reviewedBy: 'acc-10',
};

const autoCleared: InteractionAlert = {
  id: 'ia-003',
  patientId: 'pt-02',
  involvedPrescriptionIds: ['rx-001'],
  severity: 'info',
  description: 'Screened against the rest of the medication list — nothing found.',
  sourceCitation: 'Test Drug DB — example screening record, no interaction (unit-test fixture only)',
  createdAt: '2026-09-14T09:00:00+03:00',
  reviewStatus: 'auto_cleared',
};

const NO_ACTION_WORDS = /\b(ok|done|dismiss|understood|acknowledge|resolve|confirm|clear|mark)\b/i;

describe('AlertDetail — pending_medical_review, danger (ia-001)', () => {
  it('shows the three-part safety shape: the risk, what to do now, and who is checking', () => {
    render(
      <AlertDetail
        alert={pendingDanger}
        prescriptions={[rxWarfarin, rxIbuprofen]}
        locale="en"
        prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`}
      />,
    );
    expect(screen.getByText(pendingDanger.description)).toBeInTheDocument(); // 1. the risk
    expect(screen.getByText('What to do right now')).toBeInTheDocument(); // 2. what to do
    expect(screen.getByText(/do not stop or change any medication yourself/i)).toBeInTheDocument();
    expect(screen.getByText(/medical reviewer is still checking this/i)).toBeInTheDocument(); // 3. who
  });

  it('never reads as final, and offers no OK / dismiss / acknowledge / resolve control of any kind', () => {
    render(
      <AlertDetail
        alert={pendingDanger}
        prescriptions={[rxWarfarin, rxIbuprofen]}
        locale="en"
        prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`}
      />,
    );
    for (const button of screen.queryAllByRole('button')) {
      expect(button).not.toHaveAccessibleName(NO_ACTION_WORDS);
    }
    for (const link of screen.queryAllByRole('link')) {
      expect(link).not.toHaveAccessibleName(NO_ACTION_WORDS);
    }
    expect(screen.getByText(/no .*button here, on purpose/i)).toBeInTheDocument();
    expect(screen.queryByText('The reviewer’s decision', { exact: false })).not.toBeInTheDocument();
  });

  it('every involved prescription renders as a read-only, tappable card (PrescriptionCard has no href — CR-032)', () => {
    render(
      <AlertDetail
        alert={pendingDanger}
        prescriptions={[rxWarfarin, rxIbuprofen]}
        locale="en"
        prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`}
      />,
    );
    expect(screen.getByRole('button', { name: /Warfarin/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Ibuprofen/ })).toBeInTheDocument();
  });
});

describe('AlertDetail — citation honesty', () => {
  it('an empty/[TO BE SUPPLIED] citation renders the explicit unverified line, never the raw marker', () => {
    render(
      <AlertDetail alert={pendingDanger} prescriptions={[rxWarfarin, rxIbuprofen]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />,
    );
    expect(screen.getByText(/no verified medical source is available/i)).toBeInTheDocument();
    expect(screen.queryByText(TO_BE_SUPPLIED)).not.toBeInTheDocument();
  });

  it('a blank string citation is treated the same as the marker', () => {
    render(<AlertDetail alert={reviewedWarning} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(/no verified medical source is available/i)).toBeInTheDocument();
  });

  it('a real citation renders verbatim', () => {
    render(<AlertDetail alert={autoCleared} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(autoCleared.sourceCitation)).toBeInTheDocument();
    expect(screen.queryByText(/no verified medical source is available/i)).not.toBeInTheDocument();
  });
});

describe('AlertDetail — reviewed (ia-002-shaped)', () => {
  it('shows the decision, the reviewer note, and who — never the raw account id', () => {
    render(<AlertDetail alert={reviewedWarning} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText('Risk confirmed')).toBeInTheDocument();
    expect(screen.getByText(reviewedWarning.reviewerNote!)).toBeInTheDocument();
    expect(screen.getByText('A medical reviewer')).toBeInTheDocument();
    expect(screen.queryByText('acc-10')).not.toBeInTheDocument();
  });

  it('never reads as final for a cleared decision either — the wording says which', () => {
    render(<AlertDetail alert={{ ...reviewedWarning, reviewerDecision: 'cleared' }} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText('Risk cleared')).toBeInTheDocument();
  });
});

describe('AlertDetail — auto_cleared (ia-003-shaped)', () => {
  it('says what auto-clearing means, with no reviewer decision block and no "what to do now" heading', () => {
    render(<AlertDetail alert={autoCleared} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(/screened automatically\. no interaction found/i)).toBeInTheDocument();
    expect(screen.queryByText('What to do right now')).not.toBeInTheDocument();
    expect(screen.queryByText('The reviewer’s decision')).not.toBeInTheDocument();
  });
});

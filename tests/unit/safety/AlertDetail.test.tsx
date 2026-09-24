/**
 * AlertDetail — C2's own content (features/safety/AlertDetail.tsx, Daylight CR-071): the band, the
 * bridge of the involved prescriptions, then the three-part safety shape (UX Principles §8) as
 * numbered steps for a pending danger finding, with no OK/dismiss/resolve control anywhere on the
 * screen; the reviewed state's decision/note/who; citation honesty — an unverified/`[TO BE
 * SUPPLIED]` citation renders the explicit catalogue line, a real one renders verbatim, never
 * invented; and every involved prescription as a read-only card linking to B3. Wording is asserted
 * through the copy catalogue, so a copy pass does not break the invariants these tests protect.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { AlertDetail } from '@/features/safety/AlertDetail';
import { TO_BE_SUPPLIED } from '@/lib/config';
import { copy } from '@/i18n';
import { localizeText } from '@/i18n/localize';
import type { InteractionAlert, Prescription } from '@/types/contracts';

afterEach(cleanup);

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const rxWarfarin: Prescription = {
  id: 'rx-001',
  patientId: 'pt-01',
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' },
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
  source: { facilityName: 'عيادة النخبة الطبية', sector: 'private' },
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
const en = (entry: { en: string }) => entry.en;
const WHAT_TO_DO = en(copy.safety.c2WhatToDoPendingBody);
const STILL_CHECKING = en(copy.vocabulary.pending_medical_review);

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
    expect(screen.getByText(WHAT_TO_DO)).toBeInTheDocument(); // 2. what to do
    expect(screen.getByText(STILL_CHECKING)).toBeInTheDocument(); // 3. who
  });

  it('keeps UX §8’s ORDER — risk, then what to do, then who is checking (audit M11) — each said once, as numbered steps', () => {
    const { container } = render(
      <AlertDetail
        alert={pendingDanger}
        prescriptions={[rxWarfarin, rxIbuprofen]}
        locale="en"
        prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`}
      />,
    );
    const risk = screen.getByText(pendingDanger.description);
    const whatToDo = screen.getByText(WHAT_TO_DO);
    const stillChecking = screen.getByText(STILL_CHECKING);
    const follows = (a: Element, b: Element) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
    expect(follows(risk, whatToDo)).toBe(true);
    expect(follows(whatToDo, stillChecking)).toBe(true);
    // Each part is its own numbered step, in that order, under its approved heading.
    const steps = [...container.querySelectorAll('[data-testid="alert-steps"] > li')];
    expect(steps.map((li) => li.getAttribute('data-step'))).toEqual(['risk', 'what-to-do', 'who']);
    expect(steps[1]).toHaveTextContent(en(copy.safety.c2WhatToDoHeading));
    // Nothing repeated: the "not final yet" sentence and the what-to-do body appear exactly once.
    expect(screen.getAllByText(STILL_CHECKING)).toHaveLength(1);
    expect(screen.getAllByText(WHAT_TO_DO)).toHaveLength(1);
  });

  it('Arabic prescription tiles use Arabic-Indic digits, the Arabic unit word and Arabic names only (audit M7, CR-071)', () => {
    const { container } = render(
      <AlertDetail alert={pendingDanger} prescriptions={[rxWarfarin, rxIbuprofen]} locale="ar" prescriptionHrefBuilder={(rx) => `/ar/app/medicines/${rx.id}`} />,
    );
    const tiles = [...container.querySelectorAll('[data-testid="alert-bridge"] .wsf-card')];
    expect(tiles).toHaveLength(2);
    expect(tiles[0]).toHaveTextContent('٥ ملغم');
    expect(tiles[1]).toHaveTextContent('٤٠٠ ملغم');
    for (const tile of tiles) expect(tile.textContent).not.toMatch(/[0-9A-Za-z]/);
    // The band's title is the two drugs in Arabic, never the stored Latin names.
    expect(container.querySelector('[data-testid="alert-band"] h2')?.textContent).not.toMatch(/[A-Za-z]/);
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
    // No designer note explaining the absence (CR-071), and no decision block while pending.
    expect(screen.queryByText(/only the medical reviewer can close/i)).not.toBeInTheDocument();
    expect(screen.queryByText(en(copy.safety.c2ReviewHeading))).not.toBeInTheDocument();
  });

  it('every involved prescription renders as a read-only card linking to its B3 detail', () => {
    render(
      <AlertDetail
        alert={pendingDanger}
        prescriptions={[rxWarfarin, rxIbuprofen]}
        locale="en"
        prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`}
      />,
    );
    expect(screen.getByRole('link', { name: /Marevan/ })).toHaveAttribute('href', '/en/app/medicines/rx-001');
    expect(screen.getByRole('link', { name: /Brufen/ })).toHaveAttribute('href', '/en/app/medicines/rx-002');
  });

  it('without an href builder (the caregiver’s read-only reuse) the cards are not links', () => {
    render(<AlertDetail alert={pendingDanger} prescriptions={[rxWarfarin, rxIbuprofen]} locale="en" />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
    expect(screen.getByText('Marevan 5 mg')).toBeInTheDocument();
  });
});

describe('AlertDetail — citation honesty', () => {
  it('an empty/[TO BE SUPPLIED] citation renders the explicit unverified line, never the raw marker', () => {
    render(
      <AlertDetail alert={pendingDanger} prescriptions={[rxWarfarin, rxIbuprofen]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />,
    );
    expect(screen.getByText(en(copy.safety.c2SourceUnverified))).toBeInTheDocument();
    expect(screen.queryByText(TO_BE_SUPPLIED)).not.toBeInTheDocument();
  });

  it('a blank string citation is treated the same as the marker', () => {
    render(<AlertDetail alert={reviewedWarning} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(en(copy.safety.c2SourceUnverified))).toBeInTheDocument();
  });

  it('a real citation renders verbatim', () => {
    render(<AlertDetail alert={autoCleared} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(autoCleared.sourceCitation)).toBeInTheDocument();
    expect(screen.queryByText(en(copy.safety.c2SourceUnverified))).not.toBeInTheDocument();
  });
});

describe('AlertDetail — reviewed (ia-002-shaped)', () => {
  it('shows the decision, the reviewer note, and who — never the raw account id', () => {
    render(<AlertDetail alert={reviewedWarning} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(en(copy.safety.c2DecisionConfirmed))).toBeInTheDocument();
    expect(screen.getByText(localizeText(reviewedWarning.reviewerNote!, 'en'))).toBeInTheDocument();
    expect(screen.getByText(en(copy.safety.c2ReviewerValue))).toBeInTheDocument();
    expect(screen.queryByText('acc-10')).not.toBeInTheDocument();
  });

  it('never reads as final for a cleared decision either — the wording says which', () => {
    render(<AlertDetail alert={{ ...reviewedWarning, reviewerDecision: 'cleared' }} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(en(copy.safety.c2DecisionCleared))).toBeInTheDocument();
  });
});

describe('AlertDetail — auto_cleared (ia-003-shaped)', () => {
  it('says what auto-clearing means, with no reviewer decision block and no "what to do now" heading', () => {
    render(<AlertDetail alert={autoCleared} prescriptions={[rxWarfarin]} locale="en" prescriptionHrefBuilder={(rx) => `/en/app/medicines/${rx.id}`} />);
    expect(screen.getByText(en(copy.vocabulary.auto_cleared))).toBeInTheDocument();
    expect(screen.queryByText(en(copy.safety.c2WhatToDoHeading))).not.toBeInTheDocument();
    expect(screen.queryByText(en(copy.safety.c2ReviewHeading))).not.toBeInTheDocument();
  });
});

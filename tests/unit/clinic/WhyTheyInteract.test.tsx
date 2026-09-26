/**
 * CR-113 — the "Why they interact" section: draft, reviewed and no-summary states in en and ar, the
 * source text marked English and left-to-right, no danger colour, and ReviewerDecision's fallback to
 * today's Source card when the data layer found no why-data.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/data', () => ({ submitReviewDecision: vi.fn() }));

import { WhyTheyInteract } from '@/features/clinic/WhyTheyInteract';
import { ReviewerDecision } from '@/features/clinic/ReviewerDecision';
import { copy } from '@/i18n';
import type { InteractionAlert, Prescription } from '@/types/contracts';
import type { AlertReviewView, AlertWhy } from '@/types/views';

afterEach(cleanup);

const why: AlertWhy = {
  level: 'Major',
  drugs: ['ibuprofen', 'warfarin'],
  labels: ['Ibuprofen', 'Warfarin'],
  summary: { en: 'Ibuprofen raises the bleeding risk of warfarin.', ar: 'يرفع الإيبوبروفين خطر النزيف مع الوارفارين.' },
  mechanism: 'Mechanism words from the source.',
  management: 'Management words from the source.',
  url: 'https://ddinter.scbdd.com/ddinter/interact/957806/',
  citation: 'DDInter 2.0 citation.',
};
const pending = { id: 'ia-001', patientId: 'pt-01', involvedPrescriptionIds: ['rx-001', 'rx-002'], severity: 'danger', description: 'Finding.', sourceCitation: '[TO BE SUPPLIED]', createdAt: '2026-09-26T08:00:00+03:00', reviewStatus: 'pending_medical_review' } as unknown as InteractionAlert;
const reviewed = { ...pending, reviewStatus: 'reviewed', reviewedAt: '2026-09-26T10:00:00+03:00' } as unknown as InteractionAlert;

describe('WhyTheyInteract', () => {
  it('draft (en): the draft tag, the level, the summary, the note, and the source one tap away', () => {
    const { container } = render(<WhyTheyInteract why={why} alert={pending} locale="en" headingId="w" />);
    expect(screen.getByRole('heading', { name: copy.clinic.whyHeading.en })).toBeInTheDocument();
    expect(screen.getByText(copy.clinic.whyDraftLabel.en)).toBeInTheDocument();
    expect(screen.getByText('DDInter level: Major')).toBeInTheDocument();
    expect(screen.getByText(why.summary!.en)).toBeInTheDocument();
    expect(screen.getByText(copy.clinic.whyAiNote.en)).toBeInTheDocument();
    const details = container.querySelector('details')!;
    expect(details.open).toBe(false);
    const mechanism = within(details).getByText(why.mechanism);
    expect(mechanism).toHaveAttribute('lang', 'en');
    expect(mechanism).toHaveAttribute('dir', 'ltr');
    const link = screen.getByRole('link', { name: new RegExp(copy.clinic.whyOpenRecord.en) });
    expect(link).toHaveAttribute('href', why.url);
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    expect(container.innerHTML).not.toMatch(/danger/);
  });

  it('draft (ar): Arabic words around the English source text', () => {
    render(<WhyTheyInteract why={why} alert={pending} locale="ar" headingId="w" />);
    expect(screen.getByRole('heading', { name: copy.clinic.whyHeading.ar })).toBeInTheDocument();
    expect(screen.getByText(copy.clinic.whyDraftLabel.ar)).toBeInTheDocument();
    expect(screen.getByText('مستوى DDInter: شديد')).toBeInTheDocument();
    expect(screen.getByText(why.summary!.ar)).toBeInTheDocument();
    expect(screen.getByText(why.management)).toHaveAttribute('dir', 'ltr');
  });

  it('reviewed: the checked tag replaces the draft tag, and the note goes', () => {
    render(<WhyTheyInteract why={why} alert={reviewed} locale="en" headingId="w" />);
    expect(screen.getByText(/Checked by the reviewing doctor · /)).toBeInTheDocument();
    expect(screen.queryByText(copy.clinic.whyDraftLabel.en)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.clinic.whyAiNote.en)).not.toBeInTheDocument();
    // the summary is still marked as AI-written after the decision
    expect(screen.getByText(copy.clinic.whyAiSummaryTag.en)).toBeInTheDocument();
  });

  it('shows the source’s licence and the record with display names', () => {
    render(<WhyTheyInteract why={why} alert={pending} locale="en" headingId="w" />);
    expect(screen.getByText(copy.clinic.whyLicence.en)).toBeInTheDocument();
    expect(screen.getByText('Ibuprofen × Warfarin')).toBeInTheDocument();
  });

  it('no summary: says so, no draft tag, and the source text starts open', () => {
    const { container } = render(<WhyTheyInteract why={{ ...why, summary: null }} alert={pending} locale="en" headingId="w" />);
    expect(screen.getByText(copy.clinic.whyNoSummary.en)).toBeInTheDocument();
    expect(screen.queryByText(copy.clinic.whyDraftLabel.en)).not.toBeInTheDocument();
    expect(screen.queryByText(copy.clinic.whyAiNote.en)).not.toBeInTheDocument();
    expect(container.querySelector('details')!.open).toBe(true);
  });
});

describe('ReviewerDecision', () => {
  const rx = (id: string, genericName: string, sector: 'public' | 'private') =>
    ({ id, patientId: 'pt-01', drug: { genericName, brandName: null, strengthMg: 5 }, source: { facilityName: 'Facility', sector }, doseTimes: ['08:00'], dosingPattern: 'daily' }) as unknown as Prescription;
  const base: AlertReviewView = {
    alert: pending,
    involvedPrescriptions: [rx('rx-001', 'Warfarin', 'public'), rx('rx-002', 'Ibuprofen', 'private')],
    patientContext: { activePrescriptions: [], recentDoses: [], trackingOn: false },
  };

  it('shows "Why they interact" instead of the Source card when why-data exists', () => {
    render(<ReviewerDecision view={{ ...base, why }} locale="en" backHref="/en/clinic/review" />);
    expect(screen.getByRole('heading', { name: copy.clinic.whyHeading.en })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: copy.clinic.g2sSourceHeading.en })).not.toBeInTheDocument();
  });

  it('keeps today\'s Source card when there is no why-data', () => {
    render(<ReviewerDecision view={{ ...base, why: null }} locale="en" backHref="/en/clinic/review" />);
    expect(screen.getByRole('heading', { name: copy.clinic.g2sSourceHeading.en })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: copy.clinic.whyHeading.en })).not.toBeInTheDocument();
  });
});

/**
 * CR-115 — G2s on screen: the finding is marked as raised by the AI, the decision asks whether the
 * doctor agrees with it, and the justification is required. Pressing a decision with the field blank
 * (or only spaces) shows the error next to the field, opens no Sheet and calls nothing; with a
 * justification, the Sheet repeats it and the commit sends it trimmed. This is the runtime proof
 * beside the data layer's own refusal (tests/unit/data/clinician-profile.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const submitReviewDecision = vi.fn(async () => undefined);
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/data', () => ({ submitReviewDecision: (...args: unknown[]) => submitReviewDecision(...(args as [])) }));

import { ReviewerDecision } from '@/features/clinic/ReviewerDecision';
import { copy } from '@/i18n';
import type { InteractionAlert, Prescription } from '@/types/contracts';
import type { AlertReviewView } from '@/types/views';

afterEach(cleanup);
beforeEach(() => submitReviewDecision.mockClear());

const rx = (id: string, genericName: string, sector: 'public' | 'private') =>
  ({ id, patientId: 'pt-01', drug: { genericName, brandName: null, strengthMg: 5 }, source: { facilityName: 'Facility', sector }, doseTimes: ['08:00'], dosingPattern: 'daily' }) as unknown as Prescription;
const alert = {
  id: 'ia-001', patientId: 'pt-01', involvedPrescriptionIds: ['rx-001', 'rx-002'], severity: 'danger', description: 'Finding.',
  sourceCitation: '[TO BE SUPPLIED]', createdAt: '2026-09-26T08:00:00+03:00', reviewStatus: 'pending_medical_review',
} as unknown as InteractionAlert;
const view: AlertReviewView = {
  alert,
  involvedPrescriptions: [rx('rx-001', 'Warfarin', 'public'), rx('rx-002', 'Ibuprofen', 'private')],
  patientContext: { activePrescriptions: [], recentDoses: [], trackingOn: false },
  why: null,
};

const field = (locale: 'en' | 'ar') => screen.getByLabelText(new RegExp(copy.clinic.g2sNoteLabel[locale]));

describe('G2s — the AI marker (CR-115)', () => {
  for (const locale of ['en', 'ar'] as const) {
    it(`says the AI raised the finding and asks whether the doctor agrees — ${locale}`, () => {
      render(<ReviewerDecision view={view} locale={locale} backHref={`/${locale}/clinic/review`} />);
      expect(screen.getByText(copy.clinic.aiRaisedTag[locale])).toBeInTheDocument();
      expect(screen.getByText(copy.clinic.g2sAiFindingNote[locale])).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: copy.clinic.g2sDecisionHeading[locale] })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: copy.clinic.g2sConfirmButton[locale] })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: copy.clinic.g2sClearButton[locale] })).toBeInTheDocument();
    });
  }
});

describe('G2s — the justification is required (CR-115)', () => {
  it('the field is marked required and says the patient sees it', () => {
    render(<ReviewerDecision view={view} locale="en" backHref="/en/clinic/review" />);
    expect(screen.getByText(copy.vocabulary.required.en)).toBeInTheDocument();
    expect(screen.getByText(copy.clinic.g2sNoteHelper.en)).toBeInTheDocument();
  });

  for (const decision of ['g2sConfirmButton', 'g2sClearButton'] as const) {
    it(`${decision}: blank → the error beside the field, no Sheet, no write`, () => {
      render(<ReviewerDecision view={view} locale="en" backHref="/en/clinic/review" />);
      fireEvent.click(screen.getByRole('button', { name: copy.clinic[decision].en }));
      expect(screen.getByRole('alert')).toHaveTextContent(copy.clinic.g2sNoteRequiredError.en);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Spaces only is still blank.
      fireEvent.change(field('en'), { target: { value: '   ' } });
      fireEvent.click(screen.getByRole('button', { name: copy.clinic[decision].en }));
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(submitReviewDecision).not.toHaveBeenCalled();
    });
  }

  it('typing clears the error and keeps what was typed', () => {
    render(<ReviewerDecision view={view} locale="en" backHref="/en/clinic/review" />);
    fireEvent.click(screen.getByRole('button', { name: copy.clinic.g2sConfirmButton.en }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    fireEvent.change(field('en'), { target: { value: 'Bleeding risk is real' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(field('en')).toHaveValue('Bleeding risk is real');
  });

  it('with a justification: the Sheet repeats it, and the commit sends it trimmed', async () => {
    render(<ReviewerDecision view={view} locale="en" backHref="/en/clinic/review" />);
    fireEvent.change(field('en'), { target: { value: '  Stop ibuprofen; use paracetamol.  ' } });
    fireEvent.click(screen.getByRole('button', { name: copy.clinic.g2sClearButton.en }));
    const sheet = screen.getByRole('dialog');
    expect(within(sheet).getByText(copy.clinic.g2sSheetJustificationLabel.en)).toBeInTheDocument();
    expect(within(sheet).getByText('Stop ibuprofen; use paracetamol.')).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(within(sheet).getByRole('button', { name: copy.clinic.g2sSheetConfirmLabel.en }));
    });
    expect(submitReviewDecision).toHaveBeenCalledTimes(1);
    expect(submitReviewDecision).toHaveBeenCalledWith('ia-001', 'cleared', 'Stop ibuprofen; use paracetamol.');
  });
});

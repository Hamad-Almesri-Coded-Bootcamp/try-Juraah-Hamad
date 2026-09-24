/**
 * B4 — features/prescription/AddPrescriptionFlow.tsx, against the real `submitPrescriptionImage` /
 * `savePrescriptionDraft` mock (never re-implemented here): the outcome is chosen deterministically
 * by the chosen file's byte size (0 → unreadable, 1–99 → needs_review, 100+ → confident —
 * lib/data/index.ts's own doc comment), which is exactly how the brief's own acceptance test reaches
 * every state without a fixture switch of this bundle's own invention.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AddPrescriptionFlow } from '@/features/prescription/AddPrescriptionFlow';
import { getPrescriptions } from '@/lib/data';
import { copy, t } from '@/i18n';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

afterEach(() => {
  cleanup();
  setScriptSession(null);
  pushMock.mockClear();
});

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'pt-01', role: 'patient' });
});

function fileOfSize(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'prescription.jpg', { type: 'image/jpeg' });
}

function choosePhoto(container: HTMLElement, file: File) {
  const [input] = Array.from(container.querySelectorAll('input[type="file"]'));
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
}

describe('B4 — capture', () => {
  it('says what the photo is for, with the prescriber note, and offers the two real file inputs', () => {
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    expect(screen.getByRole('heading', { name: t(copy.prescription.b4CaptureTitle, 'en') })).toBeInTheDocument();
    expect(screen.getByText(t(copy.prescription.b4PrescriberFieldsNote, 'en'))).toBeInTheDocument();
    expect(container.querySelectorAll('input[type="file"]')).toHaveLength(2);
    // Never a text input for a prescriber-owned field (B4's invariant).
    expect(container.querySelectorAll('input[type="text"], textarea')).toHaveLength(0);
  });
});

describe('B4 — confident outcome (100+ bytes)', () => {
  it('shows the review-and-confirm DetailRows, and confirming saves a real record and navigates back', async () => {
    const before = await getPrescriptions('pt-01');
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(150));

    await screen.findByText(t(copy.prescription.b4ReviewHeading, 'en'));
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();
    // The prescriber note belongs to the capture step only (copy pass), never to the review.
    expect(screen.queryByText(t(copy.prescription.b4PrescriberFieldsNote, 'en'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm and save' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app/medicines'));

    const after = await getPrescriptions('pt-01');
    expect(after.length).toBe(before.length + 1);
  });
});

describe('B4 — needs_review outcome (1–99 bytes)', () => {
  it('marks the uncertain fields and still offers the same confirm path', async () => {
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(50));

    await screen.findByText(t(copy.prescription.b4NeedsReviewNoticeTitle, 'en'));
    expect(screen.getAllByText('Unclear in the photo').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirm and save' })).toBeInTheDocument();
    // The draft's generic name is the seed's "(unreadable)": shown in words, never the literal.
    expect(container.textContent).not.toContain('(unreadable)');
    expect(container.textContent).not.toMatch(/[—–]/);
  });

  it('says "unclear" ONCE per field — the same phrase seen and heard, never "Unclear" plus "Unclear in the photo" (audit m7)', async () => {
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(50));
    await screen.findByText(t(copy.prescription.b4NeedsReviewNoticeTitle, 'en'));

    const marks = [...container.querySelectorAll('.wsf-dr__value--empty')];
    const unclear = marks.filter((m) => /Unclear/.test(m.textContent ?? ''));
    expect(unclear.length).toBe(4); // strength, times per day, dose times, start date — the mock's uncertainFields
    for (const mark of unclear) {
      const seen = mark.querySelector('[aria-hidden="true"]')?.textContent;
      const heard = mark.querySelector('.wsf-sr')?.textContent;
      expect(seen).toBe('Unclear in the photo');
      expect(heard).toBe(seen);
    }
    expect(screen.queryAllByText('Unclear', { exact: true })).toHaveLength(0);
  });
});

describe('B4 — unreadable outcome (0 bytes): no fabricated record', () => {
  it('shows the explicit could-not-read state with retry and a way back, and creates nothing', async () => {
    const before = await getPrescriptions('pt-01');
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(0));

    await screen.findByText(t(copy.prescription.b4UnreadableTitle, 'en'));
    expect(screen.getByRole('button', { name: 'Try another photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to My Medicines' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm and save' })).not.toBeInTheDocument();

    const after = await getPrescriptions('pt-01');
    expect(after.length).toBe(before.length); // the medicines list is unchanged
  });

  it('retry returns to the capture state so a new photo can be chosen', async () => {
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(0));
    await screen.findByText(t(copy.prescription.b4UnreadableTitle, 'en'));

    fireEvent.click(screen.getByRole('button', { name: 'Try another photo' }));
    expect(screen.getByText('Prescription photo')).toBeInTheDocument();
  });
});

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

describe('B4 — confident outcome (100+ bytes)', () => {
  it('shows the review-and-confirm DetailRows, and confirming saves a real record and navigates back', async () => {
    const before = await getPrescriptions('pt-01');
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(150));

    await screen.findByText('Review before saving');
    expect(screen.getByText('Ibuprofen')).toBeInTheDocument();

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

    await screen.findByText('Some fields need confirmation');
    expect(screen.getAllByText('Unclear').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Confirm and save' })).toBeInTheDocument();
  });
});

describe('B4 — unreadable outcome (0 bytes): no fabricated record', () => {
  it('shows the explicit could-not-read state with retry and a way back, and creates nothing', async () => {
    const before = await getPrescriptions('pt-01');
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(0));

    await screen.findByText('We could not read this photo');
    expect(screen.getByRole('button', { name: 'Try another photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to My Medicines' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm and save' })).not.toBeInTheDocument();

    const after = await getPrescriptions('pt-01');
    expect(after.length).toBe(before.length); // the medicines list is unchanged
  });

  it('retry returns to the capture state so a new photo can be chosen', async () => {
    const { container } = render(<AddPrescriptionFlow locale="en" patientId="pt-01" backHref="/en/app/medicines" />);
    choosePhoto(container, fileOfSize(0));
    await screen.findByText('We could not read this photo');

    fireEvent.click(screen.getByRole('button', { name: 'Try another photo' }));
    expect(screen.getByText('Prescription photo')).toBeInTheDocument();
  });
});

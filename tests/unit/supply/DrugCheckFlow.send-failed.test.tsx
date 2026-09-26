/**
 * C3 — A2: the awaited `checkDrugPhoto` call itself throws (a dropped connection, a timeout), never
 * an outcome the agent returned. Before A2 this left the screen stuck on "analysing" forever (no
 * try/catch around the call inside startTransition). `checkDrugPhoto` is mocked directly, the same
 * approach the sibling cannot_verify and not_a_medicine specs already take for a case the real store
 * cannot produce.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrugCheckFlow } from '@/features/supply/DrugCheckFlow';
import { copy, t } from '@/i18n';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

vi.mock('@/lib/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data')>()),
  checkDrugPhoto: vi.fn(async () => {
    throw new Error('ECONNRESET');
  }),
}));

afterEach(() => cleanup());

function fileOfSize(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'packet.jpg', { type: 'image/jpeg' });
}

function choosePhoto(container: HTMLElement, file: File) {
  const [input] = Array.from(container.querySelectorAll('input[type="file"]'));
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
}

describe('C3 — a forced rejection never leaves the screen stuck on "analysing"', () => {
  it('leaves analysing for the could_not_identify error state, with the generic send-failed line', async () => {
    const { container } = render(<DrugCheckFlow locale="en" patientId="pt-01" backHref="/en/app/safety" />);
    choosePhoto(container, fileOfSize(500));

    // Proves it does not hang: a stuck "analysing" would time this query out rather than resolve it.
    await screen.findByText(t(copy.supply.c3CouldNotIdentifyTitle, 'en'));
    // The real analysing title this screen renders (ReadingCard, phase === 'analysing'), not the
    // generic PhotoInput vocabulary word: that string never appears here, so asserting its absence
    // could never fail and proves nothing.
    expect(screen.queryByText(t(copy.supply.c3AnalysingTitle, 'en'))).not.toBeInTheDocument();
    // The generic transport-failure line, never the outcome-based could-not-identify body.
    expect(screen.getByText(t(copy.vocabulary.photoSendFailed, 'en'))).toBeInTheDocument();
    expect(screen.queryByText(t(copy.supply.c3CouldNotIdentifyBody, 'en'))).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: t(copy.supply.c3CouldNotIdentifyRetryLabel, 'en') }));
    await screen.findByText(t(copy.supply.c3PhotoLabel, 'en'));
  });
});

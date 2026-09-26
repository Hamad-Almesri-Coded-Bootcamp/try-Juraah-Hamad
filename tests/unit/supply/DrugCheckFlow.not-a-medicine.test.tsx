/**
 * C3 — not_a_medicine. The mock backend has no honest path that produces this outcome (a live
 * Travel Check answer only, appOutcome "not_a_medicine"), so `checkDrugPhoto` is mocked directly
 * here, unlike the sibling spec (DrugCheckFlow.test.tsx) which drives the real store — the same
 * approach the sibling cannot_verify spec (DrugCheckFlow.cannot-verify.test.tsx) already takes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DrugCheckFlow } from '@/features/supply/DrugCheckFlow';
import { getAlert } from '@/lib/data';
import { copy, t } from '@/i18n';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

vi.mock('@/lib/data', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/data')>()),
  checkDrugPhoto: vi.fn(async () => ({ kind: 'not_a_medicine' })),
  getAlert: vi.fn(),
}));

afterEach(() => {
  cleanup();
  pushMock.mockClear();
  vi.mocked(getAlert).mockClear();
});

function fileOfSize(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'packet.jpg', { type: 'image/jpeg' });
}

function choosePhoto(container: HTMLElement, file: File) {
  const [input] = Array.from(container.querySelectorAll('input[type="file"]'));
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
}

describe.each([['ar'], ['en']] as const)('C3 — not_a_medicine (%s)', (locale) => {
  it('shows the explicit honest state with retry and a way back, never a guessed drug, and creates nothing', async () => {
    const { container } = render(<DrugCheckFlow locale={locale} patientId="pt-01" backHref={`/${locale}/app/safety`} />);
    choosePhoto(container, fileOfSize(500));

    await screen.findByText(t(copy.supply.c3NotAMedicineTitle, locale));
    expect(screen.getByText(t(copy.supply.c3NotAMedicineBody, locale))).toBeInTheDocument();

    expect(screen.queryByText(t(copy.supply.c3NoInteractionTitle, locale))).not.toBeInTheDocument();
    expect(screen.queryByText(t(copy.supply.c3CannotVerifyTitle, locale))).not.toBeInTheDocument();
    expect(screen.queryByText(t(copy.supply.c3CouldNotIdentifyTitle, locale))).not.toBeInTheDocument();
    expect(getAlert).not.toHaveBeenCalled();
    expect(container.querySelector('a[href*="/app/safety/ia-"]')).toBeNull();

    // The retry action returns to capture, reusing could_not_identify's own retry label (same
    // meaning: take another photo).
    fireEvent.click(screen.getByRole('button', { name: t(copy.supply.c3CouldNotIdentifyRetryLabel, locale) }));
    await screen.findByText(t(copy.supply.c3PhotoLabel, locale));
  });
});

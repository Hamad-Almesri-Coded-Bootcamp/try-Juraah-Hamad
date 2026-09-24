/**
 * C3 — cannot_verify (CR-078). The mock backend has no honest path that produces this outcome (a
 * live Travel Check answer only), so `checkDrugPhoto` is mocked directly here, unlike the sibling
 * spec (DrugCheckFlow.test.tsx) which drives the real store.
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
  checkDrugPhoto: vi.fn(async () => ({ kind: 'cannot_verify' })),
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

describe.each([['ar'], ['en']] as const)('C3 — cannot_verify (%s)', (locale) => {
  it('shows the warning-tone content state, never a guessed drug or an alert link, and creates nothing', async () => {
    const { container } = render(<DrugCheckFlow locale={locale} patientId="pt-01" backHref={`/${locale}/app/safety`} />);
    choosePhoto(container, fileOfSize(500));

    await screen.findByText(t(copy.supply.c3CannotVerifyTitle, locale));
    expect(screen.getByText(t(copy.supply.c3CannotVerifyBody, locale))).toBeInTheDocument();

    expect(screen.queryByText(t(copy.supply.c3NoInteractionTitle, locale))).not.toBeInTheDocument();
    expect(screen.queryByText(t(copy.supply.c3CouldNotIdentifyTitle, locale))).not.toBeInTheDocument();
    expect(getAlert).not.toHaveBeenCalled();
    expect(container.querySelector('a[href*="/app/safety/ia-"]')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: t(copy.supply.c3CheckAnotherButton, locale) }));
    // c3CaptureTitle and c3TakePhoto share the same English string, so — like the sibling
    // spec's own retry assertion — this checks the capture screen's unique photo label instead.
    await screen.findByText(t(copy.supply.c3PhotoLabel, locale));
  });
});

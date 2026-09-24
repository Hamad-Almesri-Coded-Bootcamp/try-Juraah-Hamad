/**
 * C3 — the one outcome only the Travel Check agent produces (CR-066): an interaction found with no
 * alert raised (a warning-level finding, or a drug already taken). The screen must still show the
 * finding — never a result with no verdict at all — and must not offer a link to details that do
 * not exist. checkDrugPhoto is stubbed here; the real reader is tested in agent-webhooks/core.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/lib/data', () => ({
  checkDrugPhoto: vi.fn(async () => ({ kind: 'identified', drugName: 'Clarithromycin', verdict: 'interaction_found' })),
}));

import { DrugCheckFlow } from '@/features/supply/DrugCheckFlow';
import { copy, t } from '@/i18n';

afterEach(() => cleanup());

describe('C3 — interaction_found without an alert id', () => {
  it('shows the finding with what to do, and no "open details" button', async () => {
    const { container } = render(<DrugCheckFlow locale="en" patientId="pt-03" backHref="/en/app/safety" />);
    const [input] = Array.from(container.querySelectorAll('input[type="file"]'));
    fireEvent.change(input as HTMLInputElement, { target: { files: [new File([new Uint8Array(200)], 'box.jpg', { type: 'image/jpeg' })] } });

    await screen.findByText(t(copy.supply.c3InteractionNoDetailsDescription, 'en'));
    expect(screen.getAllByText('Clarithromycin').length).toBeGreaterThan(0);
    expect(screen.queryByText('No interaction found')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Open interaction details' })).not.toBeInTheDocument();
  });
});

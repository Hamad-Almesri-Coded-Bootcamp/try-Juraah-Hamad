/**
 * C3 — features/supply/DrugCheckFlow.tsx, against the real `checkDrugPhoto` mock (never
 * re-implemented here): a 0-byte photo produces `could_not_identify` (lib/data/index.ts's own doc
 * comment — "identified by the image's byte size"); a nonzero photo for حمد (pt-01) resolves to his
 * first active prescription, Warfarin, which carries the seed's one `danger` alert (ia-001) —
 * `interaction_found`; the same for سارة (pt-03) resolves to Levothyroxine, which carries no
 * `danger` alert — `no_interaction`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DrugCheckFlow } from '@/features/supply/DrugCheckFlow';
import { getActivity, getAlerts } from '@/lib/data';
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
});

function fileOfSize(bytes: number): File {
  return new File([new Uint8Array(bytes)], 'packet.jpg', { type: 'image/jpeg' });
}

function choosePhoto(container: HTMLElement, file: File) {
  const [input] = Array.from(container.querySelectorAll('input[type="file"]'));
  fireEvent.change(input as HTMLInputElement, { target: { files: [file] } });
}

describe('C3 — interaction_found (حمد, pt-01)', () => {
  it('names the drug, hands off to C2’s own route, and never renders a fabricated citation or decision', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(<DrugCheckFlow locale="en" patientId="pt-01" backHref="/en/app/safety" />);
    choosePhoto(container, fileOfSize(200));

    await screen.findAllByText('Warfarin'); // the DetailRow value and the InteractionAlert's own title
    expect(screen.getByText(/serious interaction/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open interaction details' }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/en/app/safety/ia-001'));
  });

  it('says who is checking it: the linked alert’s own review state, in the fixed vocabulary (UX §8)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(<DrugCheckFlow locale="ar" patientId="pt-01" backHref="/ar/app/safety" />);
    choosePhoto(container, fileOfSize(200));
    // ia-001 is pending_medical_review in the seed.
    expect(await screen.findByText(t(copy.vocabulary.pending_medical_review, 'ar'))).toBeInTheDocument();
    expect(container.querySelector('.wsf-alert--danger .wsf-alert__review--pending')).not.toBeNull();
    // One locale, one script: the drug name is in Arabic too (CR-071).
    expect(container.textContent).not.toMatch(/[A-Za-z]/);
  });
});

describe('C3 — no_interaction (سارة, pt-03)', () => {
  it('reassures with no InteractionAlert at all', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const { container } = render(<DrugCheckFlow locale="en" patientId="pt-03" backHref="/en/app/safety" />);
    choosePhoto(container, fileOfSize(200));

    await screen.findByText('No interaction found');
    expect(screen.queryByText(/serious interaction/i)).not.toBeInTheDocument();
  });
});

describe('C3 — could_not_identify (0-byte photo): no record, no alert', () => {
  it('shows the explicit honest state with retry and a way back, and creates nothing', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const alertsBefore = await getAlerts('pt-01');
    const activityBefore = await getActivity('pt-01');

    const { container } = render(<DrugCheckFlow locale="en" patientId="pt-01" backHref="/en/app/safety" />);
    choosePhoto(container, fileOfSize(0));

    await screen.findByText(t(copy.supply.c3CouldNotIdentifyTitle, 'en'));
    expect(screen.getByRole('button', { name: 'Try another photo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to Safety' })).toBeInTheDocument();

    expect(await getAlerts('pt-01')).toHaveLength(alertsBefore.length);
    expect(await getActivity('pt-01')).toHaveLength(activityBefore.length);
  });

  it('retry returns to the capture state so a new photo can be chosen', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const { container } = render(<DrugCheckFlow locale="en" patientId="pt-01" backHref="/en/app/safety" />);
    choosePhoto(container, fileOfSize(0));
    await screen.findByText(t(copy.supply.c3CouldNotIdentifyTitle, 'en'));

    fireEvent.click(screen.getByRole('button', { name: 'Try another photo' }));
    expect(screen.getByText('Photo of the packet')).toBeInTheDocument();
  });
});

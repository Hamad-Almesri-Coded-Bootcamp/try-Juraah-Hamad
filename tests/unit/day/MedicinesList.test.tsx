/**
 * MedicinesList — B2's card list (features/day/MedicinesList.tsx): the danger alert leads and stays
 * alone at `danger`, a card never shows a status pill unless `tracked` is true (rule 3 / G10, checked
 * again here even though the caller is expected to already gate it), and the past group carries no
 * refill action.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MedicinesList } from '@/features/day/MedicinesList';
import type { InteractionAlert, Prescription } from '@/types/contracts';

afterEach(cleanup);

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const rxWarfarin: Prescription = {
  id: 'rx-001',
  patientId: 'pt-01',
  source: { facilityName: 'Farwaniya Hospital', sector: 'public' },
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

const rxAtorvastatin: Prescription = {
  id: 'rx-004',
  patientId: 'pt-01',
  source: { facilityName: 'Farwaniya Hospital', sector: 'public' },
  drug: { genericName: 'Atorvastatin', brandName: 'Lipitor', strengthMg: 20 },
  dosePerAdministration: 1,
  frequencyPerDay: 1,
  durationDays: 90,
  dosingPattern: 'daily',
  startDate: '2026-04-02',
  doseTimes: ['21:00'],
  needsReview: false,
  status: 'discontinued',
  discontinuedAt: '2026-06-28',
  discontinuedReason: 'Doctor stopped it for muscle pain',
};

const dangerAlert: InteractionAlert = {
  id: 'ia-001',
  patientId: 'pt-01',
  involvedPrescriptionIds: ['rx-001'],
  severity: 'danger',
  description: 'Warfarin with Ibuprofen raises bleeding risk significantly.',
  sourceCitation: '[TO BE SUPPLIED]',
  createdAt: '2026-09-19T11:04:00+03:00',
  reviewStatus: 'pending_medical_review',
};

const infoAlert: InteractionAlert = {
  id: 'ia-003',
  patientId: 'pt-02',
  involvedPrescriptionIds: [],
  severity: 'info',
  description: 'Screened, nothing found.',
  sourceCitation: '',
  createdAt: '2026-09-01T00:00:00+03:00',
  reviewStatus: 'auto_cleared',
};

describe('MedicinesList — the alert', () => {
  it('renders only the most severe alert, never two at once', () => {
    const { container } = render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[dangerAlert, infoAlert]}
        nextDoseByPrescriptionId={{}}
        tracked={false}
        locale="en"
        hrefBuilder={null} alertHrefBuilder={null}
      />,
    );
    expect(container.querySelectorAll('.wsf-alert')).toHaveLength(1);
    expect(container.querySelector('.wsf-alert')).toHaveClass('wsf-alert--danger');
  });

  it('links to the rest only when there is more than one alert', () => {
    render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[dangerAlert, infoAlert]}
        nextDoseByPrescriptionId={{}}
        tracked={false}
        locale="en"
        hrefBuilder={null} alertHrefBuilder={null}
        safetyHref="/en/app/safety"
      />,
    );
    // NavigateButton renders a real <button> that calls router.push on click, not an <a>.
    expect(screen.getByRole('button', { name: 'See all safety alerts' })).toBeInTheDocument();
  });

  it('renders no "see all" control for a single alert', () => {
    render(<MedicinesList prescriptions={[rxWarfarin]} alerts={[dangerAlert]} nextDoseByPrescriptionId={{}} tracked={false} locale="en" hrefBuilder={null} alertHrefBuilder={(a) => `/en/app/safety/${a.id}`} safetyHref="/en/app/safety" />);
    expect(screen.queryByRole('button', { name: 'See all safety alerts' })).not.toBeInTheDocument();
  });
});

describe('MedicinesList — the alert is never a dead end (audit C6)', () => {
  it('with exactly ONE alert (حمد), the alert opens its own detail — C2 is "push from B2"', () => {
    pushMock.mockClear();
    const { container } = render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[dangerAlert]}
        nextDoseByPrescriptionId={{}}
        tracked={false}
        locale="en"
        hrefBuilder={null}
        alertHrefBuilder={(a) => `/en/app/safety/${a.id}`}
        safetyHref="/en/app/safety"
      />,
    );
    const open = screen.getByRole('button', { name: 'Open the alert' });
    // Inside the danger alert, and secondary (InteractionAlert.md: secondary restyles to on-fill there).
    expect(container.querySelector('.wsf-alert--danger .wsf-alert__actions')).toContainElement(open);
    expect(open).toHaveClass('wsf-btn--secondary');
    fireEvent.click(open);
    expect(pushMock).toHaveBeenCalledWith('/en/app/safety/ia-001');
  });

  it('the caregiver shell points the same action at its own read-only route', () => {
    pushMock.mockClear();
    render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[dangerAlert]}
        nextDoseByPrescriptionId={{}}
        tracked={false}
        locale="ar"
        hrefBuilder={null}
        alertHrefBuilder={(a) => `/ar/care/alerts/${a.id}`}
        readOnly
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'افتح التنبيه' }));
    expect(pushMock).toHaveBeenCalledWith('/ar/care/alerts/ia-001');
  });

  it('with more than one alert: open the lead alert (secondary) AND see all (quiet), never two secondaries', () => {
    render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[dangerAlert, infoAlert]}
        nextDoseByPrescriptionId={{}}
        tracked={false}
        locale="en"
        hrefBuilder={null}
        alertHrefBuilder={(a) => `/en/app/safety/${a.id}`}
        safetyHref="/en/app/safety"
      />,
    );
    expect(screen.getByRole('button', { name: 'Open the alert' })).toHaveClass('wsf-btn--secondary');
    expect(screen.getByRole('button', { name: 'See all safety alerts' })).toHaveClass('wsf-btn--quiet');
  });

  it('a pending danger alert carries §8 part two — what to do right now — in its review line', () => {
    render(<MedicinesList prescriptions={[rxWarfarin]} alerts={[dangerAlert]} nextDoseByPrescriptionId={{}} tracked={false} locale="en" hrefBuilder={null} alertHrefBuilder={(a) => `/en/app/safety/${a.id}`} />);
    expect(screen.getByText(/do not stop or change any medication yourself/i)).toBeInTheDocument();
    expect(screen.getByText(/a doctor or pharmacist is reviewing this/i)).toBeInTheDocument();
  });

  it('a non-danger alert keeps the built-in review sentence (no manufactured alarm, UX §8)', () => {
    render(<MedicinesList prescriptions={[rxWarfarin]} alerts={[infoAlert]} nextDoseByPrescriptionId={{}} tracked={false} locale="en" hrefBuilder={null} alertHrefBuilder={(a) => `/en/app/safety/${a.id}`} />);
    expect(screen.queryByText(/do not stop or change/i)).not.toBeInTheDocument();
    expect(screen.getByText(/screened automatically/i)).toBeInTheDocument();
  });

  it('Arabic drug line: Arabic-Indic digits and the Arabic unit word (audit M7)', () => {
    const { container } = render(<MedicinesList prescriptions={[rxWarfarin]} alerts={[dangerAlert]} nextDoseByPrescriptionId={{}} tracked={false} locale="ar" hrefBuilder={null} alertHrefBuilder={null} />);
    expect(container.querySelector('.wsf-alert__drugs')?.textContent).toBe('Warfarin ٥ ملغم — Farwaniya Hospital');
  });
});

describe('MedicinesList — rule 3 / G10 on the card', () => {
  it('shows no status pill when untracked, even with a resolved next-dose entry', () => {
    render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[]}
        nextDoseByPrescriptionId={{ 'rx-001': { status: 'taken_on_time', timeLabel: 'Today 18:00' } }}
        tracked={false}
        locale="en"
        hrefBuilder={null} alertHrefBuilder={null}
      />,
    );
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
  });

  it('shows the status pill when tracked and a next-dose entry is resolved', () => {
    render(
      <MedicinesList
        prescriptions={[rxWarfarin]}
        alerts={[]}
        nextDoseByPrescriptionId={{ 'rx-001': { status: 'taken_on_time', timeLabel: 'Today 18:00' } }}
        tracked
        locale="en"
        hrefBuilder={null} alertHrefBuilder={null}
      />,
    );
    expect(screen.getByTestId('status-pill')).toBeInTheDocument();
  });
});

describe('MedicinesList — past group', () => {
  it('shows the discontinuation reason and date, no refill action', () => {
    render(<MedicinesList prescriptions={[rxAtorvastatin]} alerts={[]} nextDoseByPrescriptionId={{}} tracked={false} locale="en" hrefBuilder={null} alertHrefBuilder={null} />);
    expect(screen.getByText(/Doctor stopped it for muscle pain/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /refill/i })).not.toBeInTheDocument();
  });
});

describe('MedicinesList — empty', () => {
  it('offers add/scan when not read-only', () => {
    render(<MedicinesList prescriptions={[]} alerts={[]} nextDoseByPrescriptionId={{}} tracked={false} locale="en" hrefBuilder={null} alertHrefBuilder={null} addHref="/en/app/medicines/add" />);
    expect(screen.getByRole('button', { name: /Add a prescription by photo/i })).toBeInTheDocument();
  });

  it('offers no action when read-only (caregiver view)', () => {
    render(<MedicinesList prescriptions={[]} alerts={[]} nextDoseByPrescriptionId={{}} tracked={false} locale="en" hrefBuilder={null} alertHrefBuilder={null} addHref="/en/app/medicines/add" readOnly />);
    expect(screen.queryByRole('button', { name: /Add a prescription by photo/i })).not.toBeInTheDocument();
  });
});

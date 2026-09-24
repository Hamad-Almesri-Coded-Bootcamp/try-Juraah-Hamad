/**
 * ActivityFeed — E2's own list (features/ambient/ActivityFeed.tsx): reverse-chronological rows,
 * masked names read verbatim from the event's own `message` (never re-masked or invented here —
 * this bundle's brief note on `getActivity` vs `getAuditLog`), read-only, empty state.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActivityFeed } from '@/features/ambient/ActivityFeed';
import { copy } from '@/i18n';
import { localizeText } from '@/i18n/localize';
import type { AuditEvent } from '@/types/contracts';

afterEach(cleanup);

const caregiverInvited: AuditEvent = {
  id: 'ae-001',
  scope: 'patient',
  patientId: 'pt-01',
  actor: { role: 'patient', id: 'pt-01' },
  type: 'caregiver_invited',
  message: 'دعوة مقدّم رعاية إلى عبدالله م*** ع*** المطيري',
  createdAt: '2026-09-02T10:00:00+03:00',
  relatedId: 'cg-01',
};

const prescriptionAdded: AuditEvent = {
  id: 'ae-002',
  scope: 'patient',
  patientId: 'pt-01',
  actor: { role: 'patient', id: 'pt-01' },
  type: 'prescription_added',
  message: 'أُضيفت وصفة Warfarin',
  createdAt: '2026-09-01T09:00:00+03:00',
  relatedId: 'rx-001',
};

describe('ActivityFeed', () => {
  it('renders one row per event, grouped by day under a day heading, and the read-only footnote', () => {
    const { container } = render(<ActivityFeed events={[caregiverInvited, prescriptionAdded]} locale="en" />);
    expect(container.querySelectorAll('.jr-activity-row')).toHaveLength(2);
    const days = screen.getAllByTestId('activity-day');
    expect(days).toHaveLength(2); // 2 September, 1 September
    expect(days[0]).toHaveTextContent('September 2');
    expect(screen.getByText(copy.ambient.e2ReadOnlyNote.en)).toBeInTheDocument();
  });

  it('each event is its message in the reader’s language plus its time; the actor is named only when it is not the patient', () => {
    const byAgent: AuditEvent = { ...prescriptionAdded, id: 'ae-003', actor: { role: 'agent' }, type: 'alert_raised', message: 'تنبيه تعارض خطير: Warfarin و Ibuprofen', relatedId: 'ia-001', createdAt: '2026-09-01T11:04:00+03:00' };
    render(<ActivityFeed events={[byAgent, prescriptionAdded]} locale="ar" />);
    const agentRow = screen.getByText(localizeText(byAgent.message, 'ar')).closest('.jr-activity-row')!;
    expect(agentRow).toHaveTextContent(copy.vocabulary.actor_agent.ar);
    expect(agentRow).toHaveTextContent('١١:٠٤');
    const ownRow = screen.getByText(localizeText(prescriptionAdded.message, 'ar')).closest('.jr-activity-row')!;
    expect(ownRow).not.toHaveTextContent(copy.vocabulary.actor_patient.ar);
    // One language per locale (CR-071): the stored Latin drug names are localised on screen.
    expect(document.body.textContent).not.toMatch(/[A-Za-z]/);
  });

  it('the masked name comes from the event’s own message text, never a component of its own — and no 12-digit Civil ID ever appears', () => {
    render(<ActivityFeed events={[caregiverInvited]} locale="ar" />);
    expect(screen.getByText(/عبدالله م\*\*\* ع\*\*\* المطيري/)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/\d{12}/);
  });

  it('a prescription event links to its B3 detail — the row’s only affordance', () => {
    render(<ActivityFeed events={[prescriptionAdded]} locale="en" />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/en/app/medicines/rx-001');
  });

  it('none → a reassuring EmptyState, never an error tone', () => {
    render(<ActivityFeed events={[]} locale="en" />);
    expect(screen.getByText(copy.ambient.e2EmptyTitle.en)).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

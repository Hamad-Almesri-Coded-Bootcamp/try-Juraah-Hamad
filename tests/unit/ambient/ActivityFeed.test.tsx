/**
 * ActivityFeed — E2's own list (features/ambient/ActivityFeed.tsx): reverse-chronological rows,
 * masked names read verbatim from the event's own `message` (never re-masked or invented here —
 * this bundle's brief note on `getActivity` vs `getAuditLog`), read-only, empty state.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ActivityFeed } from '@/features/ambient/ActivityFeed';
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
  it('renders one row per event and the read-only footnote', () => {
    render(<ActivityFeed events={[caregiverInvited, prescriptionAdded]} locale="en" />);
    expect(screen.getAllByRole('link').length + screen.getAllByText(/Prescription added|Caregiver invited/).length).toBeGreaterThan(0);
    expect(screen.getByText('This log is view-only.')).toBeInTheDocument();
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
    expect(screen.getByText('Nothing recorded yet')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

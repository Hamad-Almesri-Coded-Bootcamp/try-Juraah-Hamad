/**
 * SafetyList — C1's own list (features/safety/SafetyList.tsx): most severe first, most recent
 * within severity, `reviewed`/`auto_cleared` history included, none → a reassuring EmptyState.
 * No real seed patient carries more than one alert at once (each of `ia-001`/`ia-002`/`ia-003`
 * belongs to a different patient — docs/Seed Dataset.md), so the ordering guarantee is exercised
 * here with constructed props, exactly as `tests/unit/day/MedicinesList.test.tsx` exercises B2's
 * "multiple alerts" state (docs/DECISIONS.md CR-014's precedent for an unreachable-from-one-patient
 * combination).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SafetyList, sortAlerts } from '@/features/safety/SafetyList';
import type { InteractionAlert } from '@/types/contracts';

afterEach(cleanup);

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

const infoAlert: InteractionAlert = {
  id: 'ia-003',
  patientId: 'pt-02',
  involvedPrescriptionIds: ['rx-005'],
  severity: 'info',
  description: 'Screened, nothing found.',
  sourceCitation: '[TO BE SUPPLIED]',
  createdAt: '2026-09-14T09:00:00+03:00',
  reviewStatus: 'auto_cleared',
};

const warningAlert: InteractionAlert = {
  id: 'ia-002',
  patientId: 'pt-03',
  involvedPrescriptionIds: ['rx-008', 'rx-009'],
  severity: 'warning',
  description: 'Calcium may reduce how much levothyroxine the body absorbs.',
  sourceCitation: '[TO BE SUPPLIED]',
  createdAt: '2026-09-05T09:00:00+03:00',
  reviewStatus: 'reviewed',
  reviewerDecision: 'confirmed',
  reviewerNote: 'Take on an empty stomach.',
  reviewedAt: '2026-09-08T12:40:00+03:00',
  reviewedBy: 'acc-10',
};

const dangerAlert: InteractionAlert = {
  id: 'ia-001',
  patientId: 'pt-01',
  involvedPrescriptionIds: ['rx-001', 'rx-002'],
  severity: 'danger',
  description: 'Warfarin with Ibuprofen raises bleeding risk.',
  sourceCitation: '[TO BE SUPPLIED]',
  createdAt: '2026-09-19T11:04:00+03:00',
  reviewStatus: 'pending_medical_review',
};

describe('sortAlerts — most severe first, most recent within severity', () => {
  it('reorders a danger/warning/info mix given in the wrong order', () => {
    const sorted = sortAlerts([infoAlert, warningAlert, dangerAlert]);
    expect(sorted.map((a) => a.id)).toEqual(['ia-001', 'ia-002', 'ia-003']);
  });

  it('breaks a same-severity tie by most recent createdAt first', () => {
    const olderDanger: InteractionAlert = { ...dangerAlert, id: 'ia-old', createdAt: '2026-01-01T00:00:00+03:00' };
    const sorted = sortAlerts([olderDanger, dangerAlert]);
    expect(sorted.map((a) => a.id)).toEqual(['ia-001', 'ia-old']);
  });
});

describe('SafetyList — the screen', () => {
  it('renders every alert as an AlertRow, most severe first, reviewed/auto_cleared history included', () => {
    const { container } = render(
      <SafetyList
        alerts={[infoAlert, warningAlert, dangerAlert]}
        drugNamesByAlertId={{
          'ia-001': ['Warfarin', 'Ibuprofen'],
          'ia-002': ['Levothyroxine', 'Calcium carbonate'],
          'ia-003': ['Prednisolone'],
        }}
        locale="en"
        hrefBuilder={(a) => `/en/app/safety/${a.id}`}
        checkHref="/en/app/safety/check"
      />,
    );
    const rows = container.querySelectorAll('.jr-alert-row');
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveClass('jr-alert-row--danger');
    expect(rows[1]).toHaveClass('jr-alert-row--warning');
    expect(rows[2]).toHaveClass('jr-alert-row--info');
  });

  it('a row is a real link into C2, and nothing else', () => {
    render(
      <SafetyList
        alerts={[dangerAlert]}
        drugNamesByAlertId={{ 'ia-001': ['Warfarin', 'Ibuprofen'] }}
        locale="en"
        hrefBuilder={(a) => `/en/app/safety/${a.id}`}
        checkHref="/en/app/safety/check"
      />,
    );
    expect(screen.getByRole('link', { name: /Warfarin \+ Ibuprofen/ })).toHaveAttribute('href', '/en/app/safety/ia-001');
  });

  it('always offers the C3 entry, even with alerts present', () => {
    render(
      <SafetyList
        alerts={[dangerAlert]}
        drugNamesByAlertId={{ 'ia-001': ['Warfarin', 'Ibuprofen'] }}
        locale="en"
        hrefBuilder={(a) => `/en/app/safety/${a.id}`}
        checkHref="/en/app/safety/check"
      />,
    );
    expect(screen.getByRole('button', { name: 'Check a drug by photo' })).toBeInTheDocument();
  });

  it('none → a reassuring EmptyState, and still the C3 entry', () => {
    render(<SafetyList alerts={[]} drugNamesByAlertId={{}} locale="en" hrefBuilder={(a) => `/en/app/safety/${a.id}`} checkHref="/en/app/safety/check" />);
    expect(screen.getByText('No safety alerts right now')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check a drug by photo' })).toBeInTheDocument();
  });
});

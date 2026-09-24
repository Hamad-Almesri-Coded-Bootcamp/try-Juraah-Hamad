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
import { SafetyList, needsAttention, sortAlerts } from '@/features/safety/SafetyList';
import { copy } from '@/i18n';
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

describe('needsAttention — what still needs the reader', () => {
  it('a pending finding needs attention at any severity; a confirmed danger still stands; the rest is past', () => {
    expect(needsAttention(dangerAlert)).toBe(true);
    expect(needsAttention({ ...warningAlert, reviewStatus: 'pending_medical_review' })).toBe(true);
    expect(needsAttention({ ...dangerAlert, reviewStatus: 'reviewed', reviewerDecision: 'confirmed' })).toBe(true);
    expect(needsAttention({ ...dangerAlert, reviewStatus: 'reviewed', reviewerDecision: 'cleared' })).toBe(false);
    expect(needsAttention(warningAlert)).toBe(false); // reviewed
    expect(needsAttention(infoAlert)).toBe(false); // auto_cleared
  });
});

const CHECK_LABEL = copy.safety.c1CheckDrugAction.en;

describe('SafetyList — the screen', () => {
  it('renders every alert as an AlertRow, most severe first, reviewed/auto_cleared history included under past results', () => {
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
    expect(screen.getByTestId('safety-attention').querySelectorAll('.jr-alert-row')).toHaveLength(1);
    expect(screen.getByTestId('safety-past').querySelectorAll('.jr-alert-row')).toHaveLength(2);
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
    expect(screen.getByRole('link', { name: /Warfarin × Ibuprofen/ })).toHaveAttribute('href', '/en/app/safety/ia-001');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
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
    expect(screen.getByRole('link', { name: new RegExp(CHECK_LABEL) })).toHaveAttribute('href', '/en/app/safety/check');
  });

  it('none → a reassuring EmptyState, and still the C3 entry', () => {
    render(<SafetyList alerts={[]} drugNamesByAlertId={{}} locale="en" hrefBuilder={(a) => `/en/app/safety/${a.id}`} checkHref="/en/app/safety/check" />);
    expect(screen.getByText(copy.safety.c1EmptyTitle.en)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: new RegExp(CHECK_LABEL) })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('the summary card counts from the data: active medicines checked, findings needing attention (Arabic digits and agreeing words in Arabic)', () => {
    render(
      <SafetyList
        alerts={[dangerAlert, warningAlert]}
        drugNamesByAlertId={{ 'ia-001': ['Warfarin', 'Ibuprofen'], 'ia-002': ['Levothyroxine', 'Calcium carbonate'] }}
        locale="ar"
        hrefBuilder={(a) => `/ar/app/safety/${a.id}`}
        checkHref="/ar/app/safety/check"
        summary={{ checkedCount: 3, mixedSectors: true }}
      />,
    );
    expect(screen.getByTestId('safety-checked-count')).toHaveTextContent(`٣${copy.safety.c1CheckedCountFew.ar}`);
    expect(screen.getByTestId('safety-attention-count')).toHaveTextContent(`١${copy.safety.c1AttentionCountOne.ar}`);
    expect(screen.getByTestId('safety-summary')).toHaveTextContent(copy.safety.c1SummaryMixedSectors.ar);
    expect(screen.getByTestId('safety-summary').textContent).not.toMatch(/[0-9A-Za-z]/);
  });

  it('with nothing pending the summary says so calmly, and the caregiver’s reuse (no checkHref) offers no photo check', () => {
    render(
      <SafetyList
        alerts={[infoAlert]}
        drugNamesByAlertId={{ 'ia-003': ['Prednisolone'] }}
        locale="en"
        hrefBuilder={(a) => `/en/care/alerts/${a.id}`}
        summary={{ checkedCount: 1, mixedSectors: false }}
      />,
    );
    expect(screen.getByTestId('safety-attention-count')).toHaveTextContent(copy.safety.c1AttentionNone.en);
    expect(screen.queryByTestId('safety-attention')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: new RegExp(CHECK_LABEL) })).not.toBeInTheDocument();
  });
});

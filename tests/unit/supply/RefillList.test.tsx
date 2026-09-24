/**
 * D1 — features/supply/RefillList.tsx, against the real `getRefillOverview` / `requestRefill` /
 * `getRefillRequests` mock (never re-implemented here). حمد (pt-01)'s own three active prescriptions
 * are all dispensed (rx-001, rx-002, rx-003 — docs/Seed Dataset.md), so a no-estimate line is
 * exercised through سارة (pt-03) instead: rx-008 dispensed, rx-009 not (CR-014's own build rule —
 * render each state with the seed person who is actually in it).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { RefillList } from '@/features/supply/RefillList';
import { getPrescriptions, getRefillOverview, getRefillRequests, requestRefill } from '@/lib/data';
import { copy, t } from '@/i18n';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const refreshMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: refreshMock }) }));

afterEach(() => {
  cleanup();
  setScriptSession(null);
  refreshMock.mockClear();
});

beforeEach(() => {
  reset();
});

describe('D1 — حمد (pt-01): the seeded pending request renders as requested from first load', () => {
  it('rx-003 shows no request button and an InlineNotice naming the public pharmacy; rx-001/rx-002 still offer one', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const overview = await getRefillOverview('pt-01');
    const requests = await getRefillRequests('pt-01');

    render(<RefillList overview={overview} requests={requests} patientId="pt-01" locale="en" />);

    // Two lines (rx-001, rx-002) still offer the button; rx-003's pending request suppresses it.
    expect(screen.getAllByRole('button', { name: 'Request a refill' })).toHaveLength(2);
    const notice = screen.getByText('Refill requested').closest('[role="status"]') as HTMLElement;
    expect(within(notice).getByText(/public pharmacy/)).toBeInTheDocument();
  });

  it('lists both seeded RefillRequest rows (rf-01 requested, rf-02 approved) in "My requests"', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const overview = await getRefillOverview('pt-01');
    const requests = await getRefillRequests('pt-01');
    render(<RefillList overview={overview} requests={requests} patientId="pt-01" locale="en" />);

    const list = screen.getByTestId('refill-requests');
    expect(within(list).getByText('Pending approval')).toBeInTheDocument();
    expect(within(list).getByText('Approved')).toBeInTheDocument();
  });
});

describe('D1 — سارة (pt-03): no dispensing on rx-009 means no depletion estimate', () => {
  it('shows exactly one progressbar (rx-008), never a fabricated estimate for rx-009', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const overview = await getRefillOverview('pt-03');
    const requests = await getRefillRequests('pt-03');
    render(<RefillList overview={overview} requests={requests} patientId="pt-03" locale="en" />);

    expect(screen.getAllByRole('progressbar')).toHaveLength(1);
  });

  it('the confirm Sheet names the destination for a public rx (rx-008) and a private rx (rx-009)', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const overview = await getRefillOverview('pt-03');
    const requests = await getRefillRequests('pt-03');
    render(<RefillList overview={overview} requests={requests} patientId="pt-03" locale="en" />);

    const buttons = screen.getAllByRole('button', { name: 'Request a refill' });
    expect(buttons).toHaveLength(2);

    fireEvent.click(buttons[0]!); // rx-008, public
    expect(await screen.findByText('the public pharmacy')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    fireEvent.click(buttons[1]!); // rx-009, private
    expect(await screen.findByText('the private pharmacy')).toBeInTheDocument();
  });

  it('confirming sends a real requestRefill and closes the sheet', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const overview = await getRefillOverview('pt-03');
    const requestsBefore = await getRefillRequests('pt-03');
    render(<RefillList overview={overview} requests={requestsBefore} patientId="pt-03" locale="en" />);

    fireEvent.click(screen.getAllByRole('button', { name: 'Request a refill' })[0]!);
    await screen.findByText('Confirm the refill request');
    fireEvent.click(screen.getByRole('button', { name: 'Send the request' }));

    await waitFor(() => expect(refreshMock).toHaveBeenCalled());
    expect(screen.queryByText('Confirm the refill request')).not.toBeInTheDocument();

    const requestsAfter = await getRefillRequests('pt-03');
    expect(requestsAfter.length).toBe(requestsBefore.length + 1);
  });
});

describe('D1 — no active prescriptions: the empty state, never a blank screen', () => {
  it('shows the empty state and no request button', () => {
    render(<RefillList overview={[]} requests={[]} patientId="pt-04" locale="en" />);
    expect(screen.getByText('No active prescriptions to refill')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Request a refill' })).not.toBeInTheDocument();
  });
});

describe('D1 — a supply write is never a dose-status write (G1)', () => {
  it('requestRefill returns a RefillRequest with a refill status word, never a dose-status word', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const request = await requestRefill('pt-01', 'rx-002');
    expect(['requested', 'approved', 'denied']).toContain(request.status);
    expect(['upcoming', 'taken_on_time', 'taken_late', 'missed']).not.toContain(request.status);
  });
});

describe('D1 — no primary per row (UX Principles §2, audit M19)', () => {
  it('each prescription’s "Request a refill" is secondary; the list has no primary until the confirm sheet opens', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const overview = await getRefillOverview('pt-01');
    const requests = await getRefillRequests('pt-01');
    render(<RefillList overview={overview} requests={requests} patientId="pt-01" locale="en" />);

    const rowButtons = screen.getAllByRole('button', { name: 'Request a refill' });
    for (const b of rowButtons) expect(b).toHaveClass('wsf-btn--secondary');
    expect(document.body.querySelectorAll('.wsf-btn--primary')).toHaveLength(0);

    fireEvent.click(rowButtons[0]!);
    // The Sheet portals into document.body — its "Send the request" stays the one primary.
    const send = await screen.findByRole('button', { name: 'Send the request' });
    expect(send).toHaveClass('wsf-btn--primary');
    expect(document.body.querySelectorAll('.wsf-btn--primary')).toHaveLength(1);
  });

  it('lang="ar": the days read in Arabic-Indic digits with the unit that agrees with them, no Latin anywhere (audit M7, CR-071)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const [overview, requests, prescriptions] = await Promise.all([getRefillOverview('pt-01'), getRefillRequests('pt-01'), getPrescriptions('pt-01')]);
    const { container } = render(<RefillList overview={overview} requests={requests} prescriptions={prescriptions} patientId="pt-01" locale="ar" />);
    const [warfarin, brufen] = [...container.querySelectorAll('[data-testid="refill-line"]')].map((n) => n.textContent ?? '');
    expect(warfarin).toContain('٧٠' + t(copy.supply.supplyDaysUnitMany, 'ar')); // 70 days: يومًا
    expect(brufen).toContain('٥' + t(copy.supply.supplyDaysUnitFew, 'ar')); // 5 days: أيام
    expect(brufen).toContain(t(copy.vocabulary.lowSupply, 'ar'));
    expect(container.textContent).not.toMatch(/[0-9A-Za-z]/);
  });

  it('names the facility and the sector on one line of the card (the prescription’s own source)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const [overview, requests, prescriptions] = await Promise.all([getRefillOverview('pt-01'), getRefillRequests('pt-01'), getPrescriptions('pt-01')]);
    render(<RefillList overview={overview} requests={requests} prescriptions={prescriptions} patientId="pt-01" locale="en" />);
    expect(screen.getByText('Al-Nukhba Medical Clinic · Private sector')).toBeInTheDocument(); // rx-002
    expect(screen.getAllByText('Farwaniya Hospital · Public sector')).toHaveLength(2); // rx-001, rx-003
  });
});

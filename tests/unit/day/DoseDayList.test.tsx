/**
 * DoseDayList — B1's day list (features/day/DoseDayList.tsx). The brief's own required assertion:
 * `{tracked:false, status:'upcoming'}` renders no pill through this composition, not just through
 * DoseRow directly — the pill's absence must key off `tracked`, never the status word (CLAUDE.md
 * rule 3 / G10; in the seed every untracked dose also reads "upcoming").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { DoseDayList } from '@/features/day/DoseDayList';
import type { DoseWithPrescription } from '@/types/views';

afterEach(cleanup);

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: pushMock }) }));

function makeDose(overrides: Partial<DoseWithPrescription> = {}): DoseWithPrescription {
  return {
    id: 'rx-002-20260921-0800',
    prescriptionId: 'rx-002',
    scheduledAt: '2026-09-21T08:00:00+03:00',
    status: 'upcoming',
    tracked: false,
    source: 'seed',
    drug: { genericName: 'Ibuprofen', brandName: 'Brufen', strengthMg: 400 },
    dosePerAdministration: 1,
    ...overrides,
  };
}

describe('DoseDayList', () => {
  it('renders no status pill for {tracked:false, status:"upcoming"} — the pill keys off tracked, never the word', () => {
    render(<DoseDayList doses={[makeDose()]} tracked={false} locale="en" hrefBuilder={null} />);
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
  });

  it('still renders no pill for {tracked:false, status:"missed"} — defensive, the data never has it', () => {
    render(<DoseDayList doses={[makeDose({ status: 'missed' })]} tracked={false} locale="en" hrefBuilder={null} />);
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
  });

  it('renders the pill when the same dose is tracked', () => {
    render(<DoseDayList doses={[makeDose({ tracked: true })]} tracked locale="en" hrefBuilder={null} />);
    expect(screen.getByTestId('status-pill')).toBeInTheDocument();
  });

  it('the dose-list root carries no interactive control at all when there is no hrefBuilder', () => {
    render(<DoseDayList doses={[makeDose(), makeDose({ id: 'x', scheduledAt: '2026-09-21T20:00:00+03:00' })]} tracked={false} locale="en" hrefBuilder={null} />);
    const list = screen.getByTestId('dose-list');
    expect(list.querySelectorAll('button, input, [role="button"], a').length).toBe(0);
  });

  it('renders exactly one link per row, and nothing else interactive, when hrefBuilder is given', () => {
    render(<DoseDayList doses={[makeDose()]} tracked={false} locale="en" hrefBuilder={(d) => `/en/app/medicines/${d.prescriptionId}`} />);
    const list = screen.getByTestId('dose-list');
    expect(list.querySelectorAll('button, input, [role="button"]').length).toBe(0);
    const links = list.querySelectorAll('a');
    expect(links.length).toBe(1);
    expect(links[0]).toHaveAttribute('href', '/en/app/medicines/rx-002');
  });

  it('the "turn tracking on" Button lives outside the dose-list root', () => {
    render(<DoseDayList doses={[makeDose()]} tracked={false} locale="en" hrefBuilder={null} settingsHref="/en/app/more/settings" />);
    const list = screen.getByTestId('dose-list');
    expect(list.querySelectorAll('button, a').length).toBe(0);
    // NavigateButton renders a real <button> that calls router.push on click, not an <a>.
    expect(screen.getByRole('button', { name: 'Turn it on' })).toBeInTheDocument();
  });

  it('omits the "turn tracking on" Button when readOnly, but keeps the explanation', () => {
    render(<DoseDayList doses={[makeDose()]} tracked={false} locale="en" hrefBuilder={null} readOnly settingsHref="/en/app/more/settings" />);
    expect(screen.queryByRole('button', { name: 'Turn it on' })).not.toBeInTheDocument();
    expect(screen.getByText(/not tracking your doses/i)).toBeInTheDocument();
  });

  it('renders an EmptyState instead of the tracking-off notice when the day has no doses', () => {
    render(<DoseDayList doses={[]} tracked={false} locale="en" hrefBuilder={null} settingsHref="/en/app/more/settings" />);
    expect(screen.getByTestId('dose-list')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn it on' })).not.toBeInTheDocument();
    expect(screen.getByText('No doses scheduled for this day')).toBeInTheDocument();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DoseRow } from './DoseRow';

afterEach(cleanup);

const drug = { genericName: 'Metformin', brandName: 'Glucophage' };

describe('DoseRow — the product\'s core safety claim (G1/G10)', () => {
  it('renders a data-testid="dose-row" root', () => {
    render(<DoseRow dose={{ status: 'upcoming', tracked: true }} drug={drug} amountLabel="One tablet" lang="en" />);
    expect(screen.getByTestId('dose-row')).toBeInTheDocument();
  });

  it('renders no pill when tracked is false, even with status upcoming', () => {
    render(<DoseRow dose={{ status: 'upcoming', tracked: false }} drug={drug} amountLabel="One tablet" lang="en" />);
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
  });

  it('renders no pill when tracked is false, even with status missed (defensive — the data never has it)', () => {
    render(<DoseRow dose={{ status: 'missed', tracked: false }} drug={drug} amountLabel="One tablet" lang="en" />);
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
  });

  it('renders the pill when tracked is true and status is missed', () => {
    render(<DoseRow dose={{ status: 'missed', tracked: true }} drug={drug} amountLabel="One tablet" lang="ar" />);
    const pill = screen.getByTestId('status-pill');
    expect(pill).toBeInTheDocument();
    expect(pill.textContent).toContain('فائتة');
  });

  it('renders the pill when tracked is omitted (contract default is true)', () => {
    render(<DoseRow dose={{ status: 'upcoming' }} drug={drug} amountLabel="One tablet" lang="en" />);
    expect(screen.getByTestId('status-pill')).toBeInTheDocument();
  });

  it('offers no interactive control at all when neither href nor onOpen is set', () => {
    render(<DoseRow dose={{ status: 'upcoming', tracked: true }} drug={drug} amountLabel="One tablet" lang="en" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByTestId('dose-row').tagName).toBe('DIV');
  });

  it('offers exactly one open control when onOpen is set, and nothing else interactive', () => {
    const onOpen = vi.fn();
    render(<DoseRow dose={{ status: 'upcoming', tracked: true }} drug={drug} amountLabel="One tablet" onOpen={onOpen} lang="en" />);
    const row = screen.getByTestId('dose-row');
    expect(row.tagName).toBe('BUTTON');
    expect(row.querySelectorAll('button, input, [role="button"]').length).toBe(0);
    row.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('renders as a link when href is set', () => {
    render(<DoseRow dose={{ status: 'upcoming', tracked: true }} drug={drug} amountLabel="One tablet" href="/rx/1" lang="en" />);
    const row = screen.getByTestId('dose-row');
    expect(row.tagName).toBe('A');
    expect(row).toHaveAttribute('href', '/rx/1');
  });

  it('never carries a checkbox or any control that could record a dose status', () => {
    render(<DoseRow dose={{ status: 'upcoming', tracked: true }} drug={drug} amountLabel="One tablet" lang="en" />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

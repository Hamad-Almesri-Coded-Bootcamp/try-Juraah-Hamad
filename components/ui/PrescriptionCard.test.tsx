import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { PrescriptionCard } from './PrescriptionCard';

afterEach(cleanup);

const warfarin = {
  drug: { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 },
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' as const },
};

describe('PrescriptionCard', () => {
  it('renders the brand name with its strength, and the generic underneath', () => {
    render(<PrescriptionCard prescription={warfarin} lang="en" />);
    expect(screen.getByText(/Marevan/)).toBeInTheDocument();
    expect(screen.getByText(/5 mg/)).toBeInTheDocument();
    expect(screen.getByText('Warfarin')).toBeInTheDocument();
  });

  it('shows no status row when dose is omitted', () => {
    render(<PrescriptionCard prescription={warfarin} lang="en" />);
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
  });

  it('shows the status row when dose is given', () => {
    render(<PrescriptionCard prescription={warfarin} dose={{ status: 'upcoming' }} lang="en" />);
    expect(screen.getByTestId('status-pill')).toBeInTheDocument();
  });

  it('renders the sector chip and facility name', () => {
    render(<PrescriptionCard prescription={warfarin} lang="ar" />);
    expect(screen.getByText('مستشفى الفروانية')).toBeInTheDocument();
    expect(screen.getByText('قطاع عام')).toBeInTheDocument();
  });

  it('appends strengthMg and strengthUnit exactly as written — never converted', () => {
    const levothyroxine = {
      drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50 },
      source: { facilityName: 'مستشفى العدان', sector: 'public' as const },
    };
    render(<PrescriptionCard prescription={levothyroxine} strengthUnit="mcg" lang="en" />);
    expect(screen.getByText(/50mcg/)).toBeInTheDocument();
  });

  it('becomes a single button with a mirroring chevron when onOpen is set', () => {
    const onOpen = vi.fn();
    render(<PrescriptionCard prescription={warfarin} onOpen={onOpen} lang="en" />);
    const button = screen.getByRole('button');
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onOpen).toHaveBeenCalledOnce();
    expect(button.querySelector('svg')).toBeTruthy();
  });

  it('offers no dose-status affordance anywhere', () => {
    render(<PrescriptionCard prescription={warfarin} dose={{ status: 'missed' }} lang="en" />);
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });
});

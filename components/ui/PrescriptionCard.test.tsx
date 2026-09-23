import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { PrescriptionCard } from './PrescriptionCard';

afterEach(cleanup);

const warfarin = {
  drug: { genericName: 'Warfarin', brandName: 'Marevan', strengthMg: 5 },
  source: { facilityName: 'مستشفى الفروانية', sector: 'public' as const },
};

// Audit, found while fixing M7 (2026-09-23): the card ignored the prescription's own unit and printed
// its ' mg' default, so سارة's levothyroxine — 50 MICROgrams in the seed (rx-008) — read "50 mg" on B2
// and C2: a thousandfold error on screen. Guard U forbids converting the number; the card must also
// never swap the unit.
const eltroxin = {
  drug: { genericName: 'Levothyroxine', brandName: 'Eltroxin', strengthMg: 50, strengthUnit: 'mcg' as const },
  source: { facilityName: 'مستشفى العدان', sector: 'public' as const },
};

describe('PrescriptionCard — the unit is the prescription\'s own', () => {
  it('en: 50 mcg stays 50 mcg, never 50 mg', () => {
    render(<PrescriptionCard prescription={eltroxin} lang="en" />);
    expect(screen.getByText(/50 mcg/)).toBeInTheDocument();
    expect(screen.queryByText(/50 ?mg/)).not.toBeInTheDocument();
  });

  it('ar: Arabic-Indic digits and the Arabic unit word', () => {
    render(<PrescriptionCard prescription={eltroxin} lang="ar" />);
    expect(screen.getByText(/٥٠ ميكروغرام/)).toBeInTheDocument();
  });
});

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
    expect(screen.getByText(/50 mcg/)).toBeInTheDocument(); // the shared formatter spaces number and unit (audit M7)
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

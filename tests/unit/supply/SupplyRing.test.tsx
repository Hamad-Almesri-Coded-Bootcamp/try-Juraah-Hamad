/**
 * SupplyRing (features/supply/SupplyRing.tsx) — the supply meter D1 and B3 share (Daylight). It is
 * announced as one progressbar with the plain numbers, the days read in the reader's digits with the
 * unit that agrees with the count, and the low tone starts at DepletionMeter's own 7 days.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LOW_SUPPLY_DAYS, SupplyRing, isLowSupply, supplyCountLine } from '@/features/supply/SupplyRing';
import { copy, t } from '@/i18n';

afterEach(cleanup);

describe('SupplyRing', () => {
  it('is one progressbar carrying the plain numbers', () => {
    render(<SupplyRing remaining={70} total={90} daysRemaining={70} locale="en" />);
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '70');
    expect(bar).toHaveAttribute('aria-valuemax', '90');
    expect(bar).toHaveAccessibleName('Supply left: 70 of 90');
  });

  it('Arabic: Arabic-Indic digits and the unit that agrees with the number', () => {
    const { container, rerender } = render(<SupplyRing remaining={70} total={90} daysRemaining={70} locale="ar" />);
    expect(container.textContent).toBe('٧٠' + t(copy.supply.supplyDaysUnitMany, 'ar'));
    rerender(<SupplyRing remaining={15} total={21} daysRemaining={5} locale="ar" />);
    expect(container.textContent).toBe('٥' + t(copy.supply.supplyDaysUnitFew, 'ar'));
  });

  it('turns to the warning tone at or below 7 days, never before', () => {
    expect(LOW_SUPPLY_DAYS).toBe(7);
    expect(isLowSupply(7)).toBe(true);
    expect(isLowSupply(8)).toBe(false);
    expect(isLowSupply(null)).toBe(false);
    const { container } = render(<SupplyRing remaining={15} total={21} daysRemaining={5} locale="en" />);
    expect(container.querySelector('.jr-ring--warning')).not.toBeNull();
  });

  it('the count line reads as a sentence in both languages', () => {
    expect(supplyCountLine(70, 90, 'en')).toBe('70 of 90 left');
    expect(supplyCountLine(70, 90, 'ar')).toBe('بقي ٧٠ من ٩٠');
  });
});

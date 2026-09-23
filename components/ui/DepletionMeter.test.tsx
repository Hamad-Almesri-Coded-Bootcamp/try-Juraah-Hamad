import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DepletionMeter } from './DepletionMeter';

afterEach(cleanup);

describe('DepletionMeter', () => {
  it('renders remaining/total as a progressbar with a text alternative', () => {
    render(<DepletionMeter remaining={70} total={90} daysRemaining={70} lang="en" />);
    const meter = screen.getByRole('progressbar');
    expect(meter).toHaveAttribute('aria-valuenow', '70');
    expect(meter).toHaveAttribute('aria-valuemin', '0');
    expect(meter).toHaveAttribute('aria-valuemax', '90');
    expect(screen.getByText(/70 \/ 90/)).toBeInTheDocument();
  });

  it('reads as low at or below lowAtDays, with the low-supply word', () => {
    const { container } = render(<DepletionMeter remaining={6} total={30} daysRemaining={6} lowAtDays={7} lang="en" />);
    expect(container.querySelector('.wsf-dep--low')).toBeTruthy();
    expect(screen.getByText(/Running low/)).toBeInTheDocument();
  });

  it('does not read as low above lowAtDays', () => {
    const { container } = render(<DepletionMeter remaining={70} total={90} daysRemaining={70} lowAtDays={7} lang="en" />);
    expect(container.querySelector('.wsf-dep--low')).toBeFalsy();
    expect(screen.queryByText(/Running low/)).not.toBeInTheDocument();
  });

  it('renders no days line when daysRemaining is null', () => {
    render(<DepletionMeter remaining={20} total={60} daysRemaining={null} lang="en" />);
    expect(screen.queryByText(/days of supply left/)).not.toBeInTheDocument();
  });

  it('does no arithmetic — remaining/total are shown exactly as passed', () => {
    render(<DepletionMeter remaining={1} total={3} lang="en" />);
    expect(screen.getByText(/1 \/ 3/)).toBeInTheDocument();
  });
});

describe('DepletionMeter — Arabic digits and counted noun (audit M7)', () => {
  it('lang="ar": the count reads ٧٠ / ٩٠, and aria-valuenow stays a plain number', () => {
    const { container } = render(<DepletionMeter remaining={70} total={90} daysRemaining={70} lang="ar" />);
    expect(container.querySelector('.wsf-dep__count')?.textContent).toBe('٧٠ / ٩٠');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '70');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuemax', '90');
  });

  it('lang="ar": the caption is grammatical — ٧٠ يومًا, never "70 أيام" — with no Western digit', () => {
    const { container } = render(<DepletionMeter remaining={70} total={90} daysRemaining={70} lang="ar" />);
    const note = container.querySelector('.wsf-dep__note')?.textContent ?? '';
    expect(note).toContain('٧٠ يومًا');
    expect(note).not.toMatch(/[0-9]/);
    expect(note).not.toContain('أيام');
  });

  it('lang="ar": 5 days takes the 3–10 form (أيام) and stays low with the low-supply word', () => {
    const { container } = render(<DepletionMeter remaining={15} total={21} daysRemaining={5} lang="ar" />);
    const note = container.querySelector('.wsf-dep__note')?.textContent ?? '';
    expect(note).toContain('٥ أيام');
    expect(note).toContain('الكمية قاربت تخلص');
  });
});

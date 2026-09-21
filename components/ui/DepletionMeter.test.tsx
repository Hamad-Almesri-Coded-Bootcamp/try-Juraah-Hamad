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

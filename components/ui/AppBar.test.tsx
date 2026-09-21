import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { AppBar } from './AppBar';

afterEach(cleanup);

describe('AppBar', () => {
  it('renders the title as the screen h1', () => {
    render(<AppBar title="Today" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Today' })).toBeInTheDocument();
  });

  it('renders no back control when neither onBack nor backHref is given', () => {
    render(<AppBar title="Today" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('renders the back control as a button with the accessible name from backLabel, and fires onBack', () => {
    const onBack = vi.fn();
    render(<AppBar title="Prescription" onBack={onBack} backLabel="Back to medications" />);
    const back = screen.getByRole('button', { name: 'Back to medications' });
    back.click();
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('mirrors the back chevron and nothing else does', () => {
    render(<AppBar title="Prescription" onBack={() => {}} backLabel="Back" action={<span data-testid="action-icon" />} />);
    const back = screen.getByRole('button', { name: 'Back' });
    expect(back.querySelector('svg')).toHaveClass('wsf-mirror');
    expect(screen.getByTestId('action-icon')).not.toHaveClass('wsf-mirror');
  });

  it('renders the back control as a real link when backHref is given', () => {
    render(<AppBar title="Prescription" backHref="/en/app/medicines" backLabel="Back to medications" />);
    const back = screen.getByRole('link', { name: 'Back to medications' });
    expect(back).toHaveAttribute('href', '/en/app/medicines');
  });

  it('renders exactly one trailing action', () => {
    render(<AppBar title="Today" action={<button type="button">EN</button>} />);
    expect(screen.getByRole('button', { name: 'EN' })).toBeInTheDocument();
  });
});

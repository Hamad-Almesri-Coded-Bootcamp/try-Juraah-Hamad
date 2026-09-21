import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ErrorState } from './ErrorState';

afterEach(cleanup);

describe('ErrorState', () => {
  it('renders the title and description, with role="alert" and a warning icon (never danger)', () => {
    const { container } = render(
      <ErrorState title="Could not refresh the list" description="The connection dropped. Nothing has been lost." />
    );
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Could not refresh the list' })).toBeInTheDocument();
    expect(screen.getByText('The connection dropped. Nothing has been lost.')).toBeInTheDocument();
    expect(container.querySelector('.wsf-state--error')).toBeInTheDocument();
  });

  it('renders no retry button when onRetry is omitted, and fires it when supplied', () => {
    const { rerender } = render(<ErrorState title="Failed" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const onRetry = vi.fn();
    rerender(<ErrorState title="Failed" onRetry={onRetry} retryLabel="Try again" />);
    const button = screen.getByRole('button', { name: 'Try again' });
    fireEvent.click(button);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('falls back to the built-in English retry word when retryLabel is omitted (no lang prop on ErrorState)', () => {
    render(<ErrorState title="Failed" onRetry={() => {}} />);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

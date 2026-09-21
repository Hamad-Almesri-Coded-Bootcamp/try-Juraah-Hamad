import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { EmptyState } from './EmptyState';

afterEach(cleanup);

describe('EmptyState', () => {
  it('renders a title, defaults its icon to inbox, and needs no description or action', () => {
    render(<EmptyState title="No active prescriptions" />);
    expect(screen.getByRole('heading', { level: 2, name: 'No active prescriptions' })).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a description and a passed-through action without attaching a handler itself', () => {
    render(
      <EmptyState
        title="No active prescriptions"
        description="A prescription written at any clinic appears here on its own."
        action={
          <button type="button" className="wsf-btn wsf-btn--secondary">
            Add a prescription
          </button>
        }
      />
    );
    expect(screen.getByText('A prescription written at any clinic appears here on its own.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add a prescription' })).toBeInTheDocument();
  });

  it('accepts a custom icon name', () => {
    render(<EmptyState icon="users" title="No caregivers" />);
    expect(screen.getByRole('heading', { name: 'No caregivers' })).toBeInTheDocument();
  });
});

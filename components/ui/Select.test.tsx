import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { Select } from './Select';

afterEach(cleanup);

const OPTIONS = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'none', label: 'None' },
];

describe('Select', () => {
  it('renders a real <select> wired to its label', () => {
    render(<Select label="Channel" value="none" options={OPTIONS} onChange={() => {}} />);
    expect(screen.getByLabelText('Channel')).toBeInstanceOf(HTMLSelectElement);
  });

  it('shows the placeholder as a disabled first option only while value is empty', () => {
    const { rerender } = render(<Select label="Channel" value="" options={OPTIONS} placeholder="Choose a channel" onChange={() => {}} />);
    const placeholderOption = screen.getByRole('option', { name: 'Choose a channel' }) as HTMLOptionElement;
    expect(placeholderOption.disabled).toBe(true);
    rerender(<Select label="Channel" value="none" options={OPTIONS} placeholder="Choose a channel" onChange={() => {}} />);
    expect(screen.queryByRole('option', { name: 'Choose a channel' })).not.toBeInTheDocument();
  });

  it('switches to the error state: role="alert" and aria-invalid', () => {
    render(<Select label="Channel" value="none" options={OPTIONS} error="Pick a channel" onChange={() => {}} />);
    expect(screen.getByLabelText('Channel')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Pick a channel');
  });

  it('disables the control when disabled', () => {
    render(<Select label="Sector" value="none" options={OPTIONS} disabled onChange={() => {}} />);
    expect(screen.getByLabelText('Sector')).toBeDisabled();
  });

  it('calls onChange when a different option is chosen', () => {
    const onChange = vi.fn();
    render(<Select label="Channel" value="none" options={OPTIONS} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Channel'), { target: { value: 'telegram' } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

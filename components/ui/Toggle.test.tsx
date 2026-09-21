import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Toggle } from './Toggle';

afterEach(cleanup);

describe('Toggle', () => {
  it('is a real role="switch" control with aria-checked matching `checked`', () => {
    const { rerender } = render(<Toggle label="Daily check-in" checked={false} onChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
    rerender(<Toggle label="Daily check-in" checked onChange={() => {}} />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('shows the on/off word — colour and knob position are never the only signal', () => {
    const { rerender } = render(<Toggle label="Daily check-in" checked={false} onChange={() => {}} />);
    expect(screen.getByText('Off')).toBeInTheDocument();
    rerender(<Toggle label="Daily check-in" checked onChange={() => {}} />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('calls onChange with the flipped value on click', () => {
    const onChange = vi.fn();
    render(<Toggle label="Refill alerts" checked={false} onChange={onChange} />);
    screen.getByRole('switch').click();
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('names the switch from the visible label and describes it from the description', () => {
    render(<Toggle label="Daily check-in" description="Turn this off and check-ins stop." checked={false} onChange={() => {}} />);
    const el = screen.getByRole('switch');
    expect(el).toHaveAccessibleName('Daily check-in');
    expect(el).toHaveAccessibleDescription('Turn this off and check-ins stop.');
  });

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn();
    render(<Toggle label="Daily check-in" checked={false} onChange={onChange} disabled />);
    const el = screen.getByRole('switch');
    expect(el).toBeDisabled();
    el.click();
    expect(onChange).not.toHaveBeenCalled();
  });
});

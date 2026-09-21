import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen, fireEvent } from '@testing-library/react';
import { TextField } from './TextField';

afterEach(cleanup);

describe('TextField', () => {
  it('wires the label to the input and generates an id when none is given', () => {
    render(<TextField label="Civil ID" value="" onChange={() => {}} />);
    const input = screen.getByLabelText('Civil ID');
    expect(input.id).toBeTruthy();
  });

  it('uses a stable id when one is supplied', () => {
    render(<TextField id="civil-id" label="Civil ID" value="" onChange={() => {}} />);
    expect(screen.getByLabelText('Civil ID')).toHaveAttribute('id', 'civil-id');
  });

  it('switches to the error state: role="alert", aria-invalid, and hides helperText', () => {
    render(<TextField label="Civil ID" value="" onChange={() => {}} helperText="Twelve digits" error="This Civil ID is not in the demo record set" />);
    const input = screen.getByLabelText('Civil ID');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('This Civil ID is not in the demo record set');
    expect(screen.queryByText('Twelve digits')).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-describedby', alert.id);
  });

  it('shows helperText when there is no error', () => {
    render(<TextField label="Phone" value="" onChange={() => {}} helperText="Optional" />);
    expect(screen.getByText('Optional')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the required word from the vocabulary next to the label', () => {
    render(<TextField label="Name" value="" onChange={() => {}} required />);
    expect(screen.getByText('required')).toBeInTheDocument();
    expect(screen.getByLabelText(/Name/)).toBeRequired();
  });

  it('forces the input direction independently of the surrounding page', () => {
    render(<TextField label="Civil ID" value="255031200187" onChange={() => {}} dir="ltr" />);
    expect(screen.getByLabelText('Civil ID')).toHaveAttribute('dir', 'ltr');
  });

  it('disables the input when disabled', () => {
    render(<TextField label="Sector" value="" onChange={() => {}} disabled />);
    expect(screen.getByLabelText('Sector')).toBeDisabled();
  });

  it('calls onChange as the user types — it is a controlled input, not stateful', () => {
    const onChange = vi.fn();
    render(<TextField label="Name" value="a" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'ab' } });
    expect(onChange).toHaveBeenCalledOnce();
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { InlineNotice, type InlineNoticeProps } from './InlineNotice';

afterEach(cleanup);

describe('InlineNotice', () => {
  it('defaults to tone="info" and renders children plus an optional title', () => {
    render(<InlineNotice title="Heads up">Message body.</InlineNotice>);
    expect(screen.getByRole('status')).toHaveClass('wsf-notice--info');
    expect(screen.getByText('Heads up')).toBeInTheDocument();
    expect(screen.getByText('Message body.')).toBeInTheDocument();
  });

  it('renders success and warning tones', () => {
    const { rerender } = render(<InlineNotice tone="success">Connected.</InlineNotice>);
    expect(screen.getByRole('status')).toHaveClass('wsf-notice--success');
    rerender(<InlineNotice tone="warning">Running low.</InlineNotice>);
    expect(screen.getByRole('status')).toHaveClass('wsf-notice--warning');
  });

  it('renders no dismiss control when onDismiss is omitted, and fires it when supplied', () => {
    const { rerender } = render(<InlineNotice>Stays put.</InlineNotice>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();

    const onDismiss = vi.fn();
    rerender(
      <InlineNotice onDismiss={onDismiss} dismissLabel="Dismiss this notice">
        Can be put away.
      </InlineNotice>
    );
    const button = screen.getByRole('button', { name: 'Dismiss this notice' });
    fireEvent.click(button);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('falls back to the built-in English dismiss word when dismissLabel is omitted (no lang prop on InlineNotice)', () => {
    render(<InlineNotice onDismiss={() => {}}>Notice.</InlineNotice>);
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });

  it('the tone prop\'s type has no "danger" member — assigning one is a compile-time error, not a runtime check', () => {
    // @ts-expect-error — tone is 'info' | 'success' | 'warning'; InlineNotice never renders a safety tone.
    const invalid: InlineNoticeProps['tone'] = 'danger';
    expect(invalid).toBe('danger'); // only reached if the line above stops being a type error
  });
});

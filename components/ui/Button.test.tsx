import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('renders each variant with the wsf-btn anatomy', () => {
    const { rerender } = render(<Button variant="primary">Send</Button>);
    expect(screen.getByRole('button', { name: 'Send' })).toHaveClass('wsf-btn', 'wsf-btn--primary', 'wsf-focus');
    for (const variant of ['secondary', 'danger', 'quiet'] as const) {
      rerender(<Button variant={variant}>Send</Button>);
      expect(screen.getByRole('button', { name: 'Send' })).toHaveClass(`wsf-btn--${variant}`);
    }
  });

  it('defaults to type="button" so it never submits a form by accident', () => {
    render(<Button>Go</Button>);
    expect(screen.getByRole('button', { name: 'Go' })).toHaveAttribute('type', 'button');
  });

  it('size="lg" adds the taller box and body-strong type class', () => {
    render(<Button size="lg">Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('wsf-btn--lg', 'type-body-strong');
  });

  it('fullWidth adds the block modifier', () => {
    render(<Button fullWidth>Continue</Button>);
    expect(screen.getByRole('button', { name: 'Continue' })).toHaveClass('wsf-btn--block');
  });

  it('loading sets aria-busy, disables the button and keeps the label in place', () => {
    render(<Button loading>Send request</Button>);
    const btn = screen.getByRole('button', { name: /send request/i });
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent('Send request');
    expect(btn.querySelector('.wsf-spinner')).not.toBeNull();
  });

  it('fires onClick when not loading or disabled', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    screen.getByRole('button', { name: 'Go' }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a leading icon and mirrors it when asked', () => {
    render(
      <Button icon="chevron" mirrorIcon>
        Back
      </Button>,
    );
    const icon = screen.getByRole('button', { name: 'Back' }).querySelector('.wsf-ico');
    expect(icon).toHaveClass('wsf-mirror');
  });
});

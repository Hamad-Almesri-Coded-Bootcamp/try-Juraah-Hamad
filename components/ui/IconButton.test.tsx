import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { IconButton } from './IconButton';

afterEach(cleanup);

describe('IconButton', () => {
  it('uses `label` as the accessible name — the icon-only control has no other one', () => {
    render(<IconButton icon="close" label="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('keeps the 44px hit area class regardless of variant', () => {
    render(<IconButton icon="close" label="Close" variant="danger" />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('wsf-iconbtn', 'wsf-btn--danger', 'wsf-focus');
  });

  it('defaults to the quiet variant', () => {
    render(<IconButton icon="close" label="Close" />);
    expect(screen.getByRole('button', { name: 'Close' })).toHaveClass('wsf-btn--quiet');
  });

  it('renders a real link when `href` is set, for navigation', () => {
    render(<IconButton icon="chevron" mirrorIcon label="Back to medications" href="/app/medicines" />);
    const link = screen.getByRole('link', { name: 'Back to medications' });
    expect(link).toHaveAttribute('href', '/app/medicines');
  });

  it('fires onClick on the button form', () => {
    const onClick = vi.fn();
    render(<IconButton icon="close" label="Close" onClick={onClick} />);
    screen.getByRole('button', { name: 'Close' }).click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it.skip('requires `label` — a type-only check, never run', () => {
    // @ts-expect-error — IconButton.label is required; an icon-only control has no other accessible name.
    render(<IconButton icon="close" />);
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { Card } from './Card';

afterEach(cleanup);

describe('Card', () => {
  it('renders a plain div by default', () => {
    const { container } = render(<Card>content</Card>);
    expect(container.firstElementChild?.tagName).toBe('DIV');
    expect(container.firstElementChild?.className).toContain('wsf-card');
  });

  it('renders a button when onClick is set, and fires it on click', async () => {
    const onClick = vi.fn();
    render(<Card onClick={onClick} aria-label="Open detail">content</Card>);
    const button = screen.getByRole('button', { name: 'Open detail' });
    button.click();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders a link when as="a" and href are set', () => {
    render(<Card as="a" href="/x" aria-label="Go">content</Card>);
    const link = screen.getByRole('link', { name: 'Go' });
    expect(link).toHaveAttribute('href', '/x');
  });

  it('drops the shadow class when flat', () => {
    const { container } = render(<Card flat>content</Card>);
    expect(container.firstElementChild?.className).toContain('wsf-card--flat');
  });

  it('carries the focus ring only when interactive', () => {
    const { container: staticCard } = render(<Card>content</Card>);
    expect(staticCard.firstElementChild?.className).not.toContain('wsf-focus');
    const { container: clickable } = render(<Card onClick={() => {}} aria-label="Open">content</Card>);
    expect(clickable.firstElementChild?.className).toContain('wsf-focus');
  });
});

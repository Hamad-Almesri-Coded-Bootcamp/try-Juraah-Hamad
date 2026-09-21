import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { MenuRow } from './MenuRow';

afterEach(cleanup);

describe('MenuRow', () => {
  it('renders a plain row when neither href nor onClick is set', () => {
    render(<MenuRow label="Help" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByText('Help')).toBeInTheDocument();
  });

  it('renders a link destination', () => {
    render(<MenuRow label="Refill" href="/refill" />);
    expect(screen.getByRole('link', { name: /Refill/ })).toHaveAttribute('href', '/refill');
  });

  it('renders a settings row with a value', () => {
    render(<MenuRow label="Calendar sync" value="On" onClick={vi.fn()} />);
    expect(screen.getByText('On')).toBeInTheDocument();
  });

  it('renders a relationship state in ink-muted with no badge, dot or alert icon', () => {
    render(<MenuRow label="Nasser" value="Awaiting acceptance" tone="relationship" />);
    const value = screen.getByText('Awaiting acceptance');
    expect(value).toHaveAttribute('data-tone', 'relationship');
    expect(value.querySelector('svg')).toBeNull();
    expect(value.closest('.jr-menu-row')?.querySelector('[class*="badge"], [class*="dot"]')).toBeNull();
  });

  it('holds a trailing control (a Toggle slot) instead of becoming interactive itself', () => {
    const onClick = vi.fn();
    render(
      <MenuRow label="Dose reminders" trailing={<input type="checkbox" aria-label="Dose reminders" defaultChecked />} onClick={onClick} />
    );
    // trailing wins: the row itself is not a nested button/link around the checkbox
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).toBeInTheDocument();
  });

  it('fires onClick when set and no trailing is present', () => {
    const onClick = vi.fn();
    render(<MenuRow label="Settings" onClick={onClick} />);
    screen.getByRole('button').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

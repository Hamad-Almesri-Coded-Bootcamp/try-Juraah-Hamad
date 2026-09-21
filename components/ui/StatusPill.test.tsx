import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { StatusPill, type DoseStatus } from './StatusPill';

afterEach(cleanup);

const STATUSES: DoseStatus[] = ['upcoming', 'taken_on_time', 'taken_late', 'missed'];

describe('StatusPill', () => {
  it('renders a data-testid="status-pill" root', () => {
    render(<StatusPill status="upcoming" lang="en" />);
    expect(screen.getByTestId('status-pill')).toBeInTheDocument();
  });

  it.each(STATUSES)('renders the %s status with its own word and glyph, never colour alone', (status) => {
    render(<StatusPill status={status} lang="en" />);
    const pill = screen.getByTestId('status-pill');
    expect(pill.className).toContain(`wsf-pill--${status}`);
    // the word is always present as text, and an icon (svg) sits beside it
    expect(pill.textContent).not.toBe('');
    expect(pill.querySelector('svg')).toBeTruthy();
  });

  it('supports an Arabic fallback word via lang', () => {
    render(<StatusPill status="missed" lang="ar" />);
    expect(screen.getByTestId('status-pill').textContent).toContain('فائتة');
  });

  it('lets the consumer override the word while keeping the glyph', () => {
    render(<StatusPill status="missed" label="Custom label" lang="en" />);
    const pill = screen.getByTestId('status-pill');
    expect(pill.textContent).toContain('Custom label');
    expect(pill.querySelector('svg')).toBeTruthy();
  });

  it('defaults lang to en', () => {
    render(<StatusPill status="taken_on_time" />);
    expect(screen.getByTestId('status-pill').textContent).toContain('Taken on time');
  });
});

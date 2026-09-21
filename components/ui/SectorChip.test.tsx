import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { SectorChip } from './SectorChip';

afterEach(cleanup);

describe('SectorChip', () => {
  it('renders the public sector word', () => {
    render(<SectorChip sector="public" lang="en" />);
    expect(screen.getByText('Public sector')).toBeInTheDocument();
  });

  it('renders the private sector word', () => {
    render(<SectorChip sector="private" lang="en" />);
    expect(screen.getByText('Private sector')).toBeInTheDocument();
  });

  it('never carries a semantic colour class', () => {
    const { container } = render(<SectorChip sector="public" lang="en" />);
    const chip = container.firstElementChild as HTMLElement;
    expect(chip.className).toContain('wsf-chip');
    expect(chip.className).not.toMatch(/danger|warning|success/);
  });

  it('lets the consumer override the label', () => {
    render(<SectorChip sector="private" label="Government centre" lang="en" />);
    expect(screen.getByText('Government centre')).toBeInTheDocument();
  });
});

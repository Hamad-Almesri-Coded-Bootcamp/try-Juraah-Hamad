import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DetailRow } from './DetailRow';

afterEach(cleanup);

describe('DetailRow', () => {
  it('renders the label and value', () => {
    render(<DetailRow label="Dose" value="One tablet" lang="en" />);
    expect(screen.getByText('Dose')).toBeInTheDocument();
    expect(screen.getByText('One tablet')).toBeInTheDocument();
  });

  it.each([null, undefined, ''])('renders the empty mark and assistive text for %s, never "undefined"', (value) => {
    render(<DetailRow label="Notes" value={value} lang="en" />);
    const row = screen.getByText('Notes').closest('.wsf-dr') as HTMLElement;
    expect(row.textContent).not.toContain('undefined');
    expect(row.querySelector('.wsf-sr')?.textContent).toBe('Not recorded');
  });

  it('never collapses the row when the value is empty', () => {
    render(<DetailRow label="Notes" value={null} lang="en" />);
    expect(screen.getByText('Notes')).toBeVisible();
  });

  it('lets the consumer override the empty mark and assistive label', () => {
    render(<DetailRow label="Notes" value={undefined} emptyMark="?" emptyLabel="Unknown" lang="en" />);
    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Unknown')).toBeInTheDocument();
  });
});

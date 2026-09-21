import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { LoadingState } from './LoadingState';

afterEach(cleanup);

describe('LoadingState', () => {
  it('defaults to the list variant with 3 rows, aria-busy and a polite live region', () => {
    const { container } = render(<LoadingState />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-busy', 'true');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByText('Loading')).toBeInTheDocument();
    expect(container.querySelectorAll('.wsf-skel__card')).toHaveLength(3);
  });

  it('falls back to the built-in English loading word when label is omitted (no lang prop on LoadingState)', () => {
    render(<LoadingState label="جاري التحميل" />);
    expect(screen.getByText('جاري التحميل')).toBeInTheDocument();
  });

  it('renders the requested row count for list and lines, one block for detail and alert', () => {
    const { container: list } = render(<LoadingState variant="list" rows={5} />);
    expect(list.querySelectorAll('.wsf-skel__card')).toHaveLength(5);

    const { container: lines } = render(<LoadingState variant="lines" rows={4} />);
    expect(lines.querySelectorAll('.wsf-skel__bar')).toHaveLength(4);

    const { container: detail } = render(<LoadingState variant="detail" />);
    expect(detail.querySelectorAll('.wsf-skel__card')).toHaveLength(1);

    const { container: alert } = render(<LoadingState variant="alert" />);
    expect(alert.querySelectorAll('.wsf-skel__alert')).toHaveLength(1);
  });

  it('every skeleton bar is aria-hidden — the only accessible content is the sr-only label', () => {
    const { container } = render(<LoadingState variant="lines" rows={2} />);
    const bars = container.querySelectorAll('.wsf-skel__bar');
    bars.forEach((bar) => expect(bar).toHaveAttribute('aria-hidden', 'true'));
  });
});

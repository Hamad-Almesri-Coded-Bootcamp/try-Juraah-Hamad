import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Tag } from './Tag';
import { Disclosure } from './Disclosure';

afterEach(cleanup);

describe('Tag', () => {
  it('renders each tone as a plain, non-interactive label', () => {
    const { container } = render(
      <>
        <Tag tone="neutral">Level</Tag>
        <Tag tone="info" icon="review">Draft</Tag>
        <Tag tone="success" icon="check">Checked</Tag>
      </>,
    );
    expect(screen.getByText('Level').closest('.jr-tag')).toHaveClass('jr-tag--neutral');
    expect(screen.getByText('Draft').closest('.jr-tag')).toHaveClass('jr-tag--info');
    expect(screen.getByText('Checked').closest('.jr-tag')).toHaveClass('jr-tag--success');
    expect(container.querySelector('button, a')).not.toBeInTheDocument();
    expect(container.innerHTML).not.toMatch(/danger/);
  });
});

describe('Disclosure', () => {
  it('is a native details/summary pair, closed unless asked to start open', () => {
    const { container, rerender } = render(<Disclosure summary="More">Hidden body</Disclosure>);
    const details = container.querySelector<HTMLDetailsElement>('details.jr-disclosure')!;
    expect(details.open).toBe(false);
    expect(container.querySelector('summary')).toHaveTextContent('More');
    rerender(<Disclosure summary="More" defaultOpen>Hidden body</Disclosure>);
    expect(container.querySelector('details')!.open).toBe(true);
    expect(screen.getByText('Hidden body')).toBeInTheDocument();
  });
});

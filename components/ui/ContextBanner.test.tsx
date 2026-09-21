import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, render, screen } from '@testing-library/react';
import { ContextBanner } from './ContextBanner';

afterEach(cleanup);

describe('ContextBanner', () => {
  it('renders the caregiver variant as role="note", never dismissable', () => {
    const { container } = render(<ContextBanner variant="caregiver" title="Viewing the record of Hamad" detail="Read-only" icon="users" />);
    const banner = screen.getByRole('note');
    expect(banner).toHaveClass('wsf-ctxbanner--caregiver');
    expect(screen.getByText('Viewing the record of Hamad')).toBeInTheDocument();
    expect(screen.getByText('Read-only')).toBeInTheDocument();
    expect(container.querySelector('button')).not.toBeInTheDocument();
  });

  it('renders the simulated-role variant as role="note"', () => {
    render(<ContextBanner variant="simulated" title="Simulated role · Medical reviewer" />);
    expect(screen.getByRole('note')).toHaveClass('wsf-ctxbanner--simulated');
  });

  it('renders the lastKnown variant as role="status" with an as-of detail', () => {
    render(<ContextBanner variant="lastKnown" title="Showing the last saved copy" detail="As of 9:15 AM" />);
    const banner = screen.getByRole('status');
    expect(banner).toHaveClass('wsf-ctxbanner--lastKnown');
    expect(screen.getByText('As of 9:15 AM')).toBeInTheDocument();
  });

  it('renders with no detail and no icon', () => {
    render(<ContextBanner variant="caregiver" title="Only a title" />);
    expect(screen.getByText('Only a title')).toBeInTheDocument();
  });

  it('never sets a danger class or reads the danger token — variant excludes it at the type level, and the stylesheet never touches --danger', () => {
    // @ts-expect-error — variant is 'caregiver' | 'simulated' | 'lastKnown'; ContextBanner never renders a danger case.
    const invalidVariant: import('./ContextBanner').ContextBannerProps['variant'] = 'danger';
    expect(invalidVariant).toBe('danger'); // only reached if the line above stops being a type error

    // The stylesheet may document in prose why danger is excluded (it does); it must never reach
    // for the token or paint a rule with it.
    const styleSrc = readFileSync(join(process.cwd(), 'components/ui/styles/ContextBanner.css'), 'utf8');
    expect(styleSrc).not.toMatch(/--danger\b/);
    expect(styleSrc).not.toMatch(/\.wsf-ctxbanner[\w-]*danger/i);
  });

  it('renders every variant\'s wrapper class from the fixed variant union — no class can read "danger"', () => {
    (['caregiver', 'simulated', 'lastKnown'] as const).forEach((variant) => {
      const { container, unmount } = render(<ContextBanner variant={variant} title={`Title for ${variant}`} />);
      const wrapper = container.firstElementChild;
      expect(wrapper?.className).not.toMatch(/danger/i);
      unmount();
    });
  });
});

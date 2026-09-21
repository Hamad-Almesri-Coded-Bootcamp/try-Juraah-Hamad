import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ScheduleGroup } from './ScheduleGroup';
import { DoseRow } from './DoseRow';

afterEach(cleanup);

const drug = { genericName: 'Warfarin', brandName: 'Marevan' };

describe('ScheduleGroup', () => {
  it('labels the section with its time via aria-labelledby', () => {
    const { container } = render(
      <ScheduleGroup timeLabel="6:00 PM">
        <DoseRow dose={{ status: 'upcoming', tracked: false }} drug={drug} amountLabel="One tablet" lang="en" />
      </ScheduleGroup>
    );
    const section = container.querySelector('section') as HTMLElement;
    const labelledBy = section.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    expect(document.getElementById(labelledBy!)?.textContent).toContain('6:00 PM');
  });

  it('is correct with one row', () => {
    render(
      <ScheduleGroup timeLabel="6:00 PM">
        <DoseRow dose={{ status: 'upcoming', tracked: false }} drug={drug} amountLabel="One tablet" lang="en" />
      </ScheduleGroup>
    );
    expect(screen.getAllByTestId('dose-row')).toHaveLength(1);
  });

  it('is correct with several rows', () => {
    render(
      <ScheduleGroup timeLabel="8:00 AM">
        <DoseRow dose={{ status: 'upcoming', tracked: false }} drug={{ genericName: 'Metformin' }} amountLabel="One tablet" lang="en" />
        <DoseRow dose={{ status: 'upcoming', tracked: false }} drug={{ genericName: 'Ibuprofen' }} amountLabel="One tablet" lang="en" />
      </ScheduleGroup>
    );
    expect(screen.getAllByTestId('dose-row')).toHaveLength(2);
  });

  it('offers no interactive control of its own', () => {
    render(
      <ScheduleGroup timeLabel="8:00 AM">
        <span>content</span>
      </ScheduleGroup>
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

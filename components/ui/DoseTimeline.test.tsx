import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { DoseTimeline } from './DoseTimeline';

afterEach(cleanup);

describe('DoseTimeline', () => {
  it('renders a pill per tracked item', () => {
    render(
      <DoseTimeline
        lang="en"
        items={[
          { dateLabel: 'Today', timeLabel: '7:00 AM', status: 'taken_on_time', tracked: true },
          { dateLabel: 'Yesterday', timeLabel: '9:00 PM', status: 'taken_late', tracked: true },
          { dateLabel: '19 Sept', timeLabel: '7:00 AM', status: 'missed', tracked: true }
        ]}
      />
    );
    expect(screen.getAllByTestId('status-pill')).toHaveLength(3);
  });

  it('renders no pill for an untracked item, regardless of status', () => {
    render(
      <DoseTimeline
        lang="en"
        items={[{ dateLabel: 'Today', timeLabel: '8:00 AM', status: 'upcoming', tracked: false }]}
      />
    );
    expect(screen.queryByTestId('status-pill')).not.toBeInTheDocument();
    expect(screen.getByText('8:00 AM', { exact: false })).toBeInTheDocument();
  });

  it('is correct with no statuses at all — the untracked patient\'s history is a list of times', () => {
    render(
      <DoseTimeline
        lang="en"
        items={[
          { dateLabel: 'Today', timeLabel: '8:00 AM', status: 'upcoming', tracked: false },
          { dateLabel: 'Today', timeLabel: '2:00 PM', status: 'upcoming', tracked: false },
        ]}
      />
    );
    expect(screen.queryAllByTestId('status-pill')).toHaveLength(0);
  });

  it('is read-only: no interactive control anywhere', () => {
    render(
      <DoseTimeline lang="en" items={[{ dateLabel: 'Today', timeLabel: '8:00 AM', status: 'upcoming', tracked: true }]} />
    );
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});

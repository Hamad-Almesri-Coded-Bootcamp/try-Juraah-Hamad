import { afterEach, describe, expect, it } from 'vitest';
import { render, cleanup, screen } from '@testing-library/react';
import { ActivityRow } from './ActivityRow';

afterEach(cleanup);

describe('ActivityRow — list layout', () => {
  it('renders title, time and description', () => {
    render(<ActivityRow title="Serious interaction alert raised" timeLabel="Today 9:02 AM" description="Warfarin × Ibuprofen" />);
    expect(screen.getByText('Serious interaction alert raised')).toBeInTheDocument();
    expect(screen.getByText('Today 9:02 AM')).toBeInTheDocument();
    expect(screen.getByText('Warfarin × Ibuprofen')).toBeInTheDocument();
  });

  it('renders the actor label but never the literal role string unless code is passed', () => {
    render(<ActivityRow title="Dose status recorded" timeLabel="Today 7:12 AM" actor={{ label: 'Adherence assistant', kind: 'agent' }} />);
    expect(screen.getByText('Adherence assistant')).toBeInTheDocument();
    expect(screen.queryByText(/agent\)/)).not.toBeInTheDocument();
  });

  it('renders the literal role string beside the label only when code is passed (X1, CR-010)', () => {
    render(
      <ActivityRow title="Dose status recorded" timeLabel="Today 7:12 AM" actor={{ label: 'Adherence assistant', kind: 'agent' }} code="agent" />
    );
    expect(screen.getByText('(agent)', { exact: false })).toBeInTheDocument();
  });

  it('renders a masked-name patientRef when given', () => {
    render(<ActivityRow title="Caregiver invited" timeLabel="20 Sept" patientRef="سارة ي*** العجمي" />);
    expect(screen.getByText('سارة ي*** العجمي')).toBeInTheDocument();
  });

  it('is a link only when href is given, and never any other interactive control', () => {
    const { rerender } = render(<ActivityRow title="Event" timeLabel="Today" />);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    rerender(<ActivityRow title="Event" timeLabel="Today" href="/rx/1" />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/rx/1');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});

describe('ActivityRow — table layout', () => {
  it('renders a <tr> with one cell per column, inside a table', () => {
    render(
      <table>
        <tbody>
          <ActivityRow
            layout="table"
            title="Dose status recorded"
            timeLabel="2026-09-21 07:12"
            description="taken_on_time · Levothyroxine"
            actor={{ label: 'Adherence assistant', kind: 'agent' }}
            code="agent"
            patientRef="سارة ي*** العجمي"
          />
        </tbody>
      </table>
    );
    const row = screen.getByRole('row');
    expect(row.querySelectorAll('td')).toHaveLength(5);
  });

  it('pairs with ActivityRow.Table for the header row', () => {
    render(
      <table>
        <ActivityRow.Table columns={{ time: 'Time', event: 'Event', actor: 'Actor', patient: 'Patient', description: 'Description' }} />
        <tbody>
          <ActivityRow layout="table" title="Signed in" timeLabel="2026-09-21 06:02" />
        </tbody>
      </table>
    );
    expect(screen.getAllByRole('columnheader')).toHaveLength(5);
  });
});

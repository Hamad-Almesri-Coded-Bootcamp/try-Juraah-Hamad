/**
 * CalendarSync — E1 (features/ambient/CalendarSync.tsx), against the real data layer (reset() +
 * setScriptSession), matching tests/unit/caregiving/acceptMovesToActive.test.ts's own precedent for
 * exercising a mutation through the public seam rather than a mock.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CalendarSync } from '@/features/ambient/CalendarSync';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh }) }));

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'pt-01', role: 'patient' });
});

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

describe('CalendarSync — off (حمد has never subscribed)', () => {
  it('shows the gain-framed subscribe action, never the link', () => {
    render(<CalendarSync patientId="pt-01" subscription={null} locale="en" />);
    expect(screen.getByTestId('calendar-off')).toBeInTheDocument();
    expect(screen.queryByTestId('calendar-on')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create subscription link' })).toBeInTheDocument();
  });

  it('subscribing calls the real enableCalendarSync and then shows the exact returned link, never constructed on screen', async () => {
    render(<CalendarSync patientId="pt-01" subscription={null} locale="en" />);
    fireEvent.click(screen.getByRole('button', { name: 'Create subscription link' }));
    const input = await screen.findByDisplayValue(/^webcal:\/\//);
    expect(input).toHaveValue('webcal://jurah.app/calendar/pt-01.ics');
    expect(refresh).toHaveBeenCalled();
  });
});

describe('CalendarSync — on (سارة is already subscribed)', () => {
  it('shows the CopyField with the subscription’s own value and the one-directional notice, never a warning tone', () => {
    render(
      <CalendarSync
        patientId="pt-03"
        subscription={{ patientId: 'pt-03', icsUrl: 'webcal://jurah.app/calendar/pt-03.ics', token: 'tok-03' }}
        locale="en"
      />,
    );
    expect(screen.getByDisplayValue('webcal://jurah.app/calendar/pt-03.ics')).toBeInTheDocument();
    expect(screen.getByText('Sync is one-directional')).toBeInTheDocument();
    expect(screen.queryByText('tok-03')).not.toBeInTheDocument(); // the token itself is never printed
  });
});

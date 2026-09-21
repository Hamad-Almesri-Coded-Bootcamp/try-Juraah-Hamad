/**
 * SettingsScreen — E3 (features/ambient/SettingsScreen.tsx). CR-011's "exactly" list: an explicit
 * control census (no channel Select, no language control) · the no-connected-chat tracking toggle
 * routes to E5 and writes nothing (asserted against the real store, not a spy) · the turn-off Sheet
 * names all three consequences.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { SettingsScreen } from '@/features/ambient/SettingsScreen';
import { getSettings } from '@/lib/data';
import { getStore, reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

beforeEach(() => {
  reset();
  push.mockClear();
  refresh.mockClear();
});

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

describe('E3 — exactly the permitted controls, no more', () => {
  it('renders exactly three Toggle switches, one two-option frequency ChoiceGroup, one phone TextField — no <select>, no extra language control', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' });
    const settings = await getSettings('pt-01');
    const { container } = render(
      <SettingsScreen patientId="pt-01" settings={settings} chatConnected={false} phone={null} locale="en" notificationsHref="/en/app/more/notifications" />,
    );

    expect(container.querySelectorAll('[role="switch"]')).toHaveLength(3); // tracking, refill, calendar
    expect(container.querySelectorAll('input[type="radio"]')).toHaveLength(2); // daily / every other day
    expect(container.querySelectorAll('select')).toHaveLength(0); // CR-011: no channel Select, ever
    expect(container.querySelectorAll('input[type="text"], input:not([type])').length).toBeGreaterThanOrEqual(1); // the phone field

    // No control here duplicates the app bar's language switch (G2).
    expect(screen.queryByRole('button', { name: /English|العربية/ })).not.toBeInTheDocument();
  });
});

describe('E3 — adherence toggle with no connected chat', () => {
  it('reads off, explains why, and routes to E5 on flip — writing nothing (call-log + store assertion)', async () => {
    setScriptSession({ subjectId: 'pt-01', role: 'patient' }); // حمد: tracking off, chat not_connected
    const before = await getSettings('pt-01');
    render(
      <SettingsScreen patientId="pt-01" settings={before} chatConnected={false} phone={null} locale="en" notificationsHref="/en/app/more/notifications" />,
    );

    expect(screen.getByText('A connected chat is what turns daily check-ins on.')).toBeInTheDocument();

    const trackingSwitch = screen.getAllByRole('switch')[0]!;
    expect(trackingSwitch).toHaveAttribute('aria-checked', 'false');
    fireEvent.click(trackingSwitch);

    expect(push).toHaveBeenCalledWith('/en/app/more/notifications');
    expect(refresh).not.toHaveBeenCalled();
    const after = getStore().settings.find((s) => s.patientId === 'pt-01');
    expect(after?.adherenceCheckInEnabled).toBe(before.adherenceCheckInEnabled); // unchanged — nothing written
  });
});

describe('E3 — turning tracking off', () => {
  it('confirms in a Sheet naming all three consequences before writing anything', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' }); // سارة: tracking on, chat connected
    const settings = await getSettings('pt-03');
    render(
      <SettingsScreen patientId="pt-03" settings={settings} chatConnected phone={null} locale="en" notificationsHref="/en/app/more/notifications" />,
    );

    const trackingSwitch = screen.getAllByRole('switch')[0]!;
    expect(trackingSwitch).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(trackingSwitch);

    // The store is not yet changed — the Sheet asks first.
    expect(getStore().settings.find((s) => s.patientId === 'pt-03')?.adherenceCheckInEnabled).toBe(true);

    const consequences = screen.getByTestId('turn-off-consequences');
    expect(consequences).toHaveTextContent('Daily check-in messages stop.');
    expect(consequences).toHaveTextContent('New doses stop carrying a status.');
    expect(consequences).toHaveTextContent('Your recorded history is kept.');

    fireEvent.click(screen.getByRole('button', { name: 'Turn tracking off' }));
    await vi.waitFor(() => expect(getStore().settings.find((s) => s.patientId === 'pt-03')?.adherenceCheckInEnabled).toBe(false));
  });
});

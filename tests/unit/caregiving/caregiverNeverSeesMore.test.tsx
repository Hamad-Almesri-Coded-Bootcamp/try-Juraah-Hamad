/**
 * Named invariant — caregiver never sees more than the patient (WP4h ACCEPTANCE): F2's rendered
 * dose rows for حمد equal the data layer's own `getDosesForDay` rows for حمد — same count, and (he
 * is untracked) not one of them carries a status pill. `features/day`'s `DoseDayList` is the exact
 * renderer B1 itself uses (DEPENDENCIES §1), so row-for-row parity with the patient's own screen is
 * a property of sharing the component, verified here against the seed's own six-dose day.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { CaregiverToday } from '@/features/caregiving/CaregiverToday';
import { getDosesForDay } from '@/lib/data';
import { REFERENCE_DATE } from '@/lib/schedule/dates';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
});

describe('F2 Today — حمد, never more than his own six untracked doses', () => {
  it('renders exactly as many dose rows as getDosesForDay returns for حمد, none with a status pill', async () => {
    const doses = await getDosesForDay('pt-01', REFERENCE_DATE);
    expect(doses.length).toBe(6); // docs/Seed Dataset.md — 08:00×2, 14:00, 18:00, 20:00×2
    expect(doses.every((d) => d.tracked === false)).toBe(true);

    const element = await CaregiverToday({ caregiverId: 'cg-01', locale: 'ar', day: REFERENCE_DATE });
    const { container } = render(element);

    const rows = container.querySelectorAll('[data-testid="dose-row"]');
    expect(rows.length).toBe(doses.length);
    expect(container.querySelectorAll('[data-testid="status-pill"]').length).toBe(0);
  });
});

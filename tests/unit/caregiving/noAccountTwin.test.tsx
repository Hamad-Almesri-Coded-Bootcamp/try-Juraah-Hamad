/**
 * Named invariant — no-account twin identical (WP4h ACCEPTANCE): the "invitation created" outcome
 * must be byte-identical whether the Civil ID has a Jur'ah account (masked name confirmed with
 * "yes") or not (the flow skips confirmation and proceeds identically — G9). Drives `InviteSheet`
 * through both real paths against the mock store and diffs the rendered "created" panel's markup.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { InviteSheet } from '@/features/caregiving/InviteSheet';
import { copy, t } from '@/i18n';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

afterEach(() => {
  cleanup();
  setScriptSession(null);
});

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'pt-01', role: 'patient' });
});

async function driveToCreated(civilId: string, name: string, relationship: string): Promise<string> {
  // Sheet portals into document.body (it covers the shell's TabBar), so the rendered panel lives
  // outside RTL's `container` — read it from `baseElement` (document.body) instead.
  const { baseElement } = render(<InviteSheet patientId="pt-01" locale="ar" onDone={() => {}} />);

  fireEvent.change(screen.getByLabelText(t(copy.caregiving.f1CivilIdLabel, 'ar')), { target: { value: civilId } });
  fireEvent.change(screen.getByLabelText(t(copy.caregiving.f1NameKnownLabel, 'ar')), { target: { value: name } });
  fireEvent.change(screen.getByLabelText(t(copy.caregiving.f1RelationshipLabel, 'ar')), { target: { value: relationship } });
  fireEvent.click(screen.getByRole('button', { name: t(copy.caregiving.f1ContinueButton, 'ar') }));

  // Has-account path pauses on the masked-name confirmation; no-account skips straight to 'created'.
  await waitFor(() => {
    expect(
      screen.queryByTestId('invite-created-panel') ?? screen.queryByText(t(copy.caregiving.f1ConfirmQuestion, 'ar')),
    ).not.toBeNull();
  });

  const confirmYes = screen.queryByRole('button', { name: t(copy.caregiving.f1ConfirmYes, 'ar') });
  if (confirmYes) fireEvent.click(confirmYes);

  await waitFor(() => expect(screen.getByTestId('invite-created-panel')).toBeInTheDocument());

  return baseElement.querySelector('[data-testid="invite-created-panel"]')!.innerHTML;
}

describe('InviteSheet — the created outcome is identical whichever path led to it', () => {
  it('a Civil ID with an account (confirmed "yes") and one with none render byte-identical "created" markup', async () => {
    const withAccountHtml = await driveToCreated('285061400412', 'اسم اختبار ١', 'قريب');
    cleanup();
    reset();
    const noAccountHtml = await driveToCreated('277091900873', 'اسم اختبار ٢', 'صديق');

    expect(withAccountHtml).toBe(noAccountHtml);
  });
});

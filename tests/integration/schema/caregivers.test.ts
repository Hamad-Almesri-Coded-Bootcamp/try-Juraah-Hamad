/** caregivers — the invitation gate (G9, E-17, E-19). Each named constraint + every refused edge of caregiver_transitions. */
import { describe, expect, it } from 'vitest';
import { OWNER_NO_SESSION, S, SYSTEM, accepts, app, rejects } from '../helpers';

const ins = (id: string, civil: string, status: string, extra = '', extraVals = '', expires = '2026-10-15T12:00:00+03:00') =>
  `insert into caregivers (id, civil_id, name, relationship, linked_patient_id, status, invited_at, expires_at${extra}) values ('${id}', '${civil}', 'x', 'x', 'pt-01', '${status}', '2026-09-01T12:00:00+03:00', '${expires}'${extraVals})`;
const accept = (id: string) => `update caregivers set status = 'active', accepted_at = jurah_now() where id = '${id}'`;

describe('caregivers — constraints', () => {
  it('caregivers_active_has_accepted', async () => { await rejects(SYSTEM, ins('c1', '299999900001', 'active'), 'caregivers_active_has_accepted'); });
  it('caregivers_declined_has_declined_at', async () => { await rejects(SYSTEM, ins('c2', '299999900001', 'declined'), 'caregivers_declined_has_declined_at'); });
  it('caregivers_revoked_has_revoked_at', async () => { await rejects(SYSTEM, ins('c3', '299999900001', 'revoked'), 'caregivers_revoked_has_revoked_at'); });
  it('caregivers_pending_is_clean', async () => {
    await rejects(SYSTEM, ins('c4', '299999900001', 'pending', ', accepted_at', ", '2026-09-02T12:00:00+03:00'"), 'caregivers_pending_is_clean');
  });
  it('caregivers_access_level_read_only', async () => {
    await rejects(SYSTEM, ins('c5', '299999900001', 'pending', ', access_level', ", 'read_write'"), 'caregivers_access_level_read_only');
  });
  it('caregivers_civil_id_shape', async () => { await rejects(SYSTEM, ins('c6', '12345', 'pending'), 'caregivers_civil_id_shape'); });
  it('caregivers_linked_patient_id_fkey', async () => {
    await rejects(SYSTEM, ins('c7', '299999900001', 'pending').replace("'pt-01'", "'pt-99'"), 'caregivers_linked_patient_id_fkey');
  });
});

describe('caregivers — caregiver_transitions (only the invited Civil ID accepts)', () => {
  it('the owner with a system session cannot activate cg-03 (no bypass, not even the table owner)', async () => {
    await rejects(SYSTEM, accept('cg-03'), 'caregiver_transitions: only the invited civil id may accept');
  });
  it('حمد (the inviter) cannot accept on ناصر’s behalf', async () => {
    await rejects(app(S.hamad), accept('cg-03'), 'caregiver_transitions: only the invited civil id may accept');
  });
  it('an admin session cannot even see the row to change it (RLS 0 rows); the row stays pending', async () => {
    const r = await accepts(app(S.dana), accept('cg-03'), `select status::text from caregivers where id = 'cg-03'`);
    expect(r).toEqual({ count: 0, value: 'pending' });
  });
  it('declined (cg-04), expired (cg-05), revoked (cg-06, cg-07) can never be accepted, even by their own civil id', async () => {
    const own: Record<string, string> = { 'cg-04': '292043000517', 'cg-05': '277091900873', 'cg-06': '298052000731', 'cg-07': '285092200664' };
    for (const [id, civil] of Object.entries(own)) {
      await rejects({ role: 'owner', session: { subjectId: id, pendingInvitationOnly: true, civilId: civil } }, accept(id), 'caregiver_transitions');
    }
  });
  it('an invitation past expires_at cannot be accepted (read-time expiry in the gate)', async () => {
    await rejects({ role: 'owner', session: S.naserPending }, `select set_config('jurah.now', '2026-10-03T00:00:00+03:00', true); ${accept('cg-03')}`, 'caregiver_transitions: the invitation has expired');
  });
  it('civil_id and linked_patient_id never change', async () => {
    await rejects(SYSTEM, `update caregivers set linked_patient_id = 'pt-02' where id = 'cg-01'`, 'caregiver_transitions: id, civil_id and linked_patient_id never change');
    await rejects(SYSTEM, `update caregivers set civil_id = '299999900001' where id = 'cg-03'`, 'caregiver_transitions');
  });
  it('lifecycle timestamps change only with a transition', async () => {
    await rejects(SYSTEM, `update caregivers set accepted_at = jurah_now() where id = 'cg-01'`, 'caregiver_transitions: lifecycle timestamps change only with a transition');
  });
  it('a cancelled invitation never gains accepted_at; only the inviting patient cancels', async () => {
    await rejects(app(S.hamad), `update caregivers set status = 'revoked', revoked_at = jurah_now(), accepted_at = jurah_now() where id = 'cg-03'`, 'caregiver_transitions: a cancelled invitation was never accepted');
    await rejects({ role: 'owner', session: S.fatima }, `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-03'`, 'caregiver_transitions: only the inviting patient may cancel');
  });
  it('only the system expires, and only once expires_at has passed', async () => {
    await rejects(app(S.hamad), `update caregivers set status = 'expired' where id = 'cg-03'`, 'caregiver_transitions: only the system expires an invitation');
    await rejects(SYSTEM, `update caregivers set status = 'expired' where id = 'cg-03'`, 'caregiver_transitions: the invitation has not expired yet');
  });
  it('no session cannot cancel an invitation or end access, even as the owner (0011: NULL-safe guards)', async () => {
    // Before 0011 both statements were ACCEPTED: `owner_patient` was NULL, not false, with no session.
    await rejects(OWNER_NO_SESSION, `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-03'`, 'caregiver_transitions: only the inviting patient may cancel an invitation');
    await rejects(OWNER_NO_SESSION, `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-01'`, 'caregiver_transitions: only the linked patient or the caregiver may end access');
  });
  it('a different caregiver cannot end someone else’s access', async () => {
    await rejects({ role: 'owner', session: S.abdullah }, `update caregivers set status = 'revoked', revoked_at = jurah_now() where id = 'cg-02'`, 'caregiver_transitions: only the linked patient or the caregiver may end access');
  });
  it('POSITIVE: ناصر’s own pending-only session accepts cg-03 — the one path to active', async () => {
    const r = await accepts(app(S.naserPending), accept('cg-03'), `select status::text || '|' || iso_kw(accepted_at) from caregivers where id = 'cg-03'`);
    expect(r).toEqual({ count: 1, value: 'active|2026-09-21T09:15:00+03:00' });
  });
  it('an insert by a patient session is always pending and grants nothing (E-16)', async () => {
    // accepted_at is outside jurah_app's INSERT column grant (0005), so the grant refuses first…
    await rejects(app(S.hamad), ins('c8', '299999900001', 'active', ', accepted_at', ', jurah_now()'), 'permission denied for table caregivers');
    // …and a row the grant admits, but not `pending`, is refused by the insert policy (RLS WITH CHECK
    // runs before the caregivers_active_has_accepted CHECK).
    await rejects(app(S.hamad), ins('c8', '299999900001', 'active'), 'row-level security');
  });
});

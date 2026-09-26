/**
 * ENFORCEMENT.md — the invitation rows re-run against the P2-WP5 WRITES wherever a write is the
 * proving call: E-16 (inviteCaregiver), E-17 (acceptInvitation), E-19 (acceptInvitation on terminal
 * rows), E-20 (the read-time half at a later clock — the job half is WP6's route), E-22 (the pending-
 * only session against every write). Each titled by its id; against the REAL database (setup.ts
 * re-seeds and FAILS loudly without JURAH_DATABASE_URL). E-18, E-21, E-23 and E-24 have no write as
 * their proving call (signIn and the reads) and are proved in auth.test.ts / read-*.test.ts.
 * Also: the success paths of accept / decline / cancel / revoke / self-unlink, with their session rows.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as pg from '@/lib/data/pg';
import * as writes from '@/lib/data/pg/writes';
import * as R from '@/lib/data/refusals';
import { readSessionCookie } from '@/lib/session/cookie';
import { openSessionRows } from '@/lib/session/pg';
import { REFERENCE_NOW } from '@/lib/config';
import { SYSTEM, probe, rejects } from '../helpers';
import { ABDULLAH, DANA, HAMAD, KHALID, NASER_ACTIVE, NASER_PENDING, SARA, as, asJson, count, fingerprint, owner, reseed } from './_wp5';
import type { Session } from '@/types/views';

beforeEach(async () => { await reseed(); });

const status = (id: string) => owner<string>(`select status::text from caregivers where id = '${id}'`);

describe('G9 — the invitation gate, through the writes', () => {
  it('E-16', async () => {
    const created = await as(HAMAD, () => pg.inviteCaregiver('pt-01', { civilId: '292043000517', name: 'منى', relationship: 'قريبة' }));
    expect(created.status).toBe('pending');
    expect(created.id).toMatch(/^cg_[0-9A-Z]{26}$/);
    expect(await owner(`select status::text || '|' || coalesce(accepted_at::text, 'null') from caregivers where id = '${created.id}'`)).toBe('pending|null');
    // a forged caregiver session for the new row reads NOTHING of pt-01
    const forged: Session = { subjectId: created.id, role: 'caregiver', linkedPatientId: 'pt-01' };
    expect(await asJson(forged, () => pg.getPrescriptions('pt-01'))).toBe('[]');
    expect(await asJson(forged, () => pg.getDosesForDay('pt-01', '2026-09-21'))).toBe('[]');
    expect(await asJson(forged, () => pg.getPatient('pt-01'))).toBe('null');
    // the audit row: caregiver_invited, the NEUTRAL line although منى has an account (D-036), no Civil ID
    expect(await owner(`select message from audit_events where type = 'caregiver_invited' and related_id = '${created.id}'`)).toBe('دعوة مقدّم رعاية أُرسلت');
  });

  it('E-17', async () => {
    for (const s of [HAMAD, DANA, ABDULLAH, KHALID]) {
      const got = await asJson(s, () => pg.acceptInvitation('cg-03'));
      expect(got, s.subjectId).toBe(JSON.stringify(R.acceptRefusal(s))); // the caller's own session back
      expect(await status('cg-03'), s.subjectId).toBe('pending');
    }
    // the owner with a system GUC, a direct update: the trigger, not RLS, refuses
    await rejects(SYSTEM, `update caregivers set status = 'active', accepted_at = jurah_now() where id = 'cg-03'`, 'caregiver_transitions: only the invited civil id may accept');
    expect(await status('cg-03')).toBe('pending');
    // no SECURITY DEFINER function in the database writes caregivers (the migration grep, in the catalog)
    const writers = await owner<string | null>(`select string_agg(p.proname, ',') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.prosecdef and p.prosrc ~* '\\m(update|insert\\s+into)\\s+(public\\.)?caregivers\\M'`);
    expect(writers).toBeNull();
    expect(await owner<number>(`select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.prosecdef`)).toBeGreaterThanOrEqual(9); // the scan saw its input (9 since 0010 dropped invitation_masked_name, D-036)
    // positive control: ناصر's own pending-only session accepts — a new caregiver session, row active
    const next = await as(NASER_PENDING, () => pg.acceptInvitation('cg-03'));
    expect(JSON.stringify(next)).toBe('{"subjectId":"cg-03","role":"caregiver","linkedPatientId":"pt-01"}');
    expect(JSON.stringify(await readSessionCookie())).toBe(JSON.stringify(next)); // the cookie now carries it
    expect(await owner(`select status::text || '|' || iso_kw(accepted_at) from caregivers where id = 'cg-03'`)).toBe(`active|${REFERENCE_NOW}`);
    expect(await count(`select 1 from sessions where subject_id = 'cg-03' and role = 'caregiver' and linked_patient_id = 'pt-01' and revoked_at is null`)).toBe(1);
    expect(await owner(`select message || '|' || actor_role::text || '|' || actor_id from audit_events where type = 'caregiver_invite_accepted' and related_id = 'cg-03'`)).toBe('ناصر قبل الدعوة|caregiver|cg-03');
  });

  it('E-19', async () => {
    for (const id of ['cg-04', 'cg-05', 'cg-06', 'cg-07']) {
      const own: Session = { subjectId: id, pendingInvitationOnly: true };
      const before = await status(id);
      const got = await asJson(own, () => pg.acceptInvitation(id));
      expect(got, id).toBe(JSON.stringify(R.acceptRefusal(own)));
      expect(await status(id), id).toBe(before);
    }
    // the trigger's own words, for each, with the matching civil id and no RLS in the way
    const civil: Record<string, string> = { 'cg-04': '292043000517', 'cg-05': '277091900873', 'cg-06': '298052000731', 'cg-07': '285092200664' };
    for (const [id, c] of Object.entries(civil)) {
      await rejects({ role: 'owner', session: { subjectId: id, pendingInvitationOnly: true, civilId: c } },
        `update caregivers set status = 'active', accepted_at = jurah_now() where id = '${id}'`, 'is not an allowed transition');
    }
  });

  it('E-20', async () => {
    // read-time half: at 2026-10-03 cg-03 (expires 2026-10-02 20:10) is still stored `pending`, yet
    // acceptInvitation's exact statement under ناصر's own session raises, and so does the decline
    const at = '2026-10-03T09:15:00+03:00';
    const outcome = await probe({ role: 'jurah_app', session: { subjectId: 'cg-03', pendingInvitationOnly: true, civilId: '288110300229' } }, async (tx) => {
      await tx`select set_config('jurah.now', ${at}, true)`;
      const out: string[] = [];
      for (const q of [writes.PG_QUERIES_WRITES.acceptInvitation, writes.PG_QUERIES_WRITES.declineInvitation]) {
        try { await tx.unsafe(`savepoint s`); await tx.unsafe(q, ['cg-03']); out.push('ACCEPTED'); }
        catch (e) { out.push((e as Error).message); await tx.unsafe(`rollback to savepoint s`); }
      }
      return out;
    });
    expect(outcome).toEqual(['caregiver_transitions: the invitation has expired', 'caregiver_transitions: the invitation has expired']);
    expect(await status('cg-03')).toBe('pending');
    // and one second before expiry the same statement is accepted (the boundary)
    const boundary = await probe({ role: 'jurah_app', session: { subjectId: 'cg-03', pendingInvitationOnly: true, civilId: '288110300229' } }, async (tx) => {
      await tx`select set_config('jurah.now', '2026-10-02T20:09:59+03:00', true)`;
      return (await tx.unsafe(writes.PG_QUERIES_WRITES.acceptInvitation, ['cg-03'])).length;
    });
    expect(boundary).toBe(1);
  });

  it('E-22', async () => {
    // ناصر's pending-only session against every write that is not his own accept/decline: nothing changes
    const before = await fingerprint();
    const img = new Blob([new Uint8Array(500)]);
    const calls: [string, () => Promise<unknown>, unknown][] = [
      ['updatePatientPhone', () => pg.updatePatientPhone('pt-01', '1'), undefined],
      ['completeOnboarding', () => pg.completeOnboarding('pt-01'), undefined],
      ['updateSettings', () => pg.updateSettings('pt-01', { refillAlertsEnabled: false }), R.settingsRefusal('pt-01')],
      ['submitPrescriptionImage', () => pg.submitPrescriptionImage('pt-01', img), R.extractionRefusal()],
      ['savePrescriptionDraft', () => pg.savePrescriptionDraft('pt-01', 'draft-x'), R.draftSaveRefusal('pt-01')],
      ['requestRefill', () => pg.requestRefill('pt-01', 'rx-003'), R.refillRequestRefusal('pt-01', 'rx-003')],
      ['enableCalendarSync', () => pg.enableCalendarSync('pt-01'), R.enableCalendarSyncRefusal('pt-01')],
      ['requestPushPermission', () => pg.requestPushPermission({ subjectType: 'patient', subjectId: 'pt-01' }), R.requestPushPermissionRefusal({ subjectType: 'patient', subjectId: 'pt-01' })],
      ['disablePush', () => pg.disablePush({ subjectType: 'patient', subjectId: 'pt-01' }), undefined],
      ['startMessagingLink', () => pg.startMessagingLink({ subjectType: 'patient', subjectId: 'pt-01' }), R.startMessagingLinkRefusal({ subjectType: 'patient', subjectId: 'pt-01' })],
      ['disconnectMessaging', () => pg.disconnectMessaging({ subjectType: 'patient', subjectId: 'pt-01' }), undefined],
      ['inviteCaregiver', () => pg.inviteCaregiver('pt-01', { civilId: '292043000517', name: 'x', relationship: 'y' }), R.inviteRefusal('pt-01', { name: 'x', relationship: 'y' })],
      ['cancelInvitation(cg-03 — his own!)', () => pg.cancelInvitation('cg-03'), undefined],
      ['revokeCaregiver', () => pg.revokeCaregiver('cg-01'), undefined],
      ['selfUnlink', () => pg.selfUnlink('cg-01'), undefined],
      ['submitReviewDecision', () => pg.submitReviewDecision('ia-001', 'cleared', 'x'), undefined],
      ['confirmPrescriptionFields', () => pg.confirmPrescriptionFields('rx-006', { frequencyPerDay: 1 }), R.prescriptionWriteRefusal('rx-006')],
      ['returnPrescriptionToClinic', () => pg.returnPrescriptionToClinic('rx-007', 'x'), R.prescriptionWriteRefusal('rx-007')],
      ['acceptInvitation(cg-08 — not his)', () => pg.acceptInvitation('cg-08'), R.acceptRefusal(NASER_PENDING)],
      ['declineInvitation(cg-08 — not his)', () => pg.declineInvitation('cg-08'), undefined],
    ];
    for (const [name, call, want] of calls) {
      expect(await asJson(NASER_PENDING, call), name).toBe(want === undefined ? 'undefined' : JSON.stringify(want));
    }
    expect(await fingerprint()).toBe(before);
  });
});

describe('the lifecycle writes — success paths and their session rows', () => {
  it('declineInvitation as ناصر (pending-only): declined and the cookie cleared (a script session has no sessions row to revoke; the sid path is WP2\'s revokeSessionRow)', async () => {
    await as(NASER_PENDING, () => pg.declineInvitation('cg-03'));
    expect(await owner(`select status::text || '|' || iso_kw(declined_at) from caregivers where id = 'cg-03'`)).toBe(`declined|${REFERENCE_NOW}`);
    expect(await readSessionCookie()).toBeNull();
    expect(await owner(`select message from audit_events where type = 'caregiver_invite_declined' and related_id = 'cg-03'`)).toBe('ناصر رفضت الدعوة');
  });
  it('declineInvitation(cg-08) as سارة (her patient session): declined; her session is NOT cleared', async () => {
    await as(SARA, () => pg.declineInvitation('cg-08'));
    expect(await status('cg-08')).toBe('declined');
    expect(JSON.stringify(await readSessionCookie())).toBe(JSON.stringify(SARA));
    expect(await owner(`select message || '|' || actor_id from audit_events where type = 'caregiver_invite_declined' and related_id = 'cg-08'`)).toBe('سارة رفضت الدعوة|cg-08');
  });
  it('cancelInvitation(cg-03) as حمد: revoked, never accepted; actor has no id (the mock)', async () => {
    await as(HAMAD, () => pg.cancelInvitation('cg-03'));
    expect(await owner(`select status::text || '|' || coalesce(accepted_at::text, 'null') || '|' || iso_kw(revoked_at) from caregivers where id = 'cg-03'`)).toBe(`revoked|null|${REFERENCE_NOW}`);
    expect(await owner(`select message || '|' || actor_role::text || '|' || coalesce(actor_id, 'null') from audit_events where type = 'caregiver_invite_cancelled' and related_id = 'cg-03'`)).toBe('أُلغيت دعوة ناصر|patient|null');
    // cancelling an ACTIVE row is not a cancel (the mock's precondition): cg-01 untouched
    await as(HAMAD, () => pg.cancelInvitation('cg-01'));
    expect(await status('cg-01')).toBe('active');
  });
  it('revokeCaregiver(cg-01) as حمد: revoked, accepted_at kept, every live cg-01 session row revoked', async () => {
    await openSessionRows([ABDULLAH, ABDULLAH]); // two live rows, as two sign-ins would leave
    expect(await count(`select 1 from sessions where subject_id = 'cg-01' and revoked_at is null`)).toBe(2);
    await as(HAMAD, () => pg.revokeCaregiver('cg-01'));
    expect(await owner(`select status::text || '|' || iso_kw(accepted_at) || '|' || iso_kw(revoked_at) from caregivers where id = 'cg-01'`)).toBe(`revoked|2026-09-03T18:20:00+03:00|${REFERENCE_NOW}`);
    expect(await count(`select 1 from sessions where subject_id = 'cg-01' and revoked_at is null`)).toBe(0);
    expect(await owner(`select message from audit_events where type = 'caregiver_revoked' and related_id = 'cg-01'`)).toBe('سُحبت صلاحية عبدالله');
    // the caregiver itself cannot use revokeCaregiver on its own row (that is selfUnlink)
    await reseed();
    await as(ABDULLAH, () => pg.revokeCaregiver('cg-01'));
    expect(await status('cg-01')).toBe('active');
  });
  it('selfUnlink(cg-03) as the freshly accepted ناصر: revoked, own sessions revoked, cookie cleared', async () => {
    const next = await as(NASER_PENDING, () => pg.acceptInvitation('cg-03'));
    expect(next).toEqual(NASER_ACTIVE);
    await as(NASER_ACTIVE, () => pg.selfUnlink('cg-03'));
    expect(await status('cg-03')).toBe('revoked');
    expect(await count(`select 1 from sessions where subject_id = 'cg-03' and revoked_at is null`)).toBe(0);
    expect(await readSessionCookie()).toBeNull();
    expect(await owner(`select message from audit_events where type = 'caregiver_self_unlinked' and related_id = 'cg-03'`)).toBe('ناصر ألغى ربط نفسه');
  });
});

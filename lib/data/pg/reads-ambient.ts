/**
 * Postgres implementation — patient, settings, caregivers, activity, audit log, notifications reads
 * and snapshot. Owned by package WP3d (lead split at Gate 1). Every function runs inside
 * withSession(); RLS/guard triggers refuse; zero rows → the mock's refusal shape
 * (lib/data/refusals/reads-ambient.ts, D-022); projections through lib/data/shapes/reads-ambient.ts
 * (key order). Reads never write (E-48) — the one exception is getPatient's per-subject snapshot
 * (API-SURFACE; not an audit row). No append() anywhere in this file.
 *
 * Where RLS alone would let MORE through than the mock (caregivers_select also shows a Civil ID its
 * own rows; links_select/push_select also admit the system actor), the query adds the mock's own
 * caller condition to its WHERE clause, in the database, so the refusal is still a zero-row result.
 */
import type { DataApi } from '../api';
import { sessionOf } from './_shared';
import { withSession } from '@/lib/db/withSession';
import {
  activityRefusal,
  auditLogRefusal,
  caregiverLinkRefusal,
  caregiversRefusal,
  invitationRefusal,
  messagingLinkRefusal,
  patientRefusal,
  pendingInvitationsRefusal,
  pushStateRefusal,
  settingsRefusal,
  snapshotRefusal,
} from '../refusals/reads-ambient';
import {
  toAuditEvent,
  toAuditLogRow,
  toCaregiverLink,
  toCaregiverView,
  toInvitationSummary,
  toMessagingLink,
  toPatientView,
  toPushSubscription,
  toSettings,
  toSnapshot,
} from '../shapes/reads-ambient';

/** The read-time expiry fold (E-20; lib/schedule/expiry.ts's rule in SQL): a `pending` row whose
 * expires_at is at or before jurah_now() reads as `expired`; every other status is returned as is. */
const FOLDED_STATUS = `case when c.status = 'pending' and c.expires_at <= jurah_now() then 'expired' else c.status::text end`;

/** The seam's audit-row columns (shared by getActivity and getAuditLog). */
const AUDIT_COLUMNS = `id, scope::text as scope, patient_id, actor_role::text as actor_role, actor_id, type::text as type,
           message, iso_kw(created_at) as created_at, related_id`;

/** Parameterised ($1…). Every timestamp through iso_kw(), every date to_char, every numeric ::float8.
 * civil_id, telegram_chat_id, chat_id, endpoint/p256dh/auth are never selected (outside jurah_app's
 * column grants). Newest first; equal created_at keeps INSERTION order (seq asc) — the mock's stable
 * sort, which is what tests/fixtures/shapes.json records for the same-second live rows (see
 * docs/backend-notes/p2-wp3d.md §Divergences, WP3d-1). */
export const PG_QUERIES_AMBIENT = {
  getPatient: `
    select p.id, p.name, p.language::text as language, p.onboarding_completed,
           caregiver_ids_for_patient(p.id) as caregiver_ids, p.phone, iso_kw(p.telegram_linked_at) as telegram_linked_at
    from patients p
    where p.id = $1`,
  recordSnapshot: `
    insert into snapshots (subject_id, key, data, as_of) values ($1, $2, $3::json, jurah_now())
    on conflict (subject_id, key) do update set data = excluded.data, as_of = excluded.as_of`,
  getSettings: `
    select patient_id, adherence_check_in_enabled, adherence_check_in_frequency::text as adherence_check_in_frequency,
           refill_alerts_enabled, calendar_sync_enabled, web_push_enabled,
           notification_channel::text as notification_channel, language::text as language
    from settings
    where patient_id = $1`,
  // Consent data only for the invited Civil ID's own session (E-24). Status folds read-time expiry (E-20).
  getInvitationForConsent: `
    select c.id, invitation_patient_first_name(c.id) as patient_first_name, c.relationship,
           ${FOLDED_STATUS} as status,
           iso_kw(c.expires_at) as expires_at
    from caregivers c
    where c.id = $1 and c.civil_id = jurah_session()->>'civilId'`,
  // RLS audit_select: scope 'patient' and can_read_patient(patient_id).
  getActivity: `
    select ${AUDIT_COLUMNS}
    from audit_events
    where scope = 'patient' and patient_id = $1
    order by created_at desc, seq asc`,
  // CR-047: the admin's one window; the view itself returns no row unless jurah_session_is('admin').
  // from/to compare the Kuwait ISO TEXT byte-wise (collate "C"), exactly as the mock's string
  // comparison does — X1 passes a bare 'YYYY-MM-DD' `from` (features/clinic/format.ts).
  getAuditLog: `
    select ${AUDIT_COLUMNS}, patient_masked_name
    from audit_log_admin
    where ($1::text is null or actor_role::text = $1)
      and ($2::text is null or type::text = $2)
      and ($3::text is null or iso_kw(created_at) collate "C" >= $3::text collate "C")
      and ($4::text is null or iso_kw(created_at) collate "C" <= $4::text collate "C")
    order by created_at desc, seq asc`,
  // The patient's own list only (the mock's `s.role === 'patient' && s.subjectId === patientId`):
  // caregivers_select would also show a caregiver session its OWN row, so the caller is in the WHERE.
  getCaregivers: `
    select c.id, c.name, c.relationship, c.phone, c.linked_patient_id, ${FOLDED_STATUS} as status,
           iso_kw(c.invited_at) as invited_at, iso_kw(c.expires_at) as expires_at, iso_kw(c.accepted_at) as accepted_at,
           iso_kw(c.declined_at) as declined_at, iso_kw(c.revoked_at) as revoked_at, c.access_level
    from caregivers c
    where c.linked_patient_id = $1
      and jurah_session_is('patient') and c.linked_patient_id = jurah_session()->>'subjectId'
    order by c.seq`,
  // A role session: every pending, unexpired invitation addressed to its Civil ID. A pending-only
  // session: its one row (the mock's caregiverById(s.subjectId)). No session → civilId NULL → none.
  getPendingInvitationsForSubject: `
    select c.id, invitation_patient_first_name(c.id) as patient_first_name, c.relationship, c.status::text as status,
           iso_kw(c.expires_at) as expires_at
    from caregivers c
    where c.civil_id = jurah_session()->>'civilId'
      and c.status = 'pending' and c.expires_at > jurah_now()
      and (jurah_session()->>'role' is not null or coalesce((jurah_session()->>'pendingInvitationOnly')::boolean, false))
      and (not coalesce((jurah_session()->>'pendingInvitationOnly')::boolean, false) or c.id = jurah_session()->>'subjectId')
    order by c.seq`,
  // The caregiver's own ACTIVE row only (API-SURFACE; E-21) — the mock checks role and id, not status.
  getCaregiverLink: `
    select c.linked_patient_id as patient_id, invitation_patient_first_name(c.id) as patient_first_name,
           iso_kw(c.accepted_at) as accepted_at
    from caregivers c
    where c.id = $1 and c.status = 'active'
      and jurah_session_is('caregiver') and c.id = jurah_session()->>'subjectId'`,
  // The mock's isSelf(): the session's role IS the subject type and its subjectId IS the subject.
  getPushState: `
    select id, subject_type::text as subject_type, subject_id, status::text as status, permission::text as permission,
           iso_kw(created_at) as created_at
    from push_subscriptions_view
    where subject_type::text = $1 and subject_id = $2
      and jurah_session()->>'role' = $1 and jurah_session()->>'subjectId' = $2`,
  // The most recently created row (seq desc); linkToken only while the row is `pending` (CR-048).
  // Token expiry is the webhook's to enforce (E-43, WP6) — this read folds nothing (see p2-wp3d.md CR 3).
  getMessagingLink: `
    select id, subject_type::text as subject_type, subject_id, channel::text as channel, status::text as status,
           case when status = 'pending' then link_token end as link_token,
           iso_kw(connected_at) as connected_at
    from messaging_links
    where subject_type::text = $1 and subject_id = $2
      and jurah_session()->>'role' = $1 and jurah_session()->>'subjectId' = $2
    order by seq desc
    limit 1`,
  // Scoped to the caller (D-014, E-40): the snapshots_own policy and this WHERE both say so.
  readLastKnownSnapshot: `
    select data, iso_kw(as_of) as as_of
    from snapshots
    where subject_id = jurah_session()->>'subjectId' and key = $1`,
} as const;

export const getPatient: DataApi['getPatient'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.getPatient, [patientId]);
    if (!row) return patientRefusal();
    const view = toPatientView(row);
    // API-SURFACE: the last-known snapshot, scoped to the caller (D-014, snapshots_own policy), a
    // SERIALISED copy (D-5 — the mock aliases the live object).
    if (session) await sql.unsafe(PG_QUERIES_AMBIENT.recordSnapshot, [session.subjectId, `getPatient:${patientId}`, view]);
    return view;
  });
};

/** No row (بدر) → the documented defaults, and NOTHING is written (a read never writes). */
export const getSettings: DataApi['getSettings'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.getSettings, [patientId]);
    return row ? toSettings(row) : settingsRefusal(patientId);
  });
};

export const getInvitationForConsent: DataApi['getInvitationForConsent'] = async (invitationId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.getInvitationForConsent, [invitationId]);
    return row ? toInvitationSummary(row) : invitationRefusal(invitationId);
  });
};

export const getActivity: DataApi['getActivity'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_AMBIENT.getActivity, [patientId]);
    return rows.length === 0 ? activityRefusal() : rows.map((r) => toAuditEvent(r));
  });
};

/** An empty-string filter is "no filter", as the mock's `!filters.x`. */
const filterParam = (v: string | undefined): string | null => (v ? v : null);

export const getAuditLog: DataApi['getAuditLog'] = async (filters) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_AMBIENT.getAuditLog, [
      filterParam(filters.actorRole), filterParam(filters.type), filterParam(filters.from), filterParam(filters.to),
    ]);
    return rows.length === 0 ? auditLogRefusal() : rows.map((r) => toAuditLogRow(r));
  });
};

export const getCaregivers: DataApi['getCaregivers'] = async (patientId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_AMBIENT.getCaregivers, [patientId]);
    return rows.length === 0 ? caregiversRefusal() : rows.map((r) => toCaregiverView(r));
  });
};

export const getPendingInvitationsForSubject: DataApi['getPendingInvitationsForSubject'] = async () => {
  const session = await sessionOf();
  if (!session) return pendingInvitationsRefusal();
  return withSession(session, async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_AMBIENT.getPendingInvitationsForSubject, []);
    return rows.length === 0 ? pendingInvitationsRefusal() : rows.map((r) => toInvitationSummary(r));
  });
};

export const getCaregiverLink: DataApi['getCaregiverLink'] = async (caregiverId) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.getCaregiverLink, [caregiverId]);
    return row ? toCaregiverLink(row) : caregiverLinkRefusal();
  });
};

/** Constant (API-SURFACE): real detection is client-side and the frontend is frozen. No table. */
export const getPushCapability: DataApi['getPushCapability'] = async () => ({ supported: true, iosNeedsInstall: false });

export const getPushState: DataApi['getPushState'] = async (subject) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.getPushState, [subject.subjectType, subject.subjectId]);
    return row ? toPushSubscription(row) : pushStateRefusal();
  });
};

export const getMessagingLink: DataApi['getMessagingLink'] = async (subject) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.getMessagingLink, [subject.subjectType, subject.subjectId]);
    return row ? toMessagingLink(row) : messagingLinkRefusal(subject);
  });
};

export const readLastKnownSnapshot: DataApi['readLastKnownSnapshot'] = async (key) => {
  const session = await sessionOf();
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_AMBIENT.readLastKnownSnapshot, [key]);
    return row ? toSnapshot(row) : snapshotRefusal();
  });
};

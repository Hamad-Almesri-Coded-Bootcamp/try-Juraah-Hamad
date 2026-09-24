/**
 * Postgres implementation — the write paths. Owned by package WP5 (docs/briefs/P2-WP5.md).
 *
 * Every statement runs inside withSession() under the caller's VERIFIED session (D-017); the
 * database does the refusing — RLS (a refused write matches 0 rows, p2-wp1 §3.10), the guard
 * triggers (caregiver_transitions, refill_routing, alert_review_once,
 * prescription_clinical_fields_locked, settings_tracking_requires_link) and the named checks.
 * The seam then returns the MOCK's refusal shape (lib/data/refusals/writes.ts, D-022) — a refusal
 * is never a throw, because a throw reaches error.tsx. Only a genuine bug (EngineInvariantError, a
 * lost connection) is re-thrown. Successful writes project through lib/data/shapes/writes.ts in the
 * mock's key order; every audit row goes through lib/db/audit.ts append() with the mock's type,
 * actor, message and relatedId.
 *
 * WHERE clauses carry the mock's own CALLER conditions only where a trigger edge would otherwise
 * admit MORE than the mock does (revokeCaregiver: the active→revoked edge also admits the caregiver
 * itself, which is selfUnlink's job; selfUnlink/cancel/revoke: the mock's status precondition, so
 * the audit type stays right). Everywhere else the trigger or RLS is the thing that refuses.
 *
 * G1: no statement in this file names doses.status. The one dose write is confirmPrescriptionFields'
 * regeneration, through lib/engine's regenerateUpcoming (deletes and inserts `upcoming` rows only),
 * called BEFORE the confirming update (D-033).
 */
import type { DataApi } from '../api';
import type { Prescription, RefillRequest } from '@/types/contracts';
import type { PermittedSettingsPatch, Session } from '@/types/views';
import { sessionOf } from './_shared';
import { withSession, type Tx } from '@/lib/db/withSession';
import { append } from '@/lib/db/audit';
import { newId } from '@/lib/db/ids';
import { loadPrescription, regenerateUpcoming } from '@/lib/engine';
import { screenOrHold } from './screening';
import { clearSessionCookie, readSessionClaims, writeSessionCookie } from '@/lib/session/cookie';
import { insertSessionRow, revokeSessionRow } from '@/lib/session/pg';
import { canonicalSession } from '@/lib/session/verify';
import { addDays } from '@/lib/schedule/dates';
import { settingsRefusal } from '../refusals/reads-ambient';
import {
  acceptRefusal,
  inviteRefusal,
  maskedNameRefusal,
  prescriptionWriteRefusal,
  refillRequestRefusal,
  voidRefusal,
} from '../refusals/writes';
import { toSettings } from '../shapes/reads-ambient';
import {
  confirmedDrug,
  firstName,
  inPlace,
  pickConfirmedFields,
  toInvitedCaregiver,
  toRefillRequestWrite,
  toSettingsWrite,
  type ConfirmedFields,
} from '../shapes/writes';

// ---------------------------------------------------------------------------------------------
// The SQL — parameterised text, exported so a gate proof can run the very same statement through
// the MCP connector (docs/backend-notes/p2-wp5.md §4).
// ---------------------------------------------------------------------------------------------
const SETTINGS_COLUMNS = `patient_id, adherence_check_in_enabled, adherence_check_in_frequency::text as adherence_check_in_frequency,
           refill_alerts_enabled, calendar_sync_enabled, web_push_enabled,
           notification_channel::text as notification_channel, language::text as language`;

const CAREGIVER_VIEW_COLUMNS = `id, name, relationship, linked_patient_id, status::text as status,
           iso_kw(invited_at) as invited_at, iso_kw(expires_at) as expires_at, access_level`;

/** A pending-only session may act only on ITS OWN invitation (the mock's `s.subjectId === invitationId`). */
const OWN_INVITATION = `(not coalesce((jurah_session()->>'pendingInvitationOnly')::boolean, false) or id = jurah_session()->>'subjectId')`;

export const PG_QUERIES_WRITES = {
  // RLS patients_update_own: the patient's own row only; anyone else matches 0 rows.
  updatePatientPhone: `update patients set phone = $2 where id = $1`,
  completeOnboarding: `update patients set onboarding_completed = true where id = $1`,
  selectSettings: `select ${SETTINGS_COLUMNS} from settings where patient_id = $1`,
  // updateSettings' upsert is built per call from the whitelisted keys (settingsUpsert below).
  // requestRefill — routed_to is NOT NULL, so a placeholder is supplied; the refill_routing
  // trigger OVERWRITES it from the prescription's own sector (and raises on a foreign or inactive
  // prescription). RLS refills_insert_own: the patient's own session only.
  insertRefill: `
    insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status)
    values ($1, $2, $3, jurah_now(), 'public_pharmacy', 'requested')
    returning id, patient_id, prescription_id, iso_kw(requested_at) as requested_at, routed_to::text as routed_to, status::text as status`,
  genericName: `select generic_name from prescriptions where id = $1`,
  // lookupMaskedName — migration 0009's definer: audit row, rate limit, one plan on every branch.
  lookupMaskedName: `select lookup_masked_name($1, $2) as masked_name`,
  // inviteCaregiver — RLS caregivers_insert_by_patient: the patient's own session, status pending.
  insertInvitation: `
    insert into caregivers (id, civil_id, name, relationship, linked_patient_id, status, invited_at, expires_at, access_level)
    values ($1, $2, $3, $4, $5, 'pending', jurah_now(), jurah_now() + interval '14 days', 'read_only')
    returning ${CAREGIVER_VIEW_COLUMNS}`,
  // cancelInvitation — the pending→revoked edge; caregiver_transitions admits only the inviting patient.
  cancelInvitation: `
    update caregivers set status = 'revoked', revoked_at = jurah_now()
    where id = $1 and status = 'pending'
    returning id, linked_patient_id, name`,
  // revokeCaregiver — the active→revoked edge. The trigger also admits the caregiver ITSELF on this
  // edge (that is selfUnlink), so the mock's caller condition — a patient session — is stated here.
  revokeCaregiver: `
    update caregivers set status = 'revoked', revoked_at = jurah_now()
    where id = $1 and status = 'active' and jurah_session_is('patient')
    returning id, linked_patient_id, name`,
  // Every live session of that caregiver (sessions_update_own admits the linked patient, 0007).
  revokeCaregiverSessions: `update sessions set revoked_at = jurah_now() where subject_id = $1 and revoked_at is null`,
  // acceptInvitation — NO status filter: caregiver_transitions is the enforcement (only the invited
  // Civil ID's own session, pending, unexpired; every other edge raises). RLS hides the row from a
  // session that is neither the inviting patient nor the invited Civil ID (0 rows).
  acceptInvitation: `
    update caregivers set status = 'active', accepted_at = jurah_now()
    where id = $1 and ${OWN_INVITATION}
    returning id, linked_patient_id, name`,
  declineInvitation: `
    update caregivers set status = 'declined', declined_at = jurah_now()
    where id = $1 and ${OWN_INVITATION}
    returning id, linked_patient_id, name`,
  // selfUnlink — the caregiver's own ACTIVE row, by its own caregiver session (the mock's check).
  selfUnlink: `
    update caregivers set status = 'revoked', revoked_at = jurah_now()
    where id = $1 and status = 'active' and jurah_session_is('caregiver') and id = jurah_session()->>'subjectId'
    returning id, linked_patient_id, name`,
  // submitReviewDecision — alert_review_once is the one-shot (a second decision raises where the row
  // is visible; RLS hides a decided alert from the reviewer otherwise → 0 rows). No RETURNING: the
  // decided row may no longer be visible to the reviewer (see §3 of the fragment).
  alertPatient: `select patient_id from interaction_alerts where id = $1`,
  submitReviewDecision: `
    update interaction_alerts
    set review_status = 'reviewed', reviewer_decision = $2::reviewer_decision_t, reviewer_note = $3,
        reviewed_at = jurah_now(), reviewed_by = jurah_session()->>'subjectId'
    where id = $1`,
  reviewerContext: `select jurah_session_is('reviewer') as reviewer, jurah_session()->>'subjectId' as subject_id, iso_kw(jurah_now()) as now`,
  trackingFor: `select adherence_check_in_enabled from settings where patient_id = $1`,
  // confirmPrescriptionFields — the five CR-002 values, and the review fields, in ONE statement:
  // prescription_clinical_fields_locked admits a clinical change only on a reviewer's
  // pending → confirmed. No status filter: the trigger's one-shot is the refusal. No RETURNING (P8).
  confirmPrescriptionFields: `
    update prescriptions
    set brand_name = $2::text, strength_mg = $3::numeric, frequency_per_day = $4::int, start_date = $5::date,
        dose_times = case when $6::jsonb is null then null else array(select jsonb_array_elements_text($6::jsonb)) end,
        needs_review = false, field_review_status = 'confirmed',
        field_reviewed_by = jurah_session()->>'subjectId', field_reviewed_at = jurah_now(), field_review_note = $7::text
    where id = $1`,
  // returnPrescriptionToClinic — needs_review is NOT touched: it stays true, so the returned row
  // stays visible in the reviewer's queue (D-39). One-shot by the same trigger.
  returnPrescriptionToClinic: `
    update prescriptions
    set field_review_status = 'returned', field_review_note = $2::text,
        field_reviewed_by = jurah_session()->>'subjectId', field_reviewed_at = jurah_now()
    where id = $1`,
} as const;

/** The seven permitted Settings keys → column and cast (Feature Toggle Policy; E-11). */
const SETTINGS_KEYS = {
  adherenceCheckInEnabled: ['adherence_check_in_enabled', 'boolean'],
  adherenceCheckInFrequency: ['adherence_check_in_frequency', 'checkin_freq_t'],
  refillAlertsEnabled: ['refill_alerts_enabled', 'boolean'],
  calendarSyncEnabled: ['calendar_sync_enabled', 'boolean'],
  webPushEnabled: ['web_push_enabled', 'boolean'],
  notificationChannel: ['notification_channel', 'channel_t'],
  language: ['language', 'language_t'],
} as const satisfies Record<keyof PermittedSettingsPatch, readonly [string, string]>;

type SettingsKey = keyof typeof SETTINGS_KEYS;

/** The seam whitelist: own keys of `patch` that are one of the seven, in the patch's order. */
export function permittedSettingsKeys(patch: unknown): SettingsKey[] {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return [];
  return Object.keys(patch).filter(
    (k): k is SettingsKey => Object.prototype.hasOwnProperty.call(SETTINGS_KEYS, k) && (patch as Record<string, unknown>)[k] !== undefined,
  );
}

/**
 * The upsert for the whitelisted keys. The INSERT…SELECT's WHERE is the owner condition (0 rows,
 * quietly, for anyone else — RLS settings_insert_own/settings_update_own stand behind it). With no
 * key, a no-op `language = settings.language` keeps RETURNING non-empty for the owner. Column
 * names come only from SETTINGS_KEYS (never from the caller); values are parameters.
 */
export function settingsUpsert(keys: SettingsKey[]): string {
  const cols = keys.map((k) => SETTINGS_KEYS[k][0]);
  const vals = keys.map((k, i) => `$${i + 2}::${SETTINGS_KEYS[k][1]}`);
  const set = cols.length ? cols.map((c) => `${c} = excluded.${c}`).join(', ') : 'language = settings.language';
  return `
    insert into settings (patient_id${cols.map((c) => `, ${c}`).join('')})
    select $1${vals.map((v) => `, ${v}`).join('')}
    where jurah_session_is('patient') and jurah_session()->>'subjectId' = $1
    on conflict (patient_id) do update set ${set}
    returning ${SETTINGS_COLUMNS}`;
}

// ---------------------------------------------------------------------------------------------
// Refusal mapping
// ---------------------------------------------------------------------------------------------

/** Thrown inside a transaction to roll it back when a write matched 0 rows after an earlier
 * statement already wrote (confirmPrescriptionFields' regeneration). Always mapped to a refusal. */
class Refused extends Error {
  constructor(readonly why: string) {
    super(`refused: ${why}`);
    this.name = 'Refused';
  }
}

/** The guard triggers' raise prefixes (0004: '<trigger_name>: <reason>'). */
const GUARD_PREFIXES = [
  'caregiver_transitions:',
  'refill_routing:',
  'alert_review_once:',
  'prescription_clinical_fields_locked:',
  'link_caregiver_must_be_active:',
];

/**
 * A database refusal → true: RLS / missing grant (42501), a guard trigger's raise (P0001 with a
 * known prefix), an integrity rule (23xxx: a named check such as rx_cr002_invariant_1,
 * caregivers_civil_id_shape, audit_message_no_civil_id; a foreign key; not-null), a value the
 * column cannot hold (22xxx: an unknown enum word, a malformed date). Anything else — an engine
 * invariant, a lost connection — is a bug and is re-thrown.
 */
export function isRefusal(e: unknown): boolean {
  if (e instanceof Refused) return true;
  const err = e as { code?: unknown; message?: unknown } | null;
  const code = typeof err?.code === 'string' ? err.code : '';
  const message = typeof err?.message === 'string' ? err.message : '';
  if (code === '42501') return true;
  if (code === 'P0001') return GUARD_PREFIXES.some((p) => message.startsWith(p));
  return code.startsWith('23') || code.startsWith('22');
}

async function refusedAs<T>(write: () => Promise<T>, refusal: () => T | Promise<T>): Promise<T> {
  try {
    return await write();
  } catch (e) {
    if (isRefusal(e)) return refusal();
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// Patient and settings
// ---------------------------------------------------------------------------------------------

export const updatePatientPhone: DataApi['updatePatientPhone'] = async (patientId, phone) => {
  const session = await sessionOf();
  return refusedAs(async () => {
    await withSession(session, (sql) => sql.unsafe(PG_QUERIES_WRITES.updatePatientPhone, [patientId, phone ?? null]));
    return voidRefusal(); // void either way (the mock's shape)
  }, voidRefusal);
};

export const completeOnboarding: DataApi['completeOnboarding'] = async (patientId) => {
  const session = await sessionOf();
  return refusedAs(async () => {
    await withSession(session, (sql) => sql.unsafe(PG_QUERIES_WRITES.completeOnboarding, [patientId]));
    return voidRefusal();
  }, voidRefusal);
};

/** The mock's refusal for updateSettings: the CURRENT row (`settingsFor`) — here, as far as the
 * caller may read it (RLS settings_select); otherwise the documented defaults. */
async function currentSettings(session: Session | null, patientId: string) {
  return refusedAs(
    () => withSession(session, async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_WRITES.selectSettings, [patientId]);
      return row ? toSettings(row) : settingsRefusal(patientId);
    }),
    () => settingsRefusal(patientId),
  );
}

export const updateSettings: DataApi['updateSettings'] = async (patientId, patch) => {
  const session = await sessionOf();
  const keys = permittedSettingsKeys(patch);
  const values = keys.map((k) => (patch as Record<string, unknown>)[k]);
  return refusedAs(
    () => withSession(session, async (sql) => {
      const [before] = await sql.unsafe(PG_QUERIES_WRITES.selectSettings, [patientId]);
      const [after] = await sql.unsafe(settingsUpsert(keys), [patientId, ...(values as never[])]);
      if (!after) return before ? toSettings(before) : settingsRefusal(patientId); // not the owner: nothing written
      // The flag as OBSERVED in the database — settings_tracking_requires_link resets a refused
      // `true` quietly (G10), so an audit row is written only for a real flip (E-09).
      const was = before ? Boolean(before.adherence_check_in_enabled) : false;
      const now = Boolean(after.adherence_check_in_enabled);
      if (was !== now) {
        await append(sql, {
          scope: 'patient', patientId, actor: { role: 'patient', id: patientId },
          type: now ? 'tracking_enabled' : 'tracking_disabled',
          message: now ? 'تفعيل متابعة الجرعات' : 'إيقاف متابعة الجرعات', relatedId: patientId,
        });
      }
      return toSettingsWrite(after, !before);
    }),
    () => currentSettings(session, patientId),
  );
};

// ---------------------------------------------------------------------------------------------
// Supply
// ---------------------------------------------------------------------------------------------

/**
 * D10 / CR-082 (AP-10): a refill passes through screening. After the request has COMMITTED, the
 * refilled prescription's pairs are screened again (./screening.ts screenOrHold: handed to the
 * agent, or held for a specialist when n8n does not accept it). A refused request screens nothing;
 * a flagged prescription is skipped (its reviewer's confirmation screens it).
 */
export const requestRefill: DataApi['requestRefill'] = async (patientId, prescriptionId) => {
  const session = await sessionOf();
  // `refilled` is non-null only from a transaction that COMMITTED the request: a refusal (0 rows,
  // or the refill_routing trigger raising) carries null, and nothing is screened.
  const refused = (): { request: RefillRequest; refilled: Prescription | null } => ({
    request: refillRequestRefusal(patientId, prescriptionId),
    refilled: null,
  });
  const { request, refilled } = await refusedAs(
    () => withSession(session, async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_WRITES.insertRefill, [newId('rf'), patientId, prescriptionId]);
      if (!row) return refused();
      const [rx] = await sql.unsafe(PG_QUERIES_WRITES.genericName, [prescriptionId]);
      await append(sql, {
        scope: 'patient', patientId, actor: { role: 'patient', id: patientId }, type: 'refill_requested',
        message: `طلب تعبئة ${String(rx?.generic_name ?? '')}`, relatedId: String(row.id),
      });
      return { request: toRefillRequestWrite(row), refilled: await loadPrescription(sql, prescriptionId) };
    }),
    refused,
  );
  if (refilled) await screenOrHold(patientId, refilled);
  return request;
};

// ---------------------------------------------------------------------------------------------
// Caregivers, patient side
// ---------------------------------------------------------------------------------------------

/**
 * Session required (E-14): no verified session → the null shape, no transaction, nothing to audit
 * against. Otherwise ONE statement for every Civil ID (0009's lookup_masked_name): audit row, rate
 * limit, account query — and the response is built by the same expression on both branches (E-13).
 * The rate limit is keyed by the verified cookie's `sid` (a trusted script session has none; it is
 * keyed by its subject instead — script context only, see the fragment).
 */
export const lookupMaskedName: DataApi['lookupMaskedName'] = async (civilId) => {
  const claims = await readSessionClaims();
  if (!claims) return maskedNameRefusal();
  const sessionKey = claims.sid ?? `script:${claims.session.subjectId}`;
  return refusedAs(
    () => withSession(claims.session, async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_WRITES.lookupMaskedName, [String(civilId ?? ''), sessionKey]);
      const masked = row?.masked_name;
      return { maskedName: typeof masked === 'string' ? masked : null };
    }),
    maskedNameRefusal,
  );
};

export const inviteCaregiver: DataApi['inviteCaregiver'] = async (patientId, input) => {
  const session = await sessionOf();
  return refusedAs(
    () => withSession(session, async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_WRITES.insertInvitation, [
        newId('cg'), input.civilId, input.name, input.relationship, patientId,
      ]);
      if (!row) return inviteRefusal(patientId, input);
      // D-036: the neutral line in EVERY case (the mock's bytes). Naming the invitee when an account
      // exists would turn the patient's activity feed into an account oracle with no rate limit.
      await append(sql, {
        scope: 'patient', patientId, actor: { role: 'patient', id: patientId }, type: 'caregiver_invited',
        message: 'دعوة مقدّم رعاية أُرسلت', relatedId: String(row.id),
      });
      return toInvitedCaregiver(row);
    }),
    () => inviteRefusal(patientId, input),
  );
};

export const cancelInvitation: DataApi['cancelInvitation'] = async (caregiverId) => {
  const session = await sessionOf();
  return refusedAs(async () => {
    await withSession(session, async (sql) => {
      const [c] = await sql.unsafe(PG_QUERIES_WRITES.cancelInvitation, [caregiverId]);
      if (!c) return;
      await append(sql, {
        scope: 'patient', patientId: String(c.linked_patient_id), actor: { role: 'patient' }, type: 'caregiver_invite_cancelled',
        message: `أُلغيت دعوة ${firstName(c.name)}`, relatedId: String(c.id),
      });
    });
    return voidRefusal();
  }, voidRefusal);
};

export const revokeCaregiver: DataApi['revokeCaregiver'] = async (caregiverId) => {
  const session = await sessionOf();
  return refusedAs(async () => {
    await withSession(session, async (sql) => {
      const [c] = await sql.unsafe(PG_QUERIES_WRITES.revokeCaregiver, [caregiverId]);
      if (!c) return;
      await sql.unsafe(PG_QUERIES_WRITES.revokeCaregiverSessions, [caregiverId]);
      await append(sql, {
        scope: 'patient', patientId: String(c.linked_patient_id), actor: { role: 'patient' }, type: 'caregiver_revoked',
        message: `سُحبت صلاحية ${firstName(c.name)}`, relatedId: String(c.id),
      });
    });
    return voidRefusal();
  }, voidRefusal);
};

// ---------------------------------------------------------------------------------------------
// Consent, invited side
// ---------------------------------------------------------------------------------------------

/**
 * The only path to `active` (G9). One transaction under the caller's own session: the transition
 * (caregiver_transitions decides), the audit row, the caller's old sessions row revoked, the new
 * caregiver sessions row inserted (0007's session_row_ok admits it only for the same Civil ID and
 * a row that is now active). The signed cookie is written after the commit.
 */
export const acceptInvitation: DataApi['acceptInvitation'] = async (invitationId) => {
  const claims = await readSessionClaims();
  const current = claims ? canonicalSession(claims.session) : null;
  if (!claims || !current) return acceptRefusal(null);
  const done = await refusedAs(
    () => withSession(current, async (sql) => {
      const [c] = await sql.unsafe(PG_QUERIES_WRITES.acceptInvitation, [invitationId]);
      if (!c) return null;
      const next = canonicalSession({ subjectId: String(c.id), role: 'caregiver', linkedPatientId: String(c.linked_patient_id) });
      await append(sql, {
        scope: 'patient', patientId: String(c.linked_patient_id), actor: { role: 'caregiver', id: String(c.id) },
        type: 'caregiver_invite_accepted', message: `${firstName(c.name)} قبل الدعوة`, relatedId: String(c.id),
      });
      if (claims.sid) await revokeSessionRow(sql, claims.sid);
      const issued = await insertSessionRow(sql, next);
      return { next, issued };
    }),
    () => null,
  );
  if (!done) return acceptRefusal(current);
  await writeSessionCookie(done.next, done.issued);
  return done.next;
};

export const declineInvitation: DataApi['declineInvitation'] = async (invitationId) => {
  const claims = await readSessionClaims();
  if (!claims) return voidRefusal();
  const s = canonicalSession(claims.session);
  const pendingOnlyForThis = !!s.pendingInvitationOnly && s.subjectId === invitationId;
  const declined = await refusedAs(
    () => withSession(s, async (sql) => {
      const [c] = await sql.unsafe(PG_QUERIES_WRITES.declineInvitation, [invitationId]);
      if (!c) return false;
      await append(sql, {
        scope: 'patient', patientId: String(c.linked_patient_id), actor: { role: 'caregiver', id: String(c.id) },
        type: 'caregiver_invite_declined', message: `${firstName(c.name)} رفضت الدعوة`, relatedId: String(c.id),
      });
      // A pending-only session exists only for this invitation: it ends with the decline.
      if (pendingOnlyForThis && claims.sid) await revokeSessionRow(sql, claims.sid);
      return true;
    }),
    () => false,
  );
  if (declined && pendingOnlyForThis) await clearSessionCookie();
};

// ---------------------------------------------------------------------------------------------
// Caregiver shell
// ---------------------------------------------------------------------------------------------

export const selfUnlink: DataApi['selfUnlink'] = async (caregiverId) => {
  const session = await sessionOf();
  const unlinked = await refusedAs(
    () => withSession(session, async (sql) => {
      const [c] = await sql.unsafe(PG_QUERIES_WRITES.selfUnlink, [caregiverId]);
      if (!c) return false;
      await sql.unsafe(PG_QUERIES_WRITES.revokeCaregiverSessions, [caregiverId]); // own rows (sessions_update_own)
      await append(sql, {
        scope: 'patient', patientId: String(c.linked_patient_id), actor: { role: 'caregiver', id: String(c.id) },
        type: 'caregiver_self_unlinked', message: `${firstName(c.name)} ألغى ربط نفسه`, relatedId: String(c.id),
      });
      return true;
    }),
    () => false,
  );
  if (unlinked) await clearSessionCookie();
};

// ---------------------------------------------------------------------------------------------
// Clinic
// ---------------------------------------------------------------------------------------------

export const submitReviewDecision: DataApi['submitReviewDecision'] = async (alertId, decision, note) => {
  const session = await sessionOf();
  return refusedAs(async () => {
    await withSession(session, async (sql) => {
      const [alert] = await sql.unsafe(PG_QUERIES_WRITES.alertPatient, [alertId]);
      if (!alert) return;
      const res = await sql.unsafe(PG_QUERIES_WRITES.submitReviewDecision, [alertId, decision, note ?? null]);
      if (res.count === 0) return; // RLS: not a reviewer, or the alert is no longer in any queue
      const [ctx] = await sql.unsafe(PG_QUERIES_WRITES.reviewerContext, []);
      await append(sql, {
        scope: 'patient', patientId: String(alert.patient_id), actor: { role: 'reviewer', id: String(ctx?.subject_id ?? '') },
        type: 'alert_reviewed', message: `مراجعة تنبيه — ${decision === 'confirmed' ? 'تأكيد' : 'إخلاء'}`, relatedId: alertId,
      });
    });
    return voidRefusal();
  }, voidRefusal);
};

/** A real YYYY-MM-DD date (the generator's addDays would throw on anything else). */
function isIsoDate(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && addDays(v, 0) === v;
}

/** Values the database and the generator can both hold — anything else is refused before any write. */
function confirmableValues(f: ConfirmedFields): boolean {
  if (f.brandName !== undefined && typeof f.brandName !== 'string') return false;
  if (f.strengthMg !== undefined && (typeof f.strengthMg !== 'number' || !Number.isFinite(f.strengthMg))) return false;
  if (f.frequencyPerDay !== undefined && !Number.isInteger(f.frequencyPerDay)) return false;
  if (f.startDate !== undefined && !isIsoDate(f.startDate)) return false;
  if (f.doseTimes !== undefined && !(Array.isArray(f.doseTimes) && f.doseTimes.every((t) => typeof t === 'string'))) return false;
  return true;
}

/** The unchanged record when the caller may read it, else the bare `{ id }` (the mock's refusal). */
async function unchangedPrescription(session: Session | null, prescriptionId: string): Promise<Prescription> {
  return refusedAs(
    () => withSession(session, async (sql) => (await loadPrescription(sql, prescriptionId)) ?? prescriptionWriteRefusal(prescriptionId)),
    () => prescriptionWriteRefusal(prescriptionId),
  );
}

async function reviewerContext(sql: Tx): Promise<{ reviewer: boolean; subjectId: string; now: string }> {
  const [ctx] = await sql.unsafe(PG_QUERIES_WRITES.reviewerContext, []);
  return { reviewer: Boolean(ctx?.reviewer), subjectId: String(ctx?.subject_id ?? ''), now: String(ctx?.now ?? '') };
}

/**
 * One transaction (D-033): load (RLS: a reviewer sees a flagged record) → build the confirmed record
 * in TS from ONLY the five values → regenerate its `upcoming` doses FIRST, while the reviewer can
 * still read the patient → the confirming update (review fields in the same statement, so the
 * trigger sees a reviewer's pending → confirmed) → audit. Any refusal after the regeneration rolls
 * the regeneration back with it. The record returned is built in TS: after the update the reviewer
 * may no longer see the row (P8), so it is never re-read.
 */
export const confirmPrescriptionFields: DataApi['confirmPrescriptionFields'] = async (prescriptionId, values, note) => {
  const session = await sessionOf();
  const f = pickConfirmedFields(values);
  if (!confirmableValues(f)) return unchangedPrescription(session, prescriptionId);
  let saved: Prescription;
  try {
    saved = await withSession(session, async (sql) => {
      const before = await loadPrescription(sql, prescriptionId);
      if (!before) throw new Refused('not visible');
      const ctx = await reviewerContext(sql);
      if (!ctx.reviewer) throw new Refused('not a reviewer'); // no dose is touched for anyone else
      const confirmed = inPlace<Prescription>(before, [
        ['drug', confirmedDrug(before.drug, f)],
        ...f.order.map((k): [keyof Prescription, unknown] => [k, f[k]]),
        ['needsReview', false],
        ['fieldReviewStatus', 'confirmed'],
        ['fieldReviewedBy', ctx.subjectId],
        ['fieldReviewedAt', ctx.now],
        ['fieldReviewNote', note],
      ]);
      const [tracking] = await sql.unsafe(PG_QUERIES_WRITES.trackingFor, [before.patientId]);
      await regenerateUpcoming(sql, confirmed, tracking ? Boolean(tracking.adherence_check_in_enabled) : false);
      const res = await sql.unsafe(PG_QUERIES_WRITES.confirmPrescriptionFields, [
        prescriptionId,
        confirmed.drug.brandName ?? null,
        confirmed.drug.strengthMg ?? null,
        confirmed.frequencyPerDay ?? null,
        confirmed.startDate ?? null,
        confirmed.doseTimes ?? null,
        note ?? null,
      ]);
      if (res.count === 0) throw new Refused('update matched 0 rows'); // rolls the regeneration back
      await append(sql, {
        scope: 'patient', patientId: before.patientId, actor: { role: 'reviewer', id: ctx.subjectId }, type: 'prescription_field_confirmed',
        message: `تأكيد بيانات وصفة ${confirmed.drug.genericName}`, relatedId: prescriptionId,
      });
      return confirmed;
    });
  } catch (e) {
    if (!isRefusal(e)) throw e;
    return unchangedPrescription(session, prescriptionId);
  }
  // F3 (TC-IX-06): the confirmed prescription is screened now, AFTER the commit so the agent can
  // read it, or held for a specialist when n8n does not accept the job (./screening.ts). A refusal
  // has returned above and screens nothing. No language passed: screenOrHold reads the PATIENT's own
  // under the agent role (the reviewer's session may no longer see the patient once the record left
  // the queue, P8). screenOrHold never throws: the confirmation stands whatever n8n answers.
  await screenOrHold(saved.patientId, saved);
  return saved;
};

export const returnPrescriptionToClinic: DataApi['returnPrescriptionToClinic'] = async (prescriptionId, reason) => {
  const session = await sessionOf();
  try {
    return await withSession(session, async (sql) => {
      const before = await loadPrescription(sql, prescriptionId);
      if (!before) throw new Refused('not visible');
      const ctx = await reviewerContext(sql);
      const res = await sql.unsafe(PG_QUERIES_WRITES.returnPrescriptionToClinic, [prescriptionId, reason ?? null]);
      if (res.count === 0) throw new Refused('update matched 0 rows');
      await append(sql, {
        scope: 'patient', patientId: before.patientId, actor: { role: 'reviewer', id: ctx.subjectId }, type: 'prescription_returned_to_clinic',
        message: `أُعيدت وصفة ${before.drug.genericName} للعيادة`, relatedId: prescriptionId,
      });
      return inPlace<Prescription>(before, [
        ['fieldReviewStatus', 'returned'],
        ['fieldReviewNote', reason],
        ['fieldReviewedBy', ctx.subjectId],
        ['fieldReviewedAt', ctx.now],
      ]);
    });
  } catch (e) {
    if (!isRefusal(e)) throw e;
    return unchangedPrescription(session, prescriptionId);
  }
};

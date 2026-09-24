/**
 * Postgres implementation — the channel writes, and the SQL behind the four channel route
 * handlers. Owned by package WP6 (lead split at Gate 1). Every statement runs inside
 * withSession()/withAgent()/withSystem(); RLS and the guard triggers refuse; a refusal comes back
 * as the mock's refusal shape (lib/data/refusals/channels.ts, D-022); projections go through
 * lib/data/shapes/channels.ts (key order). Route handlers under app/api/** hold no SQL (guard 8):
 * they call the exported helpers at the bottom of this file.
 *
 * Invariants enforced here: G10 (the chat is optional — nothing here is a precondition of any
 * other feature), G12 (a payload carries no action; nothing reaches a caregiver who is not
 * `active`), G1 (not one statement in this file names the doses table except the read-only
 * calendar feed; disconnectMessaging and the expiry job touch no dose — E-47, E-03).
 *
 * Three reads use the agent role, deliberately (the third is CR-063's `subjectForChat`): `jurah_app` has NO column grant on
 * `push_subscriptions.endpoint/p256dh/auth` or `messaging_links.chat_id` (0005 — never projected,
 * rule 7), so after the caller's own session has proved the row is theirs and live (withSession,
 * RLS), the delivery target is read by id under withAgent (`jurah_agent` holds SELECT on both
 * tables, as WP7's alert-recipients route does). The value is used for one send and never
 * returned, logged or stored. A SECURITY DEFINER "own target" function would avoid the second
 * role; that needs a migration this package does not own (requested in docs/backend-notes/p2-wp6.md).
 */
import { randomBytes } from 'node:crypto';
import { APP_ORIGIN, BOT_IS_SIMULATED, PUSH_IS_SIMULATED, kuwaitNow } from '@/lib/config';
import { withAgent, withSession, withSystem } from '@/lib/db/withSession';
import { append } from '@/lib/db/audit';
import { newId } from '@/lib/db/ids';
import { expireInvitations } from '@/lib/engine/expiry';
import { sendPush } from '@/lib/push/send';
import { sendMessage } from '@/lib/messaging/telegram';
import { copy, type Locale } from '@/i18n';
import type { DoseWithPrescription, Session, Subject } from '@/types/views';
import type { DataApi } from '../api';
import { sessionOf } from './_shared';
import { enableCalendarSyncRefusal, requestPushPermissionRefusal, startMessagingLinkRefusal } from '../refusals/channels';
import { toChannelCalendarSubscription, toChannelMessagingLink, toChannelPushSubscription, toFeedDose } from '../shapes/channels';

/** Parameterised ($n). Every timestamp through iso_kw(); chat_id / endpoint / keys never selected
 * under jurah_app. Exported so a gate proof runs the very same text through the MCP connector. */
export const PG_QUERIES_CHANNELS = {
  requestPushPermission: `
    insert into push_subscriptions (id, subject_type, subject_id, status, permission, created_at)
    values ($1, $2::subject_type_t, $3, 'active', 'granted', jurah_now())
    on conflict (subject_type, subject_id) do update set status = 'active', permission = 'granted'
    returning id, subject_type::text as subject_type, subject_id, status::text as status,
              permission::text as permission, iso_kw(created_at) as created_at`,
  // disablePush and DELETE /api/push/subscription: revoked, and the endpoint deleted server-side.
  revokePush: `
    update push_subscriptions
       set status = 'revoked', endpoint = null, p256dh = null, auth = null, endpoint_updated_at = jurah_now()
     where subject_type = $1::subject_type_t and subject_id = $2
    returning id`,
  ownLivePush: `
    select id from push_subscriptions_view
     where subject_type = $1::subject_type_t and subject_id = $2 and status = 'active' and permission = 'granted'`,
  // withAgent: the target of a row the caller's own session has just proved theirs; a caregiver
  // subject only while its invitation is active (G12).
  pushTarget: `
    select p.endpoint, p.p256dh, p.auth from push_subscriptions p
     where p.id = $1 and p.status = 'active' and p.endpoint is not null and p.p256dh is not null and p.auth is not null
       and (p.subject_type = 'patient' or exists (select 1 from caregivers c where c.id = p.subject_id and c.status = 'active'))`,
  patientLanguage: `select language::text as language from settings where patient_id = $1`,
  // A fresh start supersedes the subject's older pending tokens: one live token per subject.
  supersedePendingLinks: `
    update messaging_links set status = 'expired', link_token = null
     where subject_type = $1::subject_type_t and subject_id = $2 and status = 'pending'`,
  startMessagingLink: `
    insert into messaging_links (id, subject_type, subject_id, channel, status, link_token, token_expires_at)
    values ($1, $2::subject_type_t, $3, 'telegram', 'pending', $4, jurah_now() + interval '15 minutes')
    returning id, subject_type::text as subject_type, subject_id, status::text as status, link_token,
              iso_kw(connected_at) as connected_at`,
  disconnectLatestLink: `
    update messaging_links set status = 'not_connected', chat_id = null, link_token = null, token_expires_at = null
     where id = (select l.id from messaging_links l
                  where l.subject_type = $1::subject_type_t and l.subject_id = $2
                  order by l.seq desc limit 1)
    returning id`,
  trackingOffOnDisconnect: `
    update settings set adherence_check_in_enabled = false
     where patient_id = $1 and adherence_check_in_enabled
    returning patient_id`,
  ownLatestLink: `
    select id, status::text as status from messaging_links
     where subject_type = $1::subject_type_t and subject_id = $2
     order by seq desc limit 1`,
  chatTarget: `
    select l.chat_id from messaging_links l
     where l.id = $1 and l.status = 'connected' and l.chat_id is not null
       and (l.subject_type = 'patient' or exists (select 1 from caregivers c where c.id = l.subject_id and c.status = 'active'))`,
  calendarOwn: `select patient_id, ics_url, token from calendar_subscriptions where patient_id = $1`,
  calendarInsert: `
    insert into calendar_subscriptions (patient_id, token, ics_url) values ($1, $2, $3)
    on conflict (patient_id) do nothing`,
  calendarSettingsOn: `update settings set calendar_sync_enabled = true where patient_id = $1`,

  // ---- route handlers (withSystem unless stated) ----
  // The webhook's ONE write: single-use (the token is cleared), unexpired, pending, and a caregiver
  // subject only while active. A used, expired, unknown or foreign token matches nothing.
  connectByToken: `
    update messaging_links l
       set status = 'connected', chat_id = $2, connected_at = jurah_now(), link_token = null, token_expires_at = null
     where l.link_token = $1 and l.status = 'pending' and l.token_expires_at > jurah_now()
       and (l.subject_type = 'patient'
            or exists (select 1 from caregivers c where c.id = l.subject_id and c.status = 'active'))
    returning l.id, l.subject_type::text as subject_type, l.subject_id`,
  // withAgent, read-only (CR-063): jurah_app holds no grant on chat_id (0005); jurah_agent does, and
  // reads no caregiver name (0008). Who a chat belongs to: the CONNECTED link with that chat id that is also its
  // subject's LATEST link (the same "latest" rule as eligibility), and — for a caregiver — only while
  // the invitation is `active`. A disconnected, superseded, unknown or non-active chat is no row.
  // CR-092 (AP-05) - the relay payload also carries whether check-ins are on for this patient, so
  // the agent side can say so instead of "no dose"; a patient with no settings row reads null, and
  // subjectForChat below maps that (and false) to trackingOn: false. Fixed at generation, unrelated
  // to a dose's own `tracked` column (rule 3).
  subjectForChat: `
    select l.subject_type::text as subject_type, l.subject_id,
           case when l.subject_type = 'patient' then l.subject_id else c.linked_patient_id end as patient_id,
           (select s.language::text from settings s
             where s.patient_id = case when l.subject_type = 'patient' then l.subject_id else c.linked_patient_id end) as language,
           (select s.adherence_check_in_enabled from settings s
             where s.patient_id = case when l.subject_type = 'patient' then l.subject_id else c.linked_patient_id end) as tracking_on
      from messaging_links l
      left join caregivers c on l.subject_type = 'caregiver' and c.id = l.subject_id
     where l.chat_id = $1 and l.status = 'connected'
       and l.seq = (select max(m.seq) from messaging_links m where m.subject_type = l.subject_type and m.subject_id = l.subject_id)
       and (l.subject_type = 'patient' or c.status = 'active')
     order by l.seq desc
     limit 1`,
  calendarByToken: `select patient_id from calendar_subscriptions where token = $1`,
  // Read-only. Every dose of the patient — upcoming and recorded — regenerated on every read.
  calendarDoses: `
    select d.id, d.prescription_id, iso_kw(d.scheduled_at) as scheduled_at, d.status::text as status, d.tracked,
           iso_kw(d.recorded_at) as recorded_at, d.source::text as source,
           p.generic_name, p.brand_name, p.strength_mg::float8 as strength_mg, p.strength_unit::text as strength_unit,
           p.dose_per_administration::float8 as dose_per_administration
      from doses d join prescriptions p on p.id = d.prescription_id
     where p.patient_id = $1
     order by d.scheduled_at, d.id`,
  // withSession (the cookie's own subject): attach the browser subscription to the live row.
  attachPushEndpoint: `
    update push_subscriptions set endpoint = $3, p256dh = $4, auth = $5, endpoint_updated_at = jurah_now()
     where subject_type = $1::subject_type_t and subject_id = $2 and status = 'active'
    returning id`,
  // withAgent — G12's recipient rule for WP7's alert-recipients route: ACTIVE caregivers only.
  activeCaregivers: `
    select id from caregivers where linked_patient_id = $1 and status = 'active' order by seq`,
} as const;

// -------------------------------------------------------------------------------------------
// helpers
// -------------------------------------------------------------------------------------------
/** The mock's isSelf: the verified session IS this subject (a pending-only session has no role). */
function isSelf(s: Session | null, subject: Subject): boolean {
  if (!s || !s.role) return false;
  return s.role === subject.subjectType && s.subjectId === subject.subjectId;
}

const REFUSAL_TRIGGERS = ['link_caregiver_must_be_active', 'link_chat_id_server_only'];

/** A database refusal (RLS insufficient_privilege, or one of this package's guard triggers) —
 * mapped to the refusal shape. Anything else (a lost connection, a bug) is rethrown: a real
 * failure must never be disguised as a quiet refusal. */
function isRefusal(e: unknown): boolean {
  const err = e as { code?: string; message?: string };
  if (err?.code === '42501') return true;
  if (err?.code === 'P0001' && REFUSAL_TRIGGERS.some((t) => (err.message ?? '').startsWith(t))) return true;
  return false;
}

/** 32 random bytes, base64url, no padding (43 chars — inside Telegram's `start` payload alphabet). */
function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function localeOf(value: unknown): Locale {
  return value === 'en' ? 'en' : 'ar';
}

// -------------------------------------------------------------------------------------------
// Notifications — the seam
// -------------------------------------------------------------------------------------------
export const requestPushPermission: DataApi['requestPushPermission'] = async (subject) => {
  const session = await sessionOf();
  try {
    return await withSession(session, async (sql) => {
      const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.requestPushPermission, [newId('ps'), subject.subjectType, subject.subjectId]);
      if (!row) return requestPushPermissionRefusal(subject);
      const sub = toChannelPushSubscription(row);
      if (subject.subjectType === 'patient') {
        await append(sql, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'patient', id: subject.subjectId }, type: 'push_enabled', message: 'تفعيل إشعارات المتصفح', relatedId: sub.id });
      }
      return sub;
    });
  } catch (e) {
    if (isRefusal(e)) return requestPushPermissionRefusal(subject);
    throw e;
  }
};

export const disablePush: DataApi['disablePush'] = async (subject) => {
  const session = await sessionOf();
  if (!isSelf(session, subject)) return;
  await withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.revokePush, [subject.subjectType, subject.subjectId]);
    if (!row) return; // no row (or not the caller's — RLS): nothing to revoke, nothing to record
    if (subject.subjectType === 'patient') {
      await append(sql, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'patient', id: subject.subjectId }, type: 'push_disabled', message: 'إيقاف إشعارات المتصفح', relatedId: String(row.id) });
    }
  });
};

/**
 * One test notification to the subject's own live endpoint. A no-op while PUSH_IS_SIMULATED, when
 * the subject has no granted/active row, or when no browser subscription is attached (the frozen
 * frontend never attaches one — BACKEND-DIVERGENCES D-13). The payload is `{title, body, url}`
 * through lib/push/send.ts's whitelist — no actions; the URL opens E5/F4, where the real state is.
 * Unaudited (CR-045).
 */
export const sendTestNotification: DataApi['sendTestNotification'] = async (subject) => {
  if (PUSH_IS_SIMULATED) return;
  const session = await sessionOf();
  if (!isSelf(session, subject)) return;
  const own = await withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.ownLivePush, [subject.subjectType, subject.subjectId]);
    if (!row) return null;
    const [lang] = subject.subjectType === 'patient' ? await sql.unsafe(PG_QUERIES_CHANNELS.patientLanguage, [subject.subjectId]) : [];
    return { id: String(row.id), locale: localeOf(lang?.language) };
  });
  if (!own) return;
  const target = await withAgent(async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.pushTarget, [own.id]);
    return row ? { endpoint: String(row.endpoint), p256dh: String(row.p256dh), auth: String(row.auth) } : null;
  });
  if (!target) return;
  const path = subject.subjectType === 'patient' ? `/${own.locale}/app/more/notifications` : `/${own.locale}/care/more/profile`;
  await sendPush(target, { title: copy.shell.appName[own.locale], body: copy.ambient.e5GrantedNoticeBody[own.locale], url: path });
};

// -------------------------------------------------------------------------------------------
// Messaging — the seam
// -------------------------------------------------------------------------------------------
/**
 * A `pending` row with a random single-use token that expires in 15 minutes. Refused (the
 * ml-default shape) unless the session is the subject's own (RLS) and, for a caregiver, the
 * invitation is `active` (trigger link_caregiver_must_be_active). NO auto-connect (divergence
 * D-12): only the bot webhook confirms. While BOT_IS_SIMULATED the row is still minted and
 * nothing is sent.
 */
export const startMessagingLink: DataApi['startMessagingLink'] = async (subject) => {
  const session = await sessionOf();
  try {
    return await withSession(session, async (sql) => {
      await sql.unsafe(PG_QUERIES_CHANNELS.supersedePendingLinks, [subject.subjectType, subject.subjectId]);
      const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.startMessagingLink, [newId('ml'), subject.subjectType, subject.subjectId, randomToken()]);
      return row ? toChannelMessagingLink(row) : startMessagingLinkRefusal(subject);
    });
  } catch (e) {
    if (isRefusal(e)) return startMessagingLinkRefusal(subject);
    throw e;
  }
};

/**
 * Exactly the mock's statement list: the latest link row → `not_connected` (chat id and token
 * cleared); for a patient, tracking off when it was on (`tracking_disabled`, actor system), then
 * `messaging_disconnected`. Touches no dose (E-47).
 */
export const disconnectMessaging: DataApi['disconnectMessaging'] = async (subject) => {
  const session = await sessionOf();
  if (!isSelf(session, subject)) return;
  await withSession(session, async (sql) => {
    const [link] = await sql.unsafe(PG_QUERIES_CHANNELS.disconnectLatestLink, [subject.subjectType, subject.subjectId]);
    if (subject.subjectType !== 'patient') return;
    const [flipped] = await sql.unsafe(PG_QUERIES_CHANNELS.trackingOffOnDisconnect, [subject.subjectId]);
    if (flipped) {
      await append(sql, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'system' }, type: 'tracking_disabled', message: 'أُوقفت متابعة الجرعات', relatedId: subject.subjectId });
    }
    await append(sql, { scope: 'patient', patientId: subject.subjectId, actor: { role: 'patient', id: subject.subjectId }, type: 'messaging_disconnected', message: 'تم فصل تيليقرام', relatedId: link ? String(link.id) : undefined });
  });
};

/** One message through the bot to the subject's own connected chat; a no-op otherwise (and always
 * while the real bot is still owed). Unaudited (CR-045). */
export const sendTestMessage: DataApi['sendTestMessage'] = async (subject) => {
  if (BOT_IS_SIMULATED) return;
  const session = await sessionOf();
  if (!isSelf(session, subject)) return;
  const own = await withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.ownLatestLink, [subject.subjectType, subject.subjectId]);
    if (!row || row.status !== 'connected') return null;
    const [lang] = subject.subjectType === 'patient' ? await sql.unsafe(PG_QUERIES_CHANNELS.patientLanguage, [subject.subjectId]) : [];
    return { id: String(row.id), locale: localeOf(lang?.language) };
  });
  if (!own) return;
  const chatId = await withAgent(async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.chatTarget, [own.id]);
    return row ? String(row.chat_id) : null;
  });
  if (!chatId) return;
  await sendMessage(chatId, `${copy.shell.appName[own.locale]} · ${copy.ambient.e5ChatSectionTitle[own.locale]}`);
};

// -------------------------------------------------------------------------------------------
// Calendar — the seam
// -------------------------------------------------------------------------------------------
/** webcal://<APP_ORIGIN host>/api/calendar/<token>.ics (divergence D-15). */
function icsUrlFor(token: string): string {
  return `webcal://${new URL(APP_ORIGIN).host}/api/calendar/${token}.ics`;
}

/** Idempotent: the first call issues a random token; every call sets calendar_sync_enabled (when
 * a settings row exists — the mock writes none for بدر). The seed keeps سارة's token. Unaudited (CR-045). */
export const enableCalendarSync: DataApi['enableCalendarSync'] = async (patientId) => {
  const session = await sessionOf();
  if (!session || session.role !== 'patient' || session.subjectId !== patientId) return enableCalendarSyncRefusal(patientId);
  try {
    return await withSession(session, async (sql) => {
      let [row] = await sql.unsafe(PG_QUERIES_CHANNELS.calendarOwn, [patientId]);
      if (!row) {
        const token = randomToken();
        await sql.unsafe(PG_QUERIES_CHANNELS.calendarInsert, [patientId, token, icsUrlFor(token)]);
        [row] = await sql.unsafe(PG_QUERIES_CHANNELS.calendarOwn, [patientId]);
      }
      if (!row) return enableCalendarSyncRefusal(patientId);
      await sql.unsafe(PG_QUERIES_CHANNELS.calendarSettingsOn, [patientId]);
      return toChannelCalendarSubscription(row);
    });
  } catch (e) {
    if (isRefusal(e)) return enableCalendarSyncRefusal(patientId);
    throw e;
  }
};

// -------------------------------------------------------------------------------------------
// Route-handler helpers (app/api/** holds no SQL — guard 8)
// -------------------------------------------------------------------------------------------
/**
 * POST /api/messaging/telegram/webhook/{secret} — `/start <token>`. Connects the ONE row that
 * minted the token, or nothing. Returns whether a row was connected; the route answers the same
 * neutral 200 either way. Writes `messaging_connected` exactly as the mock's body does (scope
 * `patient` for a patient subject; scope `system`, no patient, for a caregiver subject).
 */
export async function connectMessagingLinkByToken(token: string, chatId: string): Promise<boolean> {
  return withSystem(async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.connectByToken, [token, chatId]);
    if (!row) return false;
    const patient = row.subject_type === 'patient';
    await append(sql, {
      scope: patient ? 'patient' : 'system',
      patientId: patient ? String(row.subject_id) : undefined,
      actor: { role: patient ? 'patient' : 'caregiver', id: String(row.subject_id) },
      type: 'messaging_connected',
      message: 'تم ربط تيليقرام',
      relatedId: String(row.id),
    });
    return true;
  });
}

/** Feed tokens are base64url (the seed's `mock-token-cal-pt-03` included); anything else is unknown. */
export function isFeedTokenShape(token: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(token);
}

/** GET /api/calendar/{token}.ics — the patient's doses, or null for an unknown token. Read-only. */
export async function calendarFeedForToken(token: string): Promise<DoseWithPrescription[] | null> {
  if (!isFeedTokenShape(token)) return null;
  return withSystem(async (sql) => {
    const [sub] = await sql.unsafe(PG_QUERIES_CHANNELS.calendarByToken, [token]);
    if (!sub) return null;
    const rows = await sql.unsafe(PG_QUERIES_CHANNELS.calendarDoses, [String(sub.patient_id)]);
    return rows.map((r) => toFeedDose(r));
  });
}

export interface BrowserSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** POST /api/push/subscription — attaches the endpoint to the session subject's own live row.
 * 'stored', or 'no_live_row' when requestPushPermission has not made one (or it is revoked). */
export async function attachPushEndpointForSession(session: Session, sub: BrowserSubscription): Promise<'stored' | 'no_live_row'> {
  const role = session.role;
  if (role !== 'patient' && role !== 'caregiver') return 'no_live_row';
  return withSession(session, async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.attachPushEndpoint, [role, session.subjectId, sub.endpoint, sub.p256dh, sub.auth]);
    return row ? 'stored' : 'no_live_row';
  });
}

/** DELETE /api/push/subscription — `revoked`, endpoint columns nulled; the row is kept (its
 * permission state is what getPushState reads). No audit row (API-SURFACE §B: the seam writes them). */
export async function revokePushEndpointForSession(session: Session): Promise<void> {
  const role = session.role;
  if (role !== 'patient' && role !== 'caregiver') return;
  await withSession(session, async (sql) => {
    await sql.unsafe(PG_QUERIES_CHANNELS.revokePush, [role, session.subjectId]);
  });
}

/**
 * POST /api/jobs/expire-invitations — the second enforcement of expiry (the read paths already
 * fold a stale `pending` to `expired`). The work is WP4b's lib/engine/expiry.ts expireInvitations()
 * (selection by lib/schedule/expiry.ts's invitationsToExpire, the transaction clock set to `nowIso`,
 * one `caregiver_invite_expired` row per flip, one job_runs row per run, never a Civil ID, never a
 * dose — E-03), run here inside withSystem() because only the system actor may expire a row.
 * Returns the flipped ids, or null for a refused clock (never thrown — D-29).
 */
export async function runInvitationExpiryJob(nowIso: string = kuwaitNow()): Promise<string[] | null> {
  return withSystem(async (sql) => {
    const result = await expireInvitations(sql, nowIso);
    return result.ok ? result.expiredIds : null;
  });
}

/** G12 for WP7's alert-recipients route: the patient's ACTIVE caregivers only — never a pending,
 * declined, expired or revoked row (E-07). */
export async function activeCaregiverRecipients(patientId: string): Promise<string[]> {
  return withAgent(async (sql) => {
    const rows = await sql.unsafe(PG_QUERIES_CHANNELS.activeCaregivers, [patientId]);
    return rows.map((r) => String(r.id));
  });
}

/** Who a chat belongs to, for the webhook's forward to the agents track (CR-063). */
export interface ChatSubject {
  subjectType: 'patient' | 'caregiver';
  subjectId: string;
  /** The patient itself, or the patient an ACTIVE caregiver is linked to. */
  patientId: string;
  language: 'ar' | 'en';
  /** CR-092 (AP-05) - settings.adherence_check_in_enabled for that patient; no settings row reads false. */
  trackingOn: boolean;
}

/** null ⇔ no connected, latest link has this chat id — or it is a caregiver's whose invitation is not active. */
export async function subjectForChat(chatId: string): Promise<ChatSubject | null> {
  return withAgent(async (sql) => {
    const [row] = await sql.unsafe(PG_QUERIES_CHANNELS.subjectForChat, [chatId]);
    if (!row || row.patient_id === null || row.patient_id === undefined) return null;
    return {
      subjectType: String(row.subject_type) === 'caregiver' ? 'caregiver' : 'patient',
      subjectId: String(row.subject_id),
      patientId: String(row.patient_id),
      language: String(row.language) === 'en' ? 'en' : 'ar',
      trackingOn: row.tracking_on === true,
    };
  });
}

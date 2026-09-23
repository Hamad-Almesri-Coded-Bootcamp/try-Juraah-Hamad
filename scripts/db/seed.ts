/**
 * The Postgres seed (docs/SCHEMA.md §4). Every value comes from the `build*()` functions of
 * lib/data/mock/seed.ts — the one transcription of docs/Seed Dataset.md, already diffed record by
 * record by `npm run seed:diff` — and nothing here retypes one. What this file adds is only what
 * the database needs and the mock never did, each listed in docs/backend-notes/p2-wp1.md §2:
 * insert ORDER (so `seq` reproduces the mock's array order, and so the guard triggers see their
 * prerequisites first), derived server-side columns (chat_id, token_expires_at, created_at), and
 * the split of `Account.roles` into stored `assigned_roles` + derived `account_roles()`.
 *
 * One transaction, as the owner, `jurah.session = {"role":"system"}` and `jurah.now = REFERENCE_NOW`:
 * `truncate … restart identity cascade` first (the owner's TRUNCATE is the single sanctioned
 * exception to audit_events' append-only rule), then inserts in FK order. Deterministic: two runs
 * produce identical dumps (no random id, no wall clock — every default reads jurah_now()).
 *
 *   npx tsx scripts/db/seed.ts            run over JURAH_DATABASE_URL (fails loudly without it)
 *   npx tsx scripts/db/seed.ts --print    the SQL to stdout (the MCP path: execute_sql)
 *   npx tsx scripts/db/seed.ts --out f    the SQL to a file
 *   npx tsx scripts/db/seed.ts --body     the statements without begin/commit (to embed)
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { REFERENCE_NOW } from '../../lib/config';
import {
  ALL_TEST_CIVIL_IDS,
  buildAccounts,
  buildAlerts,
  buildAuditEvents,
  buildCalendarSubscriptions,
  buildCaregivers,
  buildDoses,
  buildMessagingLinks,
  buildPatients,
  buildPrescriptions,
  buildPushSubscriptions,
  buildRefillRequests,
  buildSettings,
} from '../../lib/data/mock/seed';
import type { Sql } from '../../lib/db/client';

/** Every table, truncated together. */
export const ALL_TABLES = [
  'accounts', 'patients', 'caregivers', 'prescriptions', 'doses', 'interaction_alerts', 'refill_requests',
  'calendar_subscriptions', 'messaging_links', 'push_subscriptions', 'audit_events', 'settings',
  'sessions', 'prescription_drafts', 'lookup_audit', 'snapshots', 'civil_id_test_list', 'job_runs',
] as const;

// ---------------------------------------------------------------------------------------------
// SQL literals
// ---------------------------------------------------------------------------------------------
type Lit = string | number | boolean | null | undefined;

function q(v: Lit): string {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`seed: non-finite number ${v}`);
    return String(v);
  }
  return `'${v.replace(/'/g, "''")}'`;
}
const ts = (v: string | undefined) => (v === undefined ? 'null' : `${q(v)}::timestamptz`);
const dt = (v: string | undefined) => (v === undefined ? 'null' : `${q(v)}::date`);
const en = (v: string | undefined, type: string) => (v === undefined ? 'null' : `${q(v)}::${type}`);
function arr(v: readonly string[] | undefined, type: string): string {
  if (v === undefined) return 'null';
  if (v.length === 0) return `'{}'::${type}[]`;
  return `array[${v.map(q).join(', ')}]::${type}[]`;
}
function insert(table: string, columns: string[], rows: string[][]): string {
  if (rows.length === 0) return `-- ${table}: no rows`;
  return `insert into ${table} (${columns.join(', ')}) values\n${rows.map((r) => `  (${r.join(', ')})`).join(',\n')};`;
}

// ---------------------------------------------------------------------------------------------
// The statements
// ---------------------------------------------------------------------------------------------
/** Synthetic server-side chat id for a seeded `connected` link (link_connected_has_chat). The seed
 * states no chatId ("No chatId value appears on any screen or in any document"); this value is
 * never projected by any seam shape and names itself as synthetic. */
export function seedChatId(linkId: string): string {
  return `seed-synthetic-chat-${linkId}`;
}

const COMPACT_AT = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):00\+03:00$/;

/**
 * ~960 generated doses make a 150 KB statement, too large to paste through the MCP connector, so
 * consecutive runs of plain generated doses (same prescription, `upcoming`, same `tracked`/`source`,
 * no `recordedAt`) are written as one `unnest` of compact `YYYYMMDDHHmm` keys. Only the ENCODING is
 * compact: every key is the generator's own scheduledAt, and the id is re-derived in SQL by the
 * generator's own convention — asserted here, per dose, to equal the generator's id before the
 * compact form is used at all (anything else is written as an explicit row). Array order is
 * preserved (`with ordinality … order by`), so `seq` follows the mock's array order.
 */
function doseStatements(doses: ReturnType<typeof buildDoses>): string[] {
  const cols = 'id, prescription_id, scheduled_at, status, tracked, recorded_at, source';
  const compactKey = (d: (typeof doses)[number]): string | null => {
    const m = COMPACT_AT.exec(d.scheduledAt);
    if (!m || d.status !== 'upcoming' || d.recordedAt !== undefined) return null;
    const key = `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}`;
    return d.id === `${d.prescriptionId}-${key.slice(0, 8)}-${key.slice(8)}` ? key : null;
  };
  const out: string[] = [];
  let run: { rx: string; tracked: boolean; source: string | undefined; keys: string[] } | null = null;
  const flush = () => {
    if (!run) return;
    out.push(`insert into doses (${cols})
select ${q(run.rx)} || '-' || left(k, 8) || '-' || right(k, 4), ${q(run.rx)},
       (left(k, 4) || '-' || substr(k, 5, 2) || '-' || substr(k, 7, 2) || 'T' || substr(k, 9, 2) || ':' || substr(k, 11, 2) || ':00+03:00')::timestamptz,
       'upcoming'::dose_status_t, ${q(run.tracked)}, null, ${en(run.source, 'dose_source_t')}
from unnest(array[${run.keys.map(q).join(',')}]) with ordinality as u(k, o) order by o;`);
    run = null;
  };
  for (const d of doses) {
    const key = compactKey(d);
    const tracked = d.tracked ?? true;
    if (key && run && run.rx === d.prescriptionId && run.tracked === tracked && run.source === d.source) {
      run.keys.push(key);
      continue;
    }
    flush();
    if (key) {
      run = { rx: d.prescriptionId, tracked, source: d.source, keys: [key] };
    } else {
      out.push(insert('doses', cols.split(', '),
        [[q(d.id), q(d.prescriptionId), ts(d.scheduledAt), en(d.status, 'dose_status_t'), q(tracked), ts(d.recordedAt), en(d.source, 'dose_source_t')]]));
    }
  }
  flush();
  return out;
}

export function buildSeedStatements(): string[] {
  const accounts = buildAccounts();
  const patients = buildPatients();
  const caregivers = buildCaregivers();
  const prescriptions = buildPrescriptions();
  const settings = buildSettings();
  const doses = buildDoses(prescriptions, new Map(settings.map((s) => [s.patientId, s])));
  const alerts = buildAlerts();
  const links = buildMessagingLinks();
  const push = buildPushSubscriptions();
  const refills = buildRefillRequests();
  const calendars = buildCalendarSubscriptions();
  const audit = buildAuditEvents();

  // Seed rule, asserted rather than assumed: Patient.caregiverIds is DERIVED in the database
  // (array_agg by seq), so the transcribed arrays must equal the derivation from buildCaregivers()
  // in its own order — or the database would silently serve a different list than the mock.
  for (const p of patients) {
    const derived = caregivers.filter((c) => c.linkedPatientId === p.id).map((c) => c.id);
    if (JSON.stringify(derived) !== JSON.stringify(p.caregiverIds)) {
      throw new Error(`seed: ${p.id}.caregiverIds ${JSON.stringify(p.caregiverIds)} ≠ derived ${JSON.stringify(derived)}`);
    }
  }
  // Account.roles is DERIVED too (seed rule 2): only reviewer/admin are stored.
  const storedRoles = (roles: readonly string[]) => roles.filter((r) => r === 'reviewer' || r === 'admin');

  const out: string[] = [];
  out.push(`select set_config('jurah.session', '{"role":"system"}', true), set_config('jurah.now', ${q(REFERENCE_NOW)}, true);`);
  out.push(`truncate table ${ALL_TABLES.join(', ')} restart identity cascade;`);

  out.push(insert('civil_id_test_list', ['civil_id'], ALL_TEST_CIVIL_IDS.map((c) => [q(c)])));

  out.push(insert('accounts', ['id', 'civil_id', 'name', 'assigned_roles'],
    accounts.map((a) => [q(a.id), q(a.civilId), q(a.name), arr(storedRoles(a.roles), 'role_t')])));

  out.push(insert('patients', ['id', 'civil_id', 'name', 'telegram_chat_id', 'telegram_linked_at', 'phone', 'language', 'onboarding_completed'],
    patients.map((p) => [q(p.id), q(p.civilId), q(p.name), q(p.telegramChatId), ts(p.telegramLinkedAt), q(p.phone), en(p.language, 'language_t'), q(p.onboardingCompleted)])));

  // cg-01…cg-08 in array order → seq reproduces caregiverIds and getCaregivers' order.
  out.push(insert('caregivers', ['id', 'civil_id', 'name', 'relationship', 'phone', 'telegram_chat_id', 'linked_patient_id', 'status', 'invited_at', 'expires_at', 'accepted_at', 'declined_at', 'revoked_at', 'access_level'],
    caregivers.map((c) => [q(c.id), q(c.civilId), q(c.name), q(c.relationship), q(c.phone), q(c.telegramChatId), q(c.linkedPatientId), en(c.status, 'caregiver_status_t'),
      ts(c.invitedAt), ts(c.expiresAt), ts(c.acceptedAt), ts(c.declinedAt), ts(c.revokedAt), q(c.accessLevel)])));

  // rx-001…rx-009 in array order → seq reproduces getPrescriptions' order.
  out.push(insert('prescriptions', ['id', 'patient_id', 'facility_name', 'sector', 'generic_name', 'brand_name', 'strength_mg', 'strength_unit',
    'dose_per_administration', 'frequency_per_day', 'duration_days', 'dosing_pattern', 'start_date', 'dose_times', 'prescribed_at', 'prescriber_name',
    'timing_relative_to_food', 'route_of_administration', 'special_notes', 'indication', 'dispensing_units_per_package',
    'dispensing_total_quantity_dispensed', 'dispensing_dispense_date', 'dispensing_brand_actually_dispensed', 'needs_review',
    'field_review_status', 'field_reviewed_by', 'field_reviewed_at', 'field_review_note', 'status', 'discontinued_reason', 'discontinued_at'],
    prescriptions.map((r) => [q(r.id), q(r.patientId), q(r.source.facilityName), en(r.source.sector, 'sector_t'), q(r.drug.genericName), q(r.drug.brandName),
      // strength_mg is stored exactly as written, in strength_unit's unit — never converted (Guard U).
      q(r.drug.strengthMg), en(r.drug.strengthUnit, 'strength_unit_t'),
      q(r.dosePerAdministration), q(r.frequencyPerDay), q(r.durationDays), en(r.dosingPattern, 'dosing_pattern_t'), dt(r.startDate), arr(r.doseTimes, 'text'),
      ts(r.prescribedAt), q(r.prescriberName), q(r.timingRelativeToFood), q(r.routeOfAdministration), q(r.specialNotes), q(r.indication),
      q(r.dispensing?.unitsPerPackage), q(r.dispensing?.totalQuantityDispensed), dt(r.dispensing?.dispenseDate), q(r.dispensing?.brandActuallyDispensed),
      q(r.needsReview), en(r.fieldReviewStatus, 'field_review_t'), q(r.fieldReviewedBy), ts(r.fieldReviewedAt), q(r.fieldReviewNote),
      en(r.status, 'rx_status_t'), q(r.discontinuedReason), dt(r.discontinuedAt)])));

  // Doses exactly as the generator + سارة's overlay produce them, in the mock's array order.
  out.push(...doseStatements(doses));

  out.push(insert('interaction_alerts', ['id', 'patient_id', 'involved_prescription_ids', 'severity', 'description', 'source_citation', 'created_at', 'review_status',
    'reviewer_decision', 'reviewer_note', 'reviewed_at', 'reviewed_by'],
    alerts.map((a) => [q(a.id), q(a.patientId), arr(a.involvedPrescriptionIds, 'text'), en(a.severity, 'severity_t'), q(a.description), q(a.sourceCitation),
      ts(a.createdAt), en(a.reviewStatus, 'review_status_t'), en(a.reviewerDecision, 'reviewer_decision_t'), q(a.reviewerNote), ts(a.reviewedAt), q(a.reviewedBy)])));

  // Before settings (settings_tracking_requires_link would quietly turn سارة's tracking off
  // without her connected ml-03) and after caregivers (link_caregiver_must_be_active for ml-04).
  // Derived: chat_id for connected rows; token_expires_at = REFERENCE_NOW + 15 min for the live
  // pending token (CR-048's 15-minute expiry); created_at = connectedAt when stated, else the
  // column default jurah_now() = REFERENCE_NOW.
  out.push(insert('messaging_links', ['id', 'subject_type', 'subject_id', 'channel', 'status', 'link_token', 'token_expires_at', 'chat_id', 'connected_at', 'created_at'],
    links.map((l) => [q(l.id), en(l.subjectType, 'subject_type_t'), q(l.subjectId), en(l.channel, 'channel_t'), en(l.status, 'link_status_t'), q(l.linkToken),
      l.status === 'pending' ? `jurah_now() + interval '15 minutes'` : 'null',
      l.status === 'connected' ? q(l.chatId ?? seedChatId(l.id)) : q(l.chatId),
      ts(l.connectedAt), l.connectedAt ? ts(l.connectedAt) : 'jurah_now()'])));

  out.push(insert('settings', ['patient_id', 'adherence_check_in_enabled', 'adherence_check_in_frequency', 'refill_alerts_enabled', 'calendar_sync_enabled',
    'web_push_enabled', 'notification_channel', 'language'],
    settings.map((s) => [q(s.patientId), q(s.adherenceCheckInEnabled), en(s.adherenceCheckInFrequency, 'checkin_freq_t'), q(s.refillAlertsEnabled),
      q(s.calendarSyncEnabled), q(s.webPushEnabled), en(s.notificationChannel, 'channel_t'), en(s.language, 'language_t')])));

  out.push(insert('push_subscriptions', ['id', 'subject_type', 'subject_id', 'status', 'permission', 'created_at'],
    push.map((p) => [q(p.id), en(p.subjectType, 'subject_type_t'), q(p.subjectId), en(p.status, 'push_status_t'), en(p.permission, 'push_permission_t'), ts(p.createdAt)])));

  // refill_routing overwrites routed_to and fills sector from the prescription; the seed's own
  // routedTo is passed anyway and the dump proves it survived unchanged (it matches the sector).
  out.push(insert('refill_requests', ['id', 'patient_id', 'prescription_id', 'requested_at', 'routed_to', 'status'],
    refills.map((r) => [q(r.id), q(r.patientId), q(r.prescriptionId), ts(r.requestedAt), en(r.routedTo, 'routed_to_t'), en(r.status, 'refill_status_t')])));

  out.push(insert('calendar_subscriptions', ['patient_id', 'token', 'ics_url'],
    calendars.map((c) => [q(c.patientId), q(c.token), q(c.icsUrl)])));

  // ae-001… in id order (= createdAt order, assignAuditIds) → seq is the tie-break.
  out.push(insert('audit_events', ['id', 'scope', 'patient_id', 'actor_role', 'actor_id', 'type', 'message', 'created_at', 'related_id'],
    audit.map((e) => [q(e.id), en(e.scope, 'audit_scope_t'), q(e.patientId), en(e.actor.role, 'actor_role_t'), q(e.actor.id), en(e.type, 'audit_type_t'),
      q(e.message), ts(e.createdAt), q(e.relatedId)])));

  return out;
}

/** The whole seed as one SQL transaction (or just its statements, to embed). */
export function buildSeedSql(opts: { transaction: boolean } = { transaction: true }): string {
  const body = buildSeedStatements().join('\n\n');
  return opts.transaction ? `begin;\n\n${body}\n\ncommit;\n` : `${body}\n`;
}

/** Runs the seed in ONE transaction on the given (owner) connection. */
export async function runSeed(sql: Sql): Promise<void> {
  const body = buildSeedSql({ transaction: false });
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--print') || args.includes('--body')) {
    process.stdout.write(buildSeedSql({ transaction: !args.includes('--body') }));
    return;
  }
  const outIdx = args.indexOf('--out');
  if (outIdx >= 0) {
    const file = args[outIdx + 1];
    if (!file) throw new Error('--out needs a file path');
    writeFileSync(file, buildSeedSql());
    console.log(`seed SQL written to ${file}`);
    return;
  }
  const { loadLocalEnv } = await import('./env');
  loadLocalEnv();
  const { getSql, closeSql, databaseUrl } = await import('../../lib/db/client');
  if (!databaseUrl()) {
    console.error('!! db:seed — JURAH_DATABASE_URL not set — NOTHING SEEDED (use --print for the MCP path)');
    process.exit(1);
  }
  try {
    await runSeed(getSql());
    console.log('✓ seed loaded in one transaction');
  } finally {
    await closeSql();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}

/** For verification scripts outside scripts/db (print-shapes): re-seed over JURAH_DATABASE_URL.
 * Returns false — having done nothing — when no URL is configured; the caller fails loudly. */
export async function reseedOverUrl(): Promise<boolean> {
  const { loadLocalEnv } = await import('./env');
  loadLocalEnv();
  const { getSql, databaseUrl } = await import('../../lib/db/client');
  if (!databaseUrl()) return false;
  await runSeed(getSql());
  return true;
}

/** Closes the pool (verification scripts outside scripts/db never touch the client themselves). */
export async function closeDb(): Promise<void> {
  const { closeSql } = await import('../../lib/db/client');
  await closeSql();
}

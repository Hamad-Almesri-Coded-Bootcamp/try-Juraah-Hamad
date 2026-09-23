/**
 * Canonical dump of every seeded table (docs/briefs/P2-WP0-WP1.md): each row rendered column by
 * column to text by ONE rule set (timestamps through iso_kw(), dates YYYY-MM-DD, numerics through
 * float8, arrays as [a,b], NULL as ∅), rows ordered by primary key in C collation. Used three ways:
 *
 *   1. `dumpAll(sql)` → canonical JSON, for "seed twice, identical dump" and for
 *      `seed-diff --backend=postgres` (scripts/seed-diff.impl.ts reads it).
 *   2. `digestSql()` → one query returning md5(table) per table — runnable through the MCP
 *      connector (`execute_sql`) when no connection string exists.
 *   3. `expectedDigests()` → the same md5s computed in TypeScript from lib/data/mock/seed.ts's
 *      build*() functions plus the seed's documented derivations. Equal digests mean every row
 *      and every column equals the transcription, byte for byte — including `seq` (insertion
 *      order) and the derived Account roles (`account_roles()` vs the seed's roles column).
 *
 *   npx tsx scripts/db/dump.ts --digest-sql      print the digest query (MCP path)
 *   npx tsx scripts/db/dump.ts --expected        print the expected digests
 *   npx tsx scripts/db/dump.ts --digest          compute over JURAH_DATABASE_URL and compare
 *   npx tsx scripts/db/dump.ts [--out file]      canonical JSON dump over JURAH_DATABASE_URL
 */
import { createHash } from 'node:crypto';
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
import { seedChatId } from './seed';

type Kind = 'text' | 'ts' | 'date' | 'num' | 'bool' | 'arr';
interface Spec {
  /** Table name, or a derived pseudo-table rendered from a query. */
  name: string;
  from: string;
  key: string;
  cols: [string, Kind][];
}

export const NULL_MARK = '∅';

export const SPECS: Spec[] = [
  { name: 'civil_id_test_list', from: 'civil_id_test_list', key: 'civil_id', cols: [['civil_id', 'text']] },
  { name: 'accounts', from: 'accounts', key: 'id', cols: [['id', 'text'], ['civil_id', 'text'], ['name', 'text'], ['assigned_roles', 'arr'], ['last_chosen_role', 'text']] },
  // Seed rule 2: the derived roles, recomputed by the database, must equal the seed's roles column.
  { name: 'account_roles (derived)', from: '(select id, account_roles(civil_id) as roles from accounts) d', key: 'id', cols: [['id', 'text'], ['roles', 'arr']] },
  { name: 'patients', from: 'patients', key: 'id', cols: [['id', 'text'], ['civil_id', 'text'], ['name', 'text'], ['telegram_chat_id', 'text'], ['telegram_linked_at', 'ts'], ['phone', 'text'], ['language', 'text'], ['onboarding_completed', 'bool']] },
  { name: 'patients.caregiverIds (derived)', from: '(select p.id, coalesce((select array_agg(c.id order by c.seq) from caregivers c where c.linked_patient_id = p.id), \'{}\') as caregiver_ids from patients p) d', key: 'id', cols: [['id', 'text'], ['caregiver_ids', 'arr']] },
  { name: 'caregivers', from: 'caregivers', key: 'id', cols: [['id', 'text'], ['seq', 'num'], ['civil_id', 'text'], ['name', 'text'], ['relationship', 'text'], ['phone', 'text'], ['telegram_chat_id', 'text'], ['linked_patient_id', 'text'], ['status', 'text'], ['invited_at', 'ts'], ['expires_at', 'ts'], ['accepted_at', 'ts'], ['declined_at', 'ts'], ['revoked_at', 'ts'], ['access_level', 'text']] },
  { name: 'prescriptions', from: 'prescriptions', key: 'id', cols: [['id', 'text'], ['seq', 'num'], ['patient_id', 'text'], ['facility_name', 'text'], ['sector', 'text'], ['generic_name', 'text'], ['brand_name', 'text'], ['strength_mg', 'num'], ['strength_unit', 'text'], ['dose_per_administration', 'num'], ['frequency_per_day', 'num'], ['duration_days', 'num'], ['dosing_pattern', 'text'], ['start_date', 'date'], ['dose_times', 'arr'], ['prescribed_at', 'ts'], ['prescriber_name', 'text'], ['timing_relative_to_food', 'text'], ['route_of_administration', 'text'], ['special_notes', 'text'], ['indication', 'text'], ['dispensing_units_per_package', 'num'], ['dispensing_total_quantity_dispensed', 'num'], ['dispensing_dispense_date', 'date'], ['dispensing_brand_actually_dispensed', 'text'], ['needs_review', 'bool'], ['field_review_status', 'text'], ['field_reviewed_by', 'text'], ['field_reviewed_at', 'ts'], ['field_review_note', 'text'], ['status', 'text'], ['discontinued_reason', 'text'], ['discontinued_at', 'date']] },
  { name: 'doses', from: 'doses', key: 'id', cols: [['id', 'text'], ['seq', 'num'], ['prescription_id', 'text'], ['scheduled_at', 'ts'], ['status', 'text'], ['tracked', 'bool'], ['recorded_at', 'ts'], ['source', 'text']] },
  { name: 'interaction_alerts', from: 'interaction_alerts', key: 'id', cols: [['id', 'text'], ['patient_id', 'text'], ['involved_prescription_ids', 'arr'], ['severity', 'text'], ['description', 'text'], ['source_citation', 'text'], ['created_at', 'ts'], ['review_status', 'text'], ['reviewer_decision', 'text'], ['reviewer_note', 'text'], ['reviewed_at', 'ts'], ['reviewed_by', 'text']] },
  { name: 'messaging_links', from: 'messaging_links', key: 'id', cols: [['id', 'text'], ['seq', 'num'], ['subject_type', 'text'], ['subject_id', 'text'], ['channel', 'text'], ['status', 'text'], ['link_token', 'text'], ['token_expires_at', 'ts'], ['chat_id', 'text'], ['connected_at', 'ts'], ['created_at', 'ts']] },
  { name: 'settings', from: 'settings', key: 'patient_id', cols: [['patient_id', 'text'], ['adherence_check_in_enabled', 'bool'], ['adherence_check_in_frequency', 'text'], ['refill_alerts_enabled', 'bool'], ['calendar_sync_enabled', 'bool'], ['web_push_enabled', 'bool'], ['notification_channel', 'text'], ['language', 'text']] },
  { name: 'push_subscriptions', from: 'push_subscriptions', key: 'id', cols: [['id', 'text'], ['subject_type', 'text'], ['subject_id', 'text'], ['status', 'text'], ['permission', 'text'], ['created_at', 'ts'], ['endpoint', 'text'], ['p256dh', 'text'], ['auth', 'text'], ['endpoint_updated_at', 'ts']] },
  { name: 'refill_requests', from: 'refill_requests', key: 'id', cols: [['id', 'text'], ['seq', 'num'], ['patient_id', 'text'], ['prescription_id', 'text'], ['requested_at', 'ts'], ['routed_to', 'text'], ['status', 'text'], ['sector', 'text'], ['routed_from_sector', 'text']] },
  { name: 'calendar_subscriptions', from: 'calendar_subscriptions', key: 'patient_id', cols: [['patient_id', 'text'], ['token', 'text'], ['ics_url', 'text'], ['created_at', 'ts']] },
  { name: 'audit_events', from: 'audit_events', key: 'id', cols: [['id', 'text'], ['seq', 'num'], ['scope', 'text'], ['patient_id', 'text'], ['actor_role', 'text'], ['actor_id', 'text'], ['type', 'text'], ['message', 'text'], ['created_at', 'ts'], ['related_id', 'text']] },
  // Runtime-only tables: the seed leaves them empty.
  { name: 'sessions', from: 'sessions', key: 'id', cols: [['id', 'text']] },
  { name: 'prescription_drafts', from: 'prescription_drafts', key: 'draft_id', cols: [['draft_id', 'text']] },
  { name: 'lookup_audit', from: 'lookup_audit', key: 'id', cols: [['id', 'num']] },
  { name: 'snapshots', from: 'snapshots', key: 'subject_id', cols: [['subject_id', 'text'], ['key', 'text']] },
  { name: 'job_runs', from: 'job_runs', key: 'id', cols: [['id', 'num']] },
];

function renderSql(col: string, kind: Kind): string {
  const c = `"${col}"`;
  switch (kind) {
    case 'ts': return `coalesce(iso_kw(${c}), '${NULL_MARK}')`;
    case 'date': return `coalesce(to_char(${c}, 'YYYY-MM-DD'), '${NULL_MARK}')`;
    case 'num': return `coalesce(${c}::float8::text, '${NULL_MARK}')`;
    case 'bool': return `coalesce(${c}::text, '${NULL_MARK}')`;
    case 'arr': return `coalesce('[' || array_to_string(${c}, ',') || ']', '${NULL_MARK}')`;
    default: return `coalesce(${c}::text, '${NULL_MARK}')`;
  }
}

function lineSql(s: Spec): string {
  return s.cols.map(([c, k]) => renderSql(c, k)).join(` || '|' || `);
}

/** One query → rows (name, rows, md5). Runs unchanged through `execute_sql`. */
export function digestSql(): string {
  const parts = SPECS.map((s) =>
    `select ${`'${s.name}'`} as name, count(*)::int as rows, md5(coalesce(string_agg(${lineSql(s)}, E'\\n' order by "${s.key}"::text collate "C"), '')) as md5 from ${s.from}`);
  return `${parts.join('\nunion all\n')};`;
}

// ---------------------------------------------------------------------------------------------
// Expected, from the transcription
// ---------------------------------------------------------------------------------------------
type Cell = string | number | boolean | null | undefined | readonly string[];

function renderTs(v: Cell): string {
  if (v === null || v === undefined) return NULL_MARK;
  if (Array.isArray(v)) return `[${v.join(',')}]`;
  return String(v);
}

/** A Kuwait-offset ISO string for an instant (the seed's REFERENCE_NOW-derived values). */
function kwIso(ms: number): string {
  return `${new Date(ms + 3 * 3_600_000).toISOString().slice(0, 19)}+03:00`;
}

export function expectedRows(): Record<string, string[]> {
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
  const nowMs = Date.parse(REFERENCE_NOW);
  const rxById = new Map(prescriptions.map((r) => [r.id, r]));

  const line = (cells: Cell[]) => cells.map(renderTs).join('|');
  const rows: Record<string, [string, string][]> = {};
  const put = (name: string, key: string, cells: Cell[]) => { (rows[name] ??= []).push([key, line(cells)]); };

  for (const c of ALL_TEST_CIVIL_IDS) put('civil_id_test_list', c, [c]);
  for (const a of accounts) {
    put('accounts', a.id, [a.id, a.civilId, a.name, a.roles.filter((r) => r === 'reviewer' || r === 'admin'), null]);
    put('account_roles (derived)', a.id, [a.id, a.roles]);
  }
  for (const p of patients) {
    put('patients', p.id, [p.id, p.civilId, p.name, p.telegramChatId, p.telegramLinkedAt, p.phone, p.language, p.onboardingCompleted]);
    put('patients.caregiverIds (derived)', p.id, [p.id, p.caregiverIds]);
  }
  caregivers.forEach((c, i) => put('caregivers', c.id, [c.id, i + 1, c.civilId, c.name, c.relationship, c.phone, c.telegramChatId, c.linkedPatientId, c.status,
    c.invitedAt, c.expiresAt, c.acceptedAt, c.declinedAt, c.revokedAt, c.accessLevel]));
  prescriptions.forEach((r, i) => put('prescriptions', r.id, [r.id, i + 1, r.patientId, r.source.facilityName, r.source.sector, r.drug.genericName, r.drug.brandName,
    r.drug.strengthMg, r.drug.strengthUnit, r.dosePerAdministration, r.frequencyPerDay, r.durationDays, r.dosingPattern, r.startDate, r.doseTimes,
    r.prescribedAt, r.prescriberName, r.timingRelativeToFood, r.routeOfAdministration, r.specialNotes, r.indication,
    r.dispensing?.unitsPerPackage, r.dispensing?.totalQuantityDispensed, r.dispensing?.dispenseDate, r.dispensing?.brandActuallyDispensed,
    r.needsReview, r.fieldReviewStatus, r.fieldReviewedBy, r.fieldReviewedAt, r.fieldReviewNote, r.status, r.discontinuedReason, r.discontinuedAt]));
  doses.forEach((d, i) => put('doses', d.id, [d.id, i + 1, d.prescriptionId, d.scheduledAt, d.status, d.tracked ?? true, d.recordedAt, d.source]));
  for (const a of alerts) put('interaction_alerts', a.id, [a.id, a.patientId, a.involvedPrescriptionIds, a.severity, a.description, a.sourceCitation,
    a.createdAt, a.reviewStatus, a.reviewerDecision, a.reviewerNote, a.reviewedAt, a.reviewedBy]);
  links.forEach((l, i) => put('messaging_links', l.id, [l.id, i + 1, l.subjectType, l.subjectId, l.channel, l.status, l.linkToken,
    l.status === 'pending' ? kwIso(nowMs + 15 * 60_000) : undefined,
    l.status === 'connected' ? (l.chatId ?? seedChatId(l.id)) : l.chatId,
    l.connectedAt, l.connectedAt ?? REFERENCE_NOW]));
  for (const s of settings) put('settings', s.patientId, [s.patientId, s.adherenceCheckInEnabled, s.adherenceCheckInFrequency, s.refillAlertsEnabled,
    s.calendarSyncEnabled, s.webPushEnabled, s.notificationChannel, s.language]);
  for (const p of push) put('push_subscriptions', p.id, [p.id, p.subjectType, p.subjectId, p.status, p.permission, p.createdAt, null, null, null, null]);
  refills.forEach((r, i) => {
    const sector = rxById.get(r.prescriptionId)?.source.sector;
    put('refill_requests', r.id, [r.id, i + 1, r.patientId, r.prescriptionId, r.requestedAt, r.routedTo, r.status, sector,
      sector === 'public' ? 'public_pharmacy' : 'private_pharmacy']);
  });
  for (const c of calendars) put('calendar_subscriptions', c.patientId, [c.patientId, c.token, c.icsUrl, REFERENCE_NOW]);
  audit.forEach((e, i) => put('audit_events', e.id, [e.id, i + 1, e.scope, e.patientId, e.actor.role, e.actor.id, e.type, e.message, e.createdAt, e.relatedId]));

  const out: Record<string, string[]> = {};
  for (const s of SPECS) {
    const r = rows[s.name] ?? [];
    out[s.name] = r.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(([, l]) => l);
  }
  return out;
}

export function expectedDigests(): { name: string; rows: number; md5: string }[] {
  const rows = expectedRows();
  return SPECS.map((s) => {
    const lines = rows[s.name] ?? [];
    return { name: s.name, rows: lines.length, md5: createHash('md5').update(lines.join('\n')).digest('hex') };
  });
}

// ---------------------------------------------------------------------------------------------
// Over the connection
// ---------------------------------------------------------------------------------------------
/** Canonical dump: { table: [ {column: rendered text} ] }, rows in key order. Owner connection. */
export async function dumpAll(sql: Sql): Promise<Record<string, Record<string, string>[]>> {
  const out: Record<string, Record<string, string>[]> = {};
  for (const s of SPECS) {
    const select = s.cols.map(([c, k]) => `${renderSql(c, k)} as "${c}"`).join(', ');
    const rows = await sql.unsafe(`select ${select} from ${s.from} order by "${s.key}"::text collate "C"`);
    out[s.name] = rows.map((r) => ({ ...r }) as Record<string, string>);
  }
  return out;
}

export async function digests(sql: Sql): Promise<{ name: string; rows: number; md5: string }[]> {
  const rows = await sql.unsafe(digestSql());
  return rows.map((r) => ({ name: String(r.name), rows: Number(r.rows), md5: String(r.md5) }));
}

/** Compares two digest lists; returns printable lines and ok. */
export function compareDigests(actual: { name: string; rows: number; md5: string }[], expected = expectedDigests()): { ok: boolean; lines: string[] } {
  const lines: string[] = [];
  let ok = true;
  for (const e of expected) {
    const a = actual.find((x) => x.name === e.name);
    const good = !!a && a.rows === e.rows && a.md5 === e.md5;
    ok &&= good;
    lines.push(`${good ? '✓' : '✗'}  ${e.name.padEnd(32)} rows ${String(a?.rows ?? '—').padStart(4)} / ${String(e.rows).padStart(4)}  md5 ${a?.md5 ?? '—'} ${good ? '=' : '≠'} ${e.md5}`);
  }
  return { ok, lines };
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--digest-sql')) { process.stdout.write(`${digestSql()}\n`); return; }
  if (args.includes('--expected')) {
    for (const d of expectedDigests()) console.log(`${d.name.padEnd(32)} ${String(d.rows).padStart(4)}  ${d.md5}`);
    return;
  }
  const { loadLocalEnv } = await import('./env');
  loadLocalEnv();
  const { getSql, closeSql, databaseUrl } = await import('../../lib/db/client');
  if (!databaseUrl()) {
    console.error('!! db:dump — JURAH_DATABASE_URL not set — NOTHING DUMPED, NOT A PASS (use --digest-sql for the MCP path)');
    process.exit(1);
  }
  try {
    const sql = getSql();
    if (args.includes('--digest')) {
      const { ok, lines } = compareDigests(await digests(sql));
      console.log(lines.join('\n'));
      if (!ok) { console.error('✗ database differs from the transcription'); process.exit(1); }
      console.log('✓ every table equals the transcription, row by row');
      return;
    }
    const json = JSON.stringify(await dumpAll(sql), null, 2);
    const outIdx = args.indexOf('--out');
    const file = outIdx >= 0 ? args[outIdx + 1] : undefined;
    if (file) { writeFileSync(file, json); console.log(`dump written to ${file}`); } else process.stdout.write(`${json}\n`);
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

/** For scripts/seed-diff.impl.ts: the canonical dump and the digests over JURAH_DATABASE_URL, or
 * null — having done nothing — when no URL is configured (the caller fails loudly). */
export async function dumpAndDigestOverUrl(): Promise<{ dump: Record<string, Record<string, string>[]>; digests: { name: string; rows: number; md5: string }[] } | null> {
  const { loadLocalEnv } = await import('./env');
  loadLocalEnv();
  const { getSql, closeSql, databaseUrl } = await import('../../lib/db/client');
  if (!databaseUrl()) return null;
  try {
    const sql = getSql();
    return { dump: await dumpAll(sql), digests: await digests(sql) };
  } finally {
    await closeSql();
  }
}

/**
 * Verification 13 — the mock (and, with --backend=postgres, the database: P2-WP1) diffed against `tests/fixtures/seed-expected.json` (WP1's hand
 * transcription of docs/Seed Dataset.md's own tables, keyed by Civil ID and the seed's own record
 * ids ("rx-" / "ia-" prefixes), never by our internal "pt-" / "cg-" / "acc-" ids). `scripts/seed-diff.ts`
 * imports `runSeedDiff` and compares the result against `SEED_COUNTS` (the seed's own counts).
 */
import { readFileSync } from 'node:fs';
import { reset, getStore } from '../lib/data/mock/store';
import type { StoreState } from '../lib/data/mock/types';

type Json = Record<string, unknown>;

function patientIdFor(store: StoreState, civilId: string): string | undefined {
  return store.patients.find((p) => p.civilId === civilId)?.id;
}
function caregiverIdFor(store: StoreState, civilId: string, patientCivilId: string): string | undefined {
  const patientId = patientIdFor(store, patientCivilId);
  return store.caregivers.find((c) => c.civilId === civilId && c.linkedPatientId === patientId)?.id;
}

export async function runSeedDiff(counts: Record<string, number>): Promise<{ ok: boolean; table: string }> {
  if (process.argv.includes('--backend=postgres')) return runPostgresSeedDiff(counts);
  reset();
  return compareStore(getStore(), counts, 'mock');
}

/**
 * P2-WP1 — `--backend=postgres`: the SAME record-by-record comparison, against the database, read
 * through scripts/db/dump.ts (every column rendered to text by one rule set) and rebuilt into the
 * store's shape; plus the full row-by-row digest of every table against the transcription. Without
 * JURAH_DATABASE_URL it FAILS loudly — never a pass by absence.
 */
async function runPostgresSeedDiff(counts: Record<string, number>): Promise<{ ok: boolean; table: string }> {
  const { compareDigests, dumpAndDigestOverUrl } = await import('./db/dump');
  const got = await dumpAndDigestOverUrl();
  if (!got) {
    return { ok: false, table: '!! seed diff (postgres) — JURAH_DATABASE_URL not set — NOTHING COMPARED, NOT A PASS' };
  }
  const { dump } = got;
  const result = compareStore(storeFromDump(dump), counts, 'postgres');
  const { ok: digestOk, lines } = compareDigests(got.digests);
  reset();
  const mock = getStore();
  const doseCount = dump.doses?.length ?? 0;
  const auditCount = dump.audit_events?.length ?? 0;
  const extra = [
    `${doseCount === mock.doses.length ? '✓' : '✗'}  count doses: mock ${mock.doses.length}, postgres ${doseCount}`,
    `${auditCount === mock.auditEvents.length ? '✓' : '✗'}  count audit_events: mock ${mock.auditEvents.length}, postgres ${auditCount}`,
    'Row-by-row digest of every table against lib/data/mock/seed.ts:',
    ...lines,
  ];
  const ok = result.ok && digestOk && doseCount === mock.doses.length && auditCount === mock.auditEvents.length;
  return { ok, table: `${result.table}\n${extra.join('\n')}` };
}

type Cells = Record<string, string>;
const NULL = '∅';
const txt = (v: string | undefined) => (v === undefined || v === NULL ? undefined : v);
const numOf = (v: string | undefined) => (txt(v) === undefined ? undefined : Number(v));
const arrOf = (v: string | undefined) => (txt(v) === undefined ? undefined : (v as string).slice(1, -1).split(',').filter((x) => x !== ''));

/** The dump rebuilt into exactly the fields compareStore() reads. */
function storeFromDump(d: Record<string, Cells[]>): StoreState {
  const rows = (t: string) => d[t] ?? [];
  const roles = new Map(rows('account_roles (derived)').map((r) => [r.id, arrOf(r.roles) ?? []]));
  return {
    accounts: rows('accounts').map((r) => ({ id: r.id, civilId: r.civil_id, name: r.name, roles: roles.get(r.id) ?? [] })),
    patients: rows('patients').map((r) => ({ id: r.id, civilId: r.civil_id, name: r.name, onboardingCompleted: r.onboarding_completed === 'true' })),
    caregivers: [...rows('caregivers')].sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => ({
      id: r.id, civilId: r.civil_id, linkedPatientId: r.linked_patient_id, status: r.status, relationship: r.relationship,
      invitedAt: r.invited_at, expiresAt: txt(r.expires_at), acceptedAt: txt(r.accepted_at), declinedAt: txt(r.declined_at), revokedAt: txt(r.revoked_at),
    })),
    prescriptions: [...rows('prescriptions')].sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => ({
      id: r.id, patientId: r.patient_id,
      drug: { genericName: r.generic_name, brandName: txt(r.brand_name), strengthMg: numOf(r.strength_mg), strengthUnit: txt(r.strength_unit) },
      dosingPattern: r.dosing_pattern, doseTimes: arrOf(r.dose_times), startDate: txt(r.start_date), durationDays: numOf(r.duration_days),
      status: r.status, discontinuedAt: txt(r.discontinued_at), needsReview: r.needs_review === 'true', fieldReviewStatus: txt(r.field_review_status),
      dispensing: txt(r.dispensing_units_per_package) === undefined ? undefined : { totalQuantityDispensed: numOf(r.dispensing_total_quantity_dispensed) },
    })),
    alerts: rows('interaction_alerts').map((r) => ({
      id: r.id, patientId: r.patient_id, severity: r.severity, reviewStatus: r.review_status, reviewerDecision: txt(r.reviewer_decision),
      createdAt: r.created_at, involvedPrescriptionIds: arrOf(r.involved_prescription_ids) ?? [],
    })),
    settings: rows('settings').map((r) => ({
      patientId: r.patient_id, adherenceCheckInEnabled: r.adherence_check_in_enabled === 'true', adherenceCheckInFrequency: r.adherence_check_in_frequency,
      refillAlertsEnabled: r.refill_alerts_enabled === 'true', calendarSyncEnabled: r.calendar_sync_enabled === 'true',
      webPushEnabled: r.web_push_enabled === 'true', notificationChannel: r.notification_channel, language: r.language,
    })),
    messagingLinks: [...rows('messaging_links')].sort((a, b) => Number(a.seq) - Number(b.seq)).map((r) => ({ id: r.id, subjectType: r.subject_type, subjectId: r.subject_id, status: r.status })),
    pushSubscriptions: rows('push_subscriptions').map((r) => ({ id: r.id, subjectType: r.subject_type, subjectId: r.subject_id, permission: r.permission })),
    refillRequests: rows('refill_requests').map((r) => ({ id: r.id, prescriptionId: r.prescription_id, status: r.status, routedTo: r.routed_to, requestedAt: r.requested_at })),
    calendarSubscriptions: rows('calendar_subscriptions').map((r) => ({ patientId: r.patient_id })),
    auditEvents: rows('audit_events').map((r) => ({ id: r.id, type: r.type })),
    doses: [],
    drafts: [],
  } as unknown as StoreState;
}

function compareStore(store: StoreState, counts: Record<string, number>, backend: 'mock' | 'postgres'): { ok: boolean; table: string } {
  const expected = JSON.parse(readFileSync('tests/fixtures/seed-expected.json', 'utf8')) as Json;
  const rows: string[] = [];
  let ok = true;

  const line = (present: boolean, valuesOk: boolean, label: string) => {
    const good = present && valuesOk;
    ok = ok && good;
    rows.push(`${good ? '✓' : '✗'}  present:${present ? 'y' : 'N'}  values:${valuesOk ? 'y' : 'N'}  ${label}`);
  };

  // ---- Counts (the seed's own counts, floors and ceilings) ----
  const actualCounts: Record<string, number> = {
    accounts: store.accounts.length,
    patients: store.patients.length,
    caregivers: store.caregivers.length,
    prescriptions: store.prescriptions.length,
    alerts: store.alerts.length,
    settings: store.settings.length,
    messagingLinks: store.messagingLinks.length,
    pushSubscriptions: store.pushSubscriptions.length,
    refillRequests: store.refillRequests.length,
    calendarSubscriptions: store.calendarSubscriptions.length,
  };
  for (const [key, expectedCount] of Object.entries(counts)) {
    if (key === 'auditEventTypesPresent') continue;
    const actual = actualCounts[key];
    const good = actual === expectedCount;
    ok = ok && good;
    rows.push(`${good ? '✓' : '✗'}  count ${key}: expected ${expectedCount}, got ${actual}`);
  }

  // ---- Accounts ----
  const expAccounts = expected.accounts as { civilId: string; name: string; roles: string[] }[];
  for (const a of expAccounts) {
    const row = store.accounts.find((x) => x.civilId === a.civilId);
    const valuesOk = !!row && row.name === a.name && JSON.stringify([...row.roles].sort()) === JSON.stringify([...a.roles].sort());
    line(!!row, valuesOk, `Account ${a.name} (${a.civilId})`);
  }
  const extraAccounts = store.accounts.filter((x) => !expAccounts.some((a) => a.civilId === x.civilId));
  for (const x of extraAccounts) { ok = false; rows.push(`✗  EXTRA account not in the seed: ${x.id} ${x.name}`); }
  const noAccountCivilId = expected.noAccountCivilId as string;
  if (store.accounts.some((a) => a.civilId === noAccountCivilId)) { ok = false; rows.push(`✗  ${noAccountCivilId} must have NO Account row`); }

  // ---- Patients ----
  const expPatients = expected.patients as { civilId: string; name: string; onboardingCompleted: boolean }[];
  for (const p of expPatients) {
    const row = store.patients.find((x) => x.civilId === p.civilId);
    const valuesOk = !!row && row.name === p.name && row.onboardingCompleted === p.onboardingCompleted;
    line(!!row, valuesOk, `Patient ${p.name}`);
  }

  // ---- Prescriptions (keyed by the seed's own rx-* ids) ----
  const expRx = expected.prescriptions as Record<string, Json>;
  for (const [id, e] of Object.entries(expRx)) {
    const row = store.prescriptions.find((x) => x.id === id);
    const patientId = patientIdFor(store, e.patientCivilId as string);
    let valuesOk = !!row && row.patientId === patientId;
    if (valuesOk && row) {
      if (e.genericName !== undefined) valuesOk &&= row.drug.genericName === e.genericName;
      if (e.brandName !== undefined) valuesOk &&= row.drug.brandName === e.brandName;
      if (e.strengthMg !== undefined) valuesOk &&= row.drug.strengthMg === e.strengthMg;
      if (e.strengthUnit !== undefined) valuesOk &&= row.drug.strengthUnit === e.strengthUnit;
      if (e.dosingPattern !== undefined) valuesOk &&= row.dosingPattern === e.dosingPattern;
      if (e.doseTimes !== undefined) valuesOk &&= JSON.stringify(row.doseTimes) === JSON.stringify(e.doseTimes);
      if (e.startDate !== undefined) valuesOk &&= row.startDate === e.startDate;
      if (e.durationDays !== undefined) valuesOk &&= row.durationDays === e.durationDays;
      if (e.status !== undefined) valuesOk &&= row.status === e.status;
      if (e.discontinuedAt !== undefined) valuesOk &&= row.discontinuedAt === e.discontinuedAt;
      if (e.needsReview !== undefined) valuesOk &&= row.needsReview === e.needsReview;
      if (e.fieldReviewStatus !== undefined) valuesOk &&= row.fieldReviewStatus === e.fieldReviewStatus;
      if (e.dispensed !== undefined) valuesOk &&= row.dispensing?.totalQuantityDispensed === e.dispensed;
    }
    line(!!row, valuesOk, `Prescription ${id}`);
  }
  const extraRx = store.prescriptions.filter((x) => !(x.id in expRx));
  for (const x of extraRx) { ok = false; rows.push(`✗  EXTRA prescription not in the seed: ${x.id}`); }

  // ---- Alerts ----
  const expAlerts = expected.alerts as Record<string, Json>;
  for (const [id, e] of Object.entries(expAlerts)) {
    const row = store.alerts.find((x) => x.id === id);
    const patientId = patientIdFor(store, e.patientCivilId as string);
    const valuesOk = !!row && row.patientId === patientId && row.severity === e.severity && row.reviewStatus === e.reviewStatus &&
      (e.reviewerDecision === undefined || row.reviewerDecision === e.reviewerDecision) &&
      (e.createdAt === undefined || row.createdAt === e.createdAt) &&
      JSON.stringify(row.involvedPrescriptionIds) === JSON.stringify(e.involvedRx);
    line(!!row, valuesOk, `InteractionAlert ${id}`);
  }

  // ---- Settings ----
  const expSettings = expected.settings as Record<string, Json>;
  for (const [civilId, e] of Object.entries(expSettings)) {
    const patientId = patientIdFor(store, civilId);
    const row = store.settings.find((x) => x.patientId === patientId);
    const valuesOk = !!row && Object.entries(e).every(([k, val]) => (row as unknown as Json)[k] === val);
    line(!!row, valuesOk, `Settings for ${civilId}`);
  }
  const noSettingsCivilId = expected.noSettingsRowFor as string;
  const noSettingsPatientId = patientIdFor(store, noSettingsCivilId);
  if (store.settings.some((s) => s.patientId === noSettingsPatientId)) { ok = false; rows.push(`✗  ${noSettingsCivilId} (بدر) must have NO Settings row`); }

  // ---- MessagingLink ----
  const expLinks = expected.messagingLinks as { subjectCivilId?: string; caregiverOfCivilId?: string; status: string }[];
  const usedLinkIds = new Set<string>();
  for (const e of expLinks) {
    const subjectId = e.subjectCivilId ? patientIdFor(store, e.subjectCivilId) : caregiverIdFor(store, e.caregiverOfCivilId!, '255031200187');
    const row = store.messagingLinks.find((x) => x.subjectId === subjectId && x.status === e.status && !usedLinkIds.has(x.id));
    if (row) usedLinkIds.add(row.id);
    line(!!row, !!row, `MessagingLink ${e.subjectCivilId ?? e.caregiverOfCivilId} → ${e.status}`);
  }
  const extraLinks = store.messagingLinks.filter((x) => !usedLinkIds.has(x.id));
  for (const x of extraLinks) { ok = false; rows.push(`✗  EXTRA MessagingLink not in the seed: ${x.id}`); }
  const noLinkCivilId = expected.noMessagingLinkFor as string;
  const noLinkPatientId = patientIdFor(store, noLinkCivilId);
  if (store.messagingLinks.some((l) => l.subjectId === noLinkPatientId)) { ok = false; rows.push(`✗  ${noLinkCivilId} (بدر) must have NO MessagingLink row`); }

  // ---- PushSubscription ----
  const expPush = expected.pushSubscriptions as { subjectCivilId?: string; caregiverOfCivilId?: string; permission: string }[];
  const usedPushIds = new Set<string>();
  for (const e of expPush) {
    const subjectId = e.subjectCivilId ? patientIdFor(store, e.subjectCivilId) : caregiverIdFor(store, e.caregiverOfCivilId!, '255031200187');
    const row = store.pushSubscriptions.find((x) => x.subjectId === subjectId && x.permission === e.permission && !usedPushIds.has(x.id));
    if (row) usedPushIds.add(row.id);
    line(!!row, !!row, `PushSubscription ${e.subjectCivilId ?? e.caregiverOfCivilId} → ${e.permission}`);
  }
  const extraPush = store.pushSubscriptions.filter((x) => !usedPushIds.has(x.id));
  for (const x of extraPush) { ok = false; rows.push(`✗  EXTRA PushSubscription not in the seed: ${x.id}`); }
  const noPushCivilId = expected.noPushSubscriptionFor as string;
  const noPushPatientId = patientIdFor(store, noPushCivilId);
  if (store.pushSubscriptions.some((p) => p.subjectId === noPushPatientId)) { ok = false; rows.push(`✗  ${noPushCivilId} (بدر) must have NO PushSubscription row`); }

  // ---- RefillRequest ----
  const expRefills = expected.refillRequests as { prescriptionId: string; routedTo: string; status: string; requestedAt?: string }[];
  for (const e of expRefills) {
    const row = store.refillRequests.find((x) => x.prescriptionId === e.prescriptionId && x.status === e.status);
    const valuesOk = !!row && row.routedTo === e.routedTo && (e.requestedAt === undefined || row.requestedAt.startsWith(e.requestedAt));
    line(!!row, valuesOk, `RefillRequest ${e.prescriptionId} (${e.status})`);
  }

  // ---- CalendarSubscription ----
  const expCal = expected.calendarSubscriptions as { patientCivilId: string }[];
  for (const e of expCal) {
    const patientId = patientIdFor(store, e.patientCivilId);
    const row = store.calendarSubscriptions.find((x) => x.patientId === patientId);
    line(!!row, !!row, `CalendarSubscription for ${e.patientCivilId}`);
  }

  // ---- Caregivers (seed table order; سارة appears twice, disambiguated by patientCivilId) ----
  const expCaregivers = expected.caregivers as Json[];
  for (const e of expCaregivers) {
    const patientId = patientIdFor(store, e.patientCivilId as string);
    const row = store.caregivers.find((c) => c.civilId === e.civilId && c.linkedPatientId === patientId);
    let valuesOk = !!row && row.status === e.status && row.relationship === e.relationship && row.invitedAt.startsWith(e.invitedAt as string);
    if (valuesOk && row) {
      if (e.acceptedAt !== undefined) valuesOk &&= !!row.acceptedAt && row.acceptedAt.startsWith(e.acceptedAt as string);
      if (e.declinedAt !== undefined) valuesOk &&= !!row.declinedAt && row.declinedAt.startsWith(e.declinedAt as string);
      if (e.revokedAt !== undefined) valuesOk &&= !!row.revokedAt && row.revokedAt.startsWith(e.revokedAt as string);
      if (e.expiresAt !== undefined) valuesOk &&= !!row.expiresAt && row.expiresAt.startsWith(e.expiresAt as string);
      if (e.acceptedAtUnset) valuesOk &&= row.acceptedAt === undefined;
    }
    line(!!row, valuesOk, `Caregiver ${e.civilId} → patient ${e.patientCivilId} (${e.status})`);
  }

  // ---- AuditEvent type counts ----
  const typeCounts = new Map<string, number>();
  for (const ev of store.auditEvents) typeCounts.set(ev.type, (typeCounts.get(ev.type) ?? 0) + 1);
  const expTypeCounts = expected.auditEventTypeCounts as Record<string, number>;
  for (const [type, n] of Object.entries(expTypeCounts)) {
    const actual = typeCounts.get(type) ?? 0;
    const good = actual === n;
    ok = ok && good;
    rows.push(`${good ? '✓' : '✗'}  AuditEvent type "${type}": expected ×${n}, got ×${actual}`);
  }
  const presentTypesCount = typeCounts.size;
  const expectedPresent = counts.auditEventTypesPresent as number;
  const presentOk = presentTypesCount === expectedPresent;
  ok = ok && presentOk;
  rows.push(`${presentOk ? '✓' : '✗'}  distinct AuditEvent.type values present: expected ${expectedPresent}, got ${presentTypesCount}`);
  const absentTypes = expected.auditEventTypesAbsent as string[];
  for (const t of absentTypes) {
    const present = typeCounts.has(t);
    if (present) ok = false;
    rows.push(`${!present ? '✓' : '✗'}  "${t}" absent by design: ${!present ? 'confirmed absent' : 'UNEXPECTEDLY PRESENT'}`);
  }

  const header = `Seed diff${backend === 'postgres' ? ' [postgres]' : ''} — ${ok ? 'PASS' : 'FAIL'} (${rows.filter((r) => r.startsWith('✓')).length}/${rows.length} lines green)`;
  return { ok, table: [header, ...rows].join('\n') };
}

/**
 * Verification: calls every one of the 56 published functions with a seeded argument, under the
 * seeded session each needs ("as حمد", "as سارة", "as عبدالله", "as ناصر", "as د. خالد", "as م.
 * دانة" — docs/briefs/WP1.md §8), and prints `name → JSON`. Also writes `tests/fixtures/shapes.json`
 * so `scripts/guards/seed-invariants.ts` (guard S, item h) can scan every returned shape for a
 * Civil ID without re-running every function itself.
 *
 * `next/headers`'s `cookies()` has no request context in a plain `tsx` run — `lib/session/cookie.ts`
 * falls back to an in-memory session set here via `setScriptSession` (script/test use only).
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { reset } from '../lib/data/mock/store';
import { setScriptSession } from '../lib/session/cookie';
import type { Session } from '../types/views';

/**
 * P2-WP1 — `--backend=postgres`: sets JURAH_DATA_BACKEND BEFORE the seam is imported (the imports
 * below are dynamic for exactly that reason), re-seeds the database first, runs the same calls,
 * and prints each shape beside a byte comparison with tests/fixtures/shapes.json — it NEVER
 * rewrites the fixture (the fixture is the mock's recorded reference). A function that throws
 * (46 + 4 are not implemented until WP2/WP3/WP5) is recorded as THROWS and counted, not hidden.
 * Without JURAH_DATABASE_URL it fails loudly.
 */
const POSTGRES = process.argv.includes('--backend=postgres');
if (POSTGRES) process.env.JURAH_DATA_BACKEND = 'postgres';
const data = await import('../lib/data/index');
const sessionApi = await import('../lib/session/index');

const SESSIONS = {
  hamad: { subjectId: 'pt-01', role: 'patient' } as Session,
  fatima: { subjectId: 'pt-02', role: 'patient' } as Session,
  sara: { subjectId: 'pt-03', role: 'patient' } as Session,
  badr: { subjectId: 'pt-04', role: 'patient' } as Session,
  abdullah: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } as Session,
  naser: { subjectId: 'cg-03', pendingInvitationOnly: true } as Session,
  khalidReviewer: { subjectId: 'acc-10', role: 'reviewer' } as Session,
  khalidAdmin: { subjectId: 'acc-10', role: 'admin' } as Session,
  dana: { subjectId: 'acc-11', role: 'admin' } as Session,
} satisfies Record<string, Session>;

/** Overridden per-actor after a mutation changes what session that actor now holds (e.g. ناصر
 * after acceptInvitation) — a script-only concern; the data layer itself is stateless per call. */
const liveSessions: Partial<Record<keyof typeof SESSIONS, Session>> = {};

async function as<T>(who: keyof typeof SESSIONS | null, fn: () => Promise<T>): Promise<T> {
  setScriptSession(who ? (liveSessions[who] ?? SESSIONS[who]) : null);
  return fn();
}

function blob(bytes: number): Blob {
  return new Blob([new Uint8Array(bytes)]);
}

/** A deep, JSON-serialisable snapshot taken NOW — later mutations must never retroactively change
 * an already-recorded shape (the store's records are mutated in place, not replaced). */
function snapshot<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

async function main() {
  reset();
  if (POSTGRES) {
    process.env.JURAH_DATA_BACKEND = 'postgres';
    const { reseedOverUrl } = await import('./db/seed');
    if (!(await reseedOverUrl())) {
      console.error('!! print-shapes --backend=postgres — JURAH_DATABASE_URL not set — NOTHING CALLED, NOT A PASS');
      process.exit(1);
    }
  }
  const shapes: Record<string, unknown> = {};
  const throws: Record<string, string> = {};
  const record = async (name: string, who: keyof typeof SESSIONS | null, fn: () => Promise<unknown>) => {
    if (!POSTGRES) { shapes[name] = snapshot(await as(who, fn)); return; }
    try { shapes[name] = snapshot(await as(who, fn)); } catch (e) { throws[name] = e instanceof Error ? e.message : String(e); }
  };
  const tryAs = async <T,>(who: keyof typeof SESSIONS | null, fn: () => Promise<T>): Promise<T | undefined> => {
    if (!POSTGRES) return as(who, fn);
    try { return await as(who, fn); } catch (e) { throws[`(setup) ${String(fn).slice(0, 60)}`] = e instanceof Error ? e.message : String(e); return undefined; }
  };

  // ---- Session module (5) ----
  await record('signIn(حمد)', null, () => sessionApi.signIn('255031200187'));
  await record('getSession (as حمد)', 'hamad', () => sessionApi.getSession());
  await record('getRoleOptions (as سارة)', 'sara', () => sessionApi.getRoleOptions());
  await record('chooseRole (as سارة → patient)', 'sara', () => sessionApi.chooseRole({ role: 'patient', subjectId: 'pt-03' }));
  await record('signOut (as حمد)', 'hamad', () => sessionApi.signOut());

  // ---- Patient and settings ----
  await record('getPatient(pt-01)', 'hamad', () => data.getPatient('pt-01'));
  await record('updatePatientPhone(pt-01)', 'hamad', () => data.updatePatientPhone('pt-01', '99887766'));
  await record('completeOnboarding(pt-04)', 'badr', () => data.completeOnboarding('pt-04'));
  await record('getSettings(pt-04, no row)', 'badr', () => data.getSettings('pt-04'));
  await record('getSettings(pt-01)', 'hamad', () => data.getSettings('pt-01'));
  await record('updateSettings(pt-01)', 'hamad', () => data.updateSettings('pt-01', { refillAlertsEnabled: true }));

  // ---- Prescriptions and doses ----
  await record('getPrescriptions(pt-01)', 'hamad', () => data.getPrescriptions('pt-01'));
  await record('getPrescription(rx-001)', 'hamad', () => data.getPrescription('rx-001'));
  await record('getDosesForDay(pt-01, 2026-09-21)', 'hamad', () => data.getDosesForDay('pt-01', '2026-09-21'));
  await record('getDoseHistory(rx-008)', 'sara', () => data.getDoseHistory('rx-008'));
  await record('getRecentDoses(pt-03, 7)', 'sara', () => data.getRecentDoses('pt-03', 7));
  const extraction = await tryAs('hamad', () => data.submitPrescriptionImage('pt-01', blob(500)));
  if (extraction === undefined) throws['submitPrescriptionImage(pt-01)'] = 'see (setup)';
  else shapes['submitPrescriptionImage(pt-01)'] = snapshot(extraction);
  if (extraction && 'draftId' in extraction) {
    await record('savePrescriptionDraft(pt-01)', 'hamad', () => data.savePrescriptionDraft('pt-01', extraction.draftId));
  }

  // ---- Safety ----
  await record('getAlerts(pt-01)', 'hamad', () => data.getAlerts('pt-01'));
  await record('getAlert(ia-001)', 'hamad', () => data.getAlert('ia-001'));
  await record('checkDrugPhoto(pt-01)', 'hamad', () => data.checkDrugPhoto('pt-01', blob(500)));

  // ---- Supply ----
  await record('getRefillOverview(pt-01)', 'hamad', () => data.getRefillOverview('pt-01'));
  await record('requestRefill(pt-01, rx-002)', 'hamad', () => data.requestRefill('pt-01', 'rx-002'));
  await record('getRefillRequests(pt-01)', 'hamad', () => data.getRefillRequests('pt-01'));

  // ---- Calendar ----
  await record('getCalendarSubscription(pt-03)', 'sara', () => data.getCalendarSubscription('pt-03'));
  await record('enableCalendarSync(pt-01)', 'hamad', () => data.enableCalendarSync('pt-01'));

  // ---- Activity ----
  await record('getActivity(pt-01)', 'hamad', () => data.getActivity('pt-01'));

  // ---- Notifications ----
  await record('getPushCapability()', null, () => data.getPushCapability());
  await record('getPushState(patient:pt-03)', 'sara', () => data.getPushState({ subjectType: 'patient', subjectId: 'pt-03' }));
  await record('requestPushPermission(patient:pt-01)', 'hamad', () => data.requestPushPermission({ subjectType: 'patient', subjectId: 'pt-01' }));
  await record('disablePush(patient:pt-01)', 'hamad', () => data.disablePush({ subjectType: 'patient', subjectId: 'pt-01' }));
  await record('sendTestNotification(patient:pt-03)', 'sara', () => data.sendTestNotification({ subjectType: 'patient', subjectId: 'pt-03' }));
  await record('getMessagingLink(patient:pt-02)', 'fatima', () => data.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-02' }));
  await record('startMessagingLink(caregiver:cg-01)', 'abdullah', () => data.startMessagingLink({ subjectType: 'caregiver', subjectId: 'cg-01' }));
  await record('disconnectMessaging(patient:pt-03)', 'sara', () => data.disconnectMessaging({ subjectType: 'patient', subjectId: 'pt-03' }));
  await record('sendTestMessage(patient:pt-03)', 'sara', () => data.sendTestMessage({ subjectType: 'patient', subjectId: 'pt-03' }));

  // ---- Caregivers, patient side ----
  await record('getCaregivers(pt-01)', 'hamad', () => data.getCaregivers('pt-01'));
  // Labels deliberately never embed the Civil ID argument itself (guard S, item h, scans this
  // whole file for one) — "with account" / "no account" name which seed row each call exercises.
  // P2-WP5 (Postgres run only): the lookup requires a session (E-14) — a null session gets the null
  // shape for BOTH IDs — so the Postgres run calls it as حمد, the inviting patient (like D-024).
  await record('lookupMaskedName(عبدالله, has an account)', POSTGRES ? 'hamad' : null, () => data.lookupMaskedName('285061400412'));
  await record('lookupMaskedName(no account)', POSTGRES ? 'hamad' : null, () => data.lookupMaskedName('277091900873'));
  const invited = await tryAs('hamad', () => data.inviteCaregiver('pt-01', { civilId: '299999900000', name: 'اختبار', relationship: 'قريب' }));
  if (invited === undefined) throws['inviteCaregiver(pt-01)'] = 'see (setup)';
  else shapes['inviteCaregiver(pt-01)'] = snapshot(invited);
  await record('cancelInvitation(new invite)', 'hamad', () => data.cancelInvitation(invited?.id ?? ''));
  await record('revokeCaregiver(cg-01)', 'hamad', () => data.revokeCaregiver('cg-01'));

  // ---- Consent, invited side ----
  await record('getPendingInvitationsForSubject (as سارة)', 'sara', () => data.getPendingInvitationsForSubject());
  // D-024 (Postgres run only): consent data is readable only by the invited Civil ID's session (E-24).
  await record('getInvitationForConsent(cg-08)', POSTGRES ? 'sara' : null, () => data.getInvitationForConsent('cg-08'));
  const naserAccepted = await tryAs('naser', () => data.acceptInvitation('cg-03'));
  if (naserAccepted === undefined) throws['acceptInvitation(cg-03, as ناصر)'] = 'see (setup)';
  else {
    shapes['acceptInvitation(cg-03, as ناصر)'] = snapshot(naserAccepted);
    liveSessions.naser = naserAccepted; // ناصر is now an active caregiver (cg-03), not pending-only
  }
  await record('declineInvitation(cg-08, as سارة)', 'sara', () => data.declineInvitation('cg-08'));

  // ---- Caregiver shell ---- (freshly-accepted ناصر, cg-03, is now an active caregiver)
  await record('getCaregiverLink(cg-03)', 'naser', () => data.getCaregiverLink('cg-03'));
  await record('selfUnlink(cg-03)', 'naser', () => data.selfUnlink('cg-03'));

  // ---- Clinic ----
  await record('getReviewQueue (as د. خالد)', 'khalidReviewer', () => data.getReviewQueue());
  await record('getFieldConfirmationQueue (as د. خالد)', 'khalidReviewer', () => data.getFieldConfirmationQueue());
  await record('getAlertForReview(ia-001, as د. خالد)', 'khalidReviewer', () => data.getAlertForReview('ia-001'));
  await record('submitReviewDecision(ia-001, as د. خالد)', 'khalidReviewer', () => data.submitReviewDecision('ia-001', 'confirmed', 'ملاحظة المراجع'));
  // CR-115: the clinician's own profile, as the reviewer and as the admin-only account.
  await record('getClinicianProfile (as د. خالد)', 'khalidReviewer', () => data.getClinicianProfile());
  await record('getClinicianProfile (as م. دانة)', 'dana', () => data.getClinicianProfile());
  await record('getFlaggedPrescription(rx-006, as د. خالد)', 'khalidReviewer', () => data.getFlaggedPrescription('rx-006'));
  // CR-060 (Gate 5): a confirm carrying ALL FIVE values (CR-002 invariant (1) — the database refuses a
  // confirmed record without them). `drug` keeps the stored genericName: the mock replaces `drug`
  // wholesale, the backend merges only brandName/strengthMg (D-8), and this way both agree byte for byte.
  await record('confirmPrescriptionFields(rx-006, as د. خالد)', 'khalidReviewer', () => data.confirmPrescriptionFields('rx-006', { drug: { genericName: '(unreadable)', brandName: 'Panadol', strengthMg: 500 }, frequencyPerDay: 1, startDate: '2026-09-20', doseTimes: ['09:00'] }, 'تم التأكيد'));
  // CR-060: a FIRST return, of a still-pending flagged record (rx-007 is seeded already returned, and
  // rx-006 was just confirmed). فاطمة scans an unreadable image (1–99 bytes → needs_review) and saves
  // it; the reviewer returns that new record. Setup calls, not recorded.
  const flaggedDraft = await tryAs('fatima', () => data.submitPrescriptionImage('pt-02', blob(50)));
  const flagged = flaggedDraft && 'draftId' in flaggedDraft ? await tryAs('fatima', () => data.savePrescriptionDraft('pt-02', flaggedDraft.draftId)) : undefined;
  await record('returnPrescriptionToClinic(new flagged prescription, as د. خالد)', 'khalidReviewer', () => data.returnPrescriptionToClinic(flagged?.id ?? '', 'الجرعة غير واضحة'));
  await record('getAuditLog (as م. دانة)', 'dana', () => data.getAuditLog({}));

  // ---- Resilience ----
  // D-5 (Postgres run only): the snapshot store is scoped to the caller (E-40) — read as حمد, who cached it.
  await record('readLastKnownSnapshot(getPatient:pt-01)', POSTGRES ? 'hamad' : null, () => data.readLastKnownSnapshot('getPatient:pt-01'));

  for (const [name, value] of Object.entries(shapes)) {
    console.log(`${name} → ${JSON.stringify(value)}`);
  }
  if (!POSTGRES) {
    writeFileSync('tests/fixtures/shapes.json', JSON.stringify(shapes, null, 2));
    return;
  }
  // Postgres: compare against the mock's recorded fixture — never overwrite it.
  const fixture = JSON.parse(readFileSync('tests/fixtures/shapes.json', 'utf8')) as Record<string, unknown>;
  let same = 0;
  console.log('\n— byte comparison with tests/fixtures/shapes.json —');
  for (const name of Object.keys(fixture)) {
    if (name in throws) { console.log(`THROWS     ${name} — ${throws[name]}`); continue; }
    // CR-041 (+ its Gate 3 extension to relatedId, D-15 and WP6's W6-4): a CREATED row's id — at any
    // depth, in id / relatedId / prescriptionId / draftId — and a freshly minted link or calendar
    // token/URL are "present and a string"; everything else, key order included, is byte-exact.
    const { value, ids, tokens } = opaque(fixture[name], shapes[name]);
    const got = JSON.stringify(value);
    const want = JSON.stringify(fixture[name]);
    const ok = got === want;
    if (ok) same++;
    const rule = ids + tokens > 0 ? ` (CR-041: ${ids} opaque id${ids === 1 ? '' : 's'}${tokens ? `, ${tokens} minted token/URL` : ''})` : '';
    console.log(`${ok ? 'IDENTICAL ' : 'DIFFERS   '} ${name}${ok ? rule : ` — first difference at char ${firstDiff(got, want)}: got …${got.slice(Math.max(0, firstDiff(got, want) - 20), firstDiff(got, want) + 60)}… · recorded …${want.slice(Math.max(0, firstDiff(got, want) - 20), firstDiff(got, want) + 60)}…`}`);
  }
  for (const name of Object.keys(throws).filter((n) => n.startsWith('(setup)'))) console.log(`THROWS     ${name} — ${throws[name]}`);
  console.log(`\n${same} identical · ${Object.keys(throws).length} threw · ${Object.keys(fixture).length - same - Object.keys(throws).filter((n) => !n.startsWith('(setup)')).length} differ — of ${Object.keys(fixture).length} recorded shapes`);
  const { closeDb } = await import('./db/seed');
  await closeDb();
}

/** A created row's id as the mock recorded it (counter ids — the database mints opaque ones). */
const CREATED_ID = /^(rx-draft-\d+(-\d{8}-\d{4})?|draft-\d+|rf-03|cg-09|ml-live-\d+|ae-live-\d{4})$/;
const ID_KEYS = new Set(['id', 'relatedId', 'prescriptionId', 'draftId']);
/** Freshly minted secrets/URLs the mock built from counters or ids (D-15, W6-4). */
const MINTED = /^(mock-token-live-\d+|mock-token-cal-pt-01|webcal:\/\/jurah\.app\/calendar\/pt-01\.ics)$/;
const MINTED_KEYS = new Set(['linkToken', 'token', 'icsUrl']);

/** Walks `actual` beside the recorded value; where the recorded leaf is a created id (or a minted
 * token/URL) under one of those keys and the actual leaf is a non-empty string, the recorded value
 * is substituted — and counted, so the line says how often the rule applied. Nothing else changes. */
function opaque(recorded: unknown, actual: unknown, key = ''): { value: unknown; ids: number; tokens: number } {
  if (typeof recorded === 'string' && typeof actual === 'string' && actual !== '' && actual !== recorded) {
    if (ID_KEYS.has(key) && CREATED_ID.test(recorded)) return { value: recorded, ids: 1, tokens: 0 };
    if (MINTED_KEYS.has(key) && MINTED.test(recorded)) return { value: recorded, ids: 0, tokens: 1 };
    return { value: actual, ids: 0, tokens: 0 };
  }
  if (Array.isArray(recorded) && Array.isArray(actual)) {
    let ids = 0; let tokens = 0;
    const value = actual.map((a, i) => { const r = opaque(recorded[i], a, key); ids += r.ids; tokens += r.tokens; return r.value; });
    return { value, ids, tokens };
  }
  if (recorded && actual && typeof recorded === 'object' && typeof actual === 'object' && !Array.isArray(recorded) && !Array.isArray(actual)) {
    let ids = 0; let tokens = 0;
    const out: Record<string, unknown> = {};
    for (const [k, a] of Object.entries(actual as Record<string, unknown>)) {
      const r = opaque((recorded as Record<string, unknown>)[k], a, k); ids += r.ids; tokens += r.tokens; out[k] = r.value;
    }
    return { value: out, ids, tokens };
  }
  return { value: actual, ids: 0, tokens: 0 };
}

function firstDiff(a: string, b: string): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}

main();

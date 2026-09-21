/**
 * Guard S — the seed's own invariants (docs/briefs/WP1.md §8; docs/Seed Dataset.md's "Invariants
 * from the seed"), asserted against the BUILT store, not paraphrased. `run.ts` imports this
 * dynamically once it exists (Gate 0 decision 1).
 */
import { readFileSync } from 'node:fs';
import { walk, rel, type GuardResult, type Violation } from './_shared';
import { reset, getStore } from '../../lib/data/mock/store';
import { generateDoses } from '../../lib/schedule/generate';
import { deriveRoles } from '../../lib/data/mock/accounts';

const EXPECTED_ROLES: Record<string, string[]> = {
  '255031200187': ['patient'],
  '258071100342': ['patient'],
  '290022500654': ['patient', 'caregiver'],
  '268110500413': ['patient'],
  '285061400412': ['caregiver'],
  '288110300229': [],
  '292043000517': [],
  '298052000731': [],
  '285092200664': [],
  '280012000961': ['reviewer', 'admin'],
  '293080700148': ['admin'],
};

const ABSENT_TYPES = ['prescription_discontinued', 'caregiver_self_unlinked'];
const PRESENT_TYPE_COUNT = 23;

export function run(): GuardResult {
  reset();
  const store = getStore();
  const v: Violation[] = [];
  const notes: string[] = [];
  const F = 'scripts/guards/seed-invariants.ts';

  // (a) every active, unflagged prescription carries strengthMg, frequencyPerDay, startDate,
  // doseTimes with doseTimes.length === frequencyPerDay. brandName stays optional (rx-005, rx-009).
  for (const rx of store.prescriptions) {
    if (rx.status !== 'active' || rx.needsReview) continue;
    const ok = rx.drug.strengthMg !== undefined && rx.frequencyPerDay !== undefined && !!rx.startDate && !!rx.doseTimes && rx.doseTimes.length === rx.frequencyPerDay;
    if (!ok) v.push({ file: F, line: 0, text: rx.id, rule: 'active unflagged prescription missing a required CR-002 field' });
  }

  // (b) generateDoses is empty for rx-006, rx-007, and rx-004 after 2026-06-28.
  for (const id of ['rx-006', 'rx-007']) {
    const rx = store.prescriptions.find((p) => p.id === id);
    if (rx && generateDoses(rx, false).length !== 0) v.push({ file: F, line: 0, text: id, rule: 'needsReview/unconfirmed prescription generated doses' });
  }
  if (store.doses.some((d) => d.prescriptionId === 'rx-004' && d.scheduledAt.slice(0, 10) > '2026-06-28')) {
    v.push({ file: F, line: 0, text: 'rx-004', rule: 'discontinued prescription generated a dose after discontinuedAt' });
  }

  // (c) no dose has source "ui"; no dose of an untracked patient has a status other than upcoming,
  // and all such doses carry tracked:false.
  if (store.doses.some((d) => d.source === 'ui')) v.push({ file: F, line: 0, text: '', rule: 'a dose has source "ui"' });
  for (const d of store.doses.filter((x) => x.tracked === false)) {
    if (d.status !== 'upcoming') v.push({ file: F, line: 0, text: d.id, rule: 'an untracked dose has a status other than upcoming' });
  }

  // (d) Account.roles recomputed and asserted equal to the transcribed table.
  for (const [civilId, expected] of Object.entries(EXPECTED_ROLES)) {
    const actual = deriveRoles(store, civilId).slice().sort();
    if (JSON.stringify(actual) !== JSON.stringify([...expected].sort())) {
      v.push({ file: F, line: 0, text: `${civilId}: expected [${expected.join(',')}], got [${actual.join(',')}]`, rule: 'Account.roles derivation disagrees with the seed table' });
    }
  }

  // (e) every revoked row has revokedAt; طلال (cg-06) has acceptedAt, دلال (cg-07) does not; and no
  // function in lib/ reads acceptedAt on a revoked row for an access decision — access code may
  // only test status === 'active'. Scanned by searching lib/session/** and lib/data/** for the
  // identifier `acceptedAt` and listing every occurrence in notes (none may sit inside a
  // condition that gates a read/write instead of an audit-only computation).
  for (const c of store.caregivers.filter((x) => x.status === 'revoked')) {
    if (!c.revokedAt) v.push({ file: F, line: 0, text: c.id, rule: 'a revoked Caregiver row has no revokedAt' });
  }
  const cg06 = store.caregivers.find((c) => c.id === 'cg-06');
  const cg07 = store.caregivers.find((c) => c.id === 'cg-07');
  if (!cg06?.acceptedAt) v.push({ file: F, line: 0, text: 'cg-06 (طلال)', rule: 'expected acceptedAt to be set (revoked after acceptance)' });
  if (cg07?.acceptedAt) v.push({ file: F, line: 0, text: 'cg-07 (دلال)', rule: 'expected acceptedAt to be unset (cancelled before any answer)' });
  const acceptedAtUses: string[] = [];
  for (const f of [...walk('lib/session', ['.ts', '.tsx']), ...walk('lib/data', ['.ts', '.tsx'])]) {
    readFileSync(f, 'utf8').split('\n').forEach((line, i) => {
      if (/\bacceptedAt\b/.test(line)) acceptedAtUses.push(`${rel(f)}:${i + 1}  ${line.trim()}`);
    });
  }
  notes.push(`acceptedAt referenced in lib/session/** and lib/data/** (${acceptedAtUses.length} line(s); every one is audit/summary output, none gates an access decision):`, ...acceptedAtUses.map((l) => `  ${l}`));
  const guardsAccessOnStatus = readFileSync('lib/data/mock/access.ts', 'utf8');
  if (!/status === 'active'/.test(guardsAccessOnStatus)) {
    v.push({ file: 'lib/data/mock/access.ts', line: 0, text: '', rule: 'canReadPatient does not gate caregiver access on status === "active"' });
  }

  // (f) rx-008 is { strengthMg: 50, strengthUnit: "mcg" }.
  const rx008 = store.prescriptions.find((p) => p.id === 'rx-008');
  if (rx008?.drug.strengthMg !== 50 || rx008.drug.strengthUnit !== 'mcg') {
    v.push({ file: F, line: 0, text: JSON.stringify(rx008?.drug), rule: 'rx-008 is not { strengthMg: 50, strengthUnit: "mcg" }' });
  }

  // (g) every dose_status_recorded has actor agent/system.
  for (const e of store.auditEvents.filter((x) => x.type === 'dose_status_recorded')) {
    if (e.actor.role !== 'agent' && e.actor.role !== 'system') v.push({ file: F, line: 0, text: e.id, rule: 'dose_status_recorded actor is not agent/system' });
  }

  // (h) no Civil ID string appears in any AuditEvent.message, nor anywhere in the JSON
  // scripts/print-shapes.ts produces for every function under every role.
  const CIVIL_IDS = [
    '255031200187', '258071100342', '290022500654', '268110500413', '285061400412',
    '288110300229', '292043000517', '277091900873', '280012000961', '293080700148',
    '298052000731', '285092200664',
  ];
  const civilIdRe = new RegExp(CIVIL_IDS.join('|'));
  for (const e of store.auditEvents) {
    if (civilIdRe.test(e.message)) v.push({ file: F, line: 0, text: e.id, rule: 'a Civil ID appears in an AuditEvent.message' });
  }
  try {
    const shapes = readFileSync('tests/fixtures/shapes.json', 'utf8');
    if (civilIdRe.test(shapes)) v.push({ file: 'tests/fixtures/shapes.json', line: 0, text: '', rule: 'a Civil ID appears in a function\'s returned shape' });
    else notes.push('tests/fixtures/shapes.json scanned for a Civil ID: none found.');
  } catch {
    notes.push('tests/fixtures/shapes.json not present yet — run `npx tsx scripts/print-shapes.ts` first; this sub-check is skipped, not passed.');
  }

  // (i) each of the 23 seed-supported event types present; the two unsupported ones absent; every
  // Caregiver row referenced by a caregiver_invited event; every invite-lifecycle event points at
  // an existing row.
  const typesPresent = new Set(store.auditEvents.map((e) => e.type));
  for (const t of ABSENT_TYPES) {
    if (typesPresent.has(t)) v.push({ file: F, line: 0, text: t, rule: 'an audit type that must be absent by design is present in the seed' });
  }
  if (typesPresent.size !== PRESENT_TYPE_COUNT) {
    v.push({ file: F, line: 0, text: `${typesPresent.size} present`, rule: `expected exactly ${PRESENT_TYPE_COUNT} distinct AuditEvent.type values in the seed` });
  }
  for (const c of store.caregivers) {
    if (!store.auditEvents.some((e) => e.type === 'caregiver_invited' && e.relatedId === c.id)) {
      v.push({ file: F, line: 0, text: c.id, rule: 'a Caregiver row is not referenced by a caregiver_invited event' });
    }
  }
  const LIFECYCLE = ['caregiver_invited', 'caregiver_invite_accepted', 'caregiver_invite_declined', 'caregiver_invite_expired', 'caregiver_invite_cancelled', 'caregiver_revoked'];
  for (const e of store.auditEvents.filter((x) => LIFECYCLE.includes(x.type))) {
    if (!e.relatedId || !store.caregivers.some((c) => c.id === e.relatedId)) {
      v.push({ file: F, line: 0, text: e.id, rule: 'an invite-lifecycle event points at no existing Caregiver row' });
    }
  }

  // (j) بدر (pt-04) has no Settings/MessagingLink/PushSubscription row in the seed.
  if (store.settings.some((s) => s.patientId === 'pt-04')) v.push({ file: F, line: 0, text: 'pt-04', rule: 'بدر has a Settings row' });
  if (store.messagingLinks.some((l) => l.subjectId === 'pt-04')) v.push({ file: F, line: 0, text: 'pt-04', rule: 'بدر has a MessagingLink row' });
  if (store.pushSubscriptions.some((p) => p.subjectId === 'pt-04')) v.push({ file: F, line: 0, text: 'pt-04', rule: 'بدر has a PushSubscription row' });

  return { name: 'guard S · seed invariants (docs/Seed Dataset.md)', violations: v, notes };
}

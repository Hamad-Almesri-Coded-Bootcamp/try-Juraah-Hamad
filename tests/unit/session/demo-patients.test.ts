/**
 * D-041 / D-042 — the demo patients and demo doctors outside the seed. The seed's own twelve stay exactly as
 * resolve.test.ts pins them; this file proves the two additions sign in, start empty, and that the
 * SQL that adds them to a live database can never wipe what is already there.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { reset, getStore } from '@/lib/data/mock/store';
import { ALL_TEST_CIVIL_IDS, buildAccounts, buildPatients } from '@/lib/data/mock/seed';
import { DEMO_CLINICIANS, DEMO_PATIENTS, DEMO_TEST_CIVIL_IDS } from '@/lib/data/mock/demo-patients';
import { maskName } from '@/lib/format/maskedName';
import { resolveCivilId } from '@/lib/session/resolve';
import type { StoreState } from '@/lib/data/mock/types';
import { buildDemoPatientsSql } from '../../../scripts/db/add-demo-patients';

beforeEach(() => reset());

/** The seed store plus the demo rows, the way the production database holds them. */
function storeWithDemoPatients(): StoreState {
  const store = getStore();
  for (const d of DEMO_PATIENTS) {
    store.accounts.push({ id: d.accountId, civilId: d.civilId, name: d.name, roles: ['patient'] });
    store.patients.push({ id: d.patientId, civilId: d.civilId, name: d.name, language: 'ar', onboardingCompleted: d.onboardingCompleted, caregiverIds: [] });
  }
  for (const c of DEMO_CLINICIANS) {
    store.accounts.push({ id: c.accountId, civilId: c.civilId, name: c.name, roles: [...c.roles] });
  }
  return store;
}

/** Kuwait's Civil ID check digit: true only for a number that could be a real person's. */
function passesKuwaitCheckDigit(civilId: string): boolean {
  const w = [2, 1, 6, 3, 7, 9, 10, 5, 8, 4, 2];
  const sum = w.reduce((acc, wi, i) => acc + wi * Number(civilId[i]), 0);
  return 11 - (sum % 11) === Number(civilId[11]);
}

describe('D-041 — the demo patients', () => {
  it('are five: D-041\'s two and D-042\'s three, with the names the owner gave', () => {
    expect(DEMO_PATIENTS.map((p) => p.name)).toEqual([
      'هيثم حمد العجمي', 'حمد المسري', 'يوسف ناصر الكندري', 'نورة عادل الرشيدي', 'مريم سعد الشمري',
    ]);
  });

  it('D-042: two new patients not onboarded (A2 first) and one onboarded (B1 directly)', () => {
    const d042 = DEMO_PATIENTS.filter((p) => ['pt-07', 'pt-08', 'pt-09'].includes(p.patientId));
    expect(d042.filter((p) => !p.onboardingCompleted).map((p) => p.patientId)).toEqual(['pt-07', 'pt-08']);
    expect(d042.filter((p) => p.onboardingCompleted).map((p) => p.patientId)).toEqual(['pt-09']);
    expect(DEMO_PATIENTS.find((p) => p.patientId === 'pt-05')?.onboardingCompleted).toBe(false);
    expect(DEMO_PATIENTS.find((p) => p.patientId === 'pt-06')?.onboardingCompleted).toBe(false);
  });

  it('no Civil ID passes Kuwait\'s check digit, so none can be a real person\'s', () => {
    for (const c of DEMO_TEST_CIVIL_IDS) expect(passesKuwaitCheckDigit(c)).toBe(false);
  });

  it('have twelve-digit Civil IDs and ids that clash with nothing in the seed or each other', () => {
    for (const c of DEMO_TEST_CIVIL_IDS) expect(c).toMatch(/^[0-9]{12}$/);
    const seedCivilIds = new Set<string>([...ALL_TEST_CIVIL_IDS, ...buildAccounts().map((a) => a.civilId)]);
    for (const c of DEMO_TEST_CIVIL_IDS) expect(seedCivilIds.has(c)).toBe(false);
    expect(new Set(DEMO_TEST_CIVIL_IDS).size).toBe(DEMO_PATIENTS.length + DEMO_CLINICIANS.length);
    const accountIds = new Set(buildAccounts().map((a) => a.id));
    const patientIds = new Set(buildPatients().map((p) => p.id));
    const demoAccountIds = [...DEMO_PATIENTS.map((p) => p.accountId), ...DEMO_CLINICIANS.map((c) => c.accountId)];
    expect(new Set(demoAccountIds).size).toBe(demoAccountIds.length);
    for (const id of demoAccountIds) expect(accountIds.has(id)).toBe(false);
    for (const d of DEMO_PATIENTS) expect(patientIds.has(d.patientId)).toBe(false);
  });

  it('leave the seed untouched: still twelve test IDs, eleven accounts, four patients', () => {
    expect(ALL_TEST_CIVIL_IDS).toHaveLength(12);
    expect(getStore().accounts).toHaveLength(11);
    expect(getStore().patients).toHaveLength(4);
  });

  it('are on the test list: each resolves to single_role patient once the rows exist', () => {
    const store = storeWithDemoPatients();
    for (const d of DEMO_PATIENTS) {
      expect(resolveCivilId(d.civilId, store, REFERENCE_NOW)).toEqual({ kind: 'single_role', session: { subjectId: d.patientId, role: 'patient' } });
    }
  });

  it('are on the test list even without rows: no_claims, never not_in_test_list', () => {
    for (const c of DEMO_TEST_CIVIL_IDS) expect(resolveCivilId(c, getStore(), REFERENCE_NOW)).toEqual({ kind: 'no_claims' });
  });

  it('D-042: each demo doctor resolves to single_role reviewer once the account row exists', () => {
    const store = storeWithDemoPatients();
    expect(DEMO_CLINICIANS.map((c) => c.name)).toEqual(['د. ريم عبدالله القطان', 'د. فيصل جاسم الهاجري']);
    for (const c of DEMO_CLINICIANS) {
      expect(c.roles).toEqual(['reviewer']);
      expect(resolveCivilId(c.civilId, store, REFERENCE_NOW)).toEqual({ kind: 'single_role', session: { subjectId: c.accountId, role: 'reviewer' } });
    }
  });

  it('do not widen the list any further: an unlisted Civil ID is still refused', () => {
    expect(resolveCivilId('299123100999', storeWithDemoPatients(), REFERENCE_NOW)).toEqual({ kind: 'not_in_test_list' });
  });

  it('mask by rule 6: the middle name as its initial plus exactly three asterisks, a two-part name unchanged', () => {
    expect(maskName('هيثم حمد العجمي')).toBe('هيثم ح*** العجمي');
    expect(maskName('حمد المسري')).toBe('حمد المسري');
    expect(maskName('يوسف ناصر الكندري')).toBe('يوسف ن*** الكندري');
    expect(maskName('نورة عادل الرشيدي')).toBe('نورة ع*** الرشيدي');
    expect(maskName('مريم سعد الشمري')).toBe('مريم س*** الشمري');
  });
});

describe('D-041 / D-042 — scripts/db/add-demo-patients.ts', () => {
  const sql = buildDemoPatientsSql();

  it('only inserts, idempotently: no truncate, delete or update, every insert on conflict do nothing', () => {
    expect(sql).not.toMatch(/\b(truncate|delete|update|drop)\b/i);
    const inserts = sql.match(/insert into \w+/g) ?? [];
    expect(inserts).toEqual(['insert into civil_id_test_list', 'insert into accounts', 'insert into patients']);
    expect(sql.match(/on conflict do nothing;/g)).toHaveLength(3);
  });

  it('runs as the system actor, in one transaction', () => {
    expect(sql.startsWith('begin;\n')).toBe(true);
    expect(sql.trimEnd().endsWith('commit;')).toBe(true);
    expect(sql).toContain(`set_config('jurah.session', '{"role":"system"}', true)`);
  });

  it('starts each patient empty, like بدر: its own onboarding flag, no stored role, no settings/link/push/prescription row', () => {
    for (const d of DEMO_PATIENTS) {
      expect(sql).toContain(`('${d.patientId}', '${d.civilId}', '${d.name}', 'ar'::language_t, ${d.onboardingCompleted})`);
      expect(sql).toContain(`('${d.accountId}', '${d.civilId}', '${d.name}', '{}'::role_t[])`);
    }
    expect(sql).not.toMatch(/\b(settings|messaging_links|push_subscriptions|prescriptions|caregivers|audit_events)\b/);
  });

  it('D-042: gives each doctor an account holding {reviewer}, a test-list row, and no patients row', () => {
    for (const c of DEMO_CLINICIANS) {
      expect(sql).toContain(`('${c.accountId}', '${c.civilId}', '${c.name}', '{reviewer}'::role_t[])`);
      expect(sql).toContain(`('${c.civilId}')`);
      expect(sql).not.toMatch(new RegExp(`\\('pt-[0-9]+', '${c.civilId}'`));
    }
  });
});

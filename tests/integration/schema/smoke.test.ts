/**
 * Gate 0/1 smoke through the real pooler (BACKEND-PLAN risk 3; docs/briefs/P2-WP0-WP1.md):
 * withSession() really drops to jurah_app, really resolves the caller's own Civil ID inside the
 * transaction, and a forged caregiver session for a PENDING invitation reads zero rows — through
 * the seam function AND through a raw count inside withSession().
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withSession } from '@/lib/db/withSession';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import * as pg from '@/lib/data/pg';
import { maskName } from '@/lib/format/maskedName';
import type { Session } from '@/types/views';
import { S, probe, SYSTEM } from '../helpers';

const hamad: Session = { subjectId: 'pt-01', role: 'patient' };
const naserForged: Session = { subjectId: 'cg-03', role: 'caregiver', linkedPatientId: 'pt-01' };
const abdullah: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };

describe('withSession — the one SQL path', () => {
  it("runs as jurah_app, with the session GUC and REFERENCE_NOW, and resolves حمد's own civilId", async () => {
    const [row] = await withSession(hamad, (sql) => sql`
      select current_user as who, jurah_session()->>'subjectId' as subject, jurah_session()->>'civilId' as civil_id,
             iso_kw(jurah_now()) as now`);
    expect(row).toEqual({ who: 'jurah_app', subject: 'pt-01', civil_id: '255031200187', now: '2026-09-21T09:15:00+03:00' });
  });

  it('a null session sets an EMPTY GUC: jurah_session() is NULL and nothing is readable', async () => {
    const [row] = await withSession(null, (sql) => sql`select jurah_session() is null as none, (select count(*)::int from prescriptions) as n`);
    expect(row).toEqual({ none: true, n: 0 });
  });

  it('the GUC does not survive the transaction (a pooled connection carries nothing over)', async () => {
    await withSession(hamad, (sql) => sql`select 1`);
    const [row] = await getSql()`select nullif(current_setting('jurah.session', true), '') as leftover, current_user as who`;
    expect(row?.leftover ?? null).toBeNull();
    expect(row?.who).not.toBe('jurah_app');
  });

  it('civil_id_for_session is NOT executable by jurah_app (the resolution happens before the role drop)', async () => {
    await expect(withSession(hamad, (sql) => sql`select civil_id_for_session('pt-02', 'patient', false)`)).rejects.toThrow(/permission denied/);
  });
});

describe('RLS smoke — a forged PENDING caregiver session reads nothing', () => {
  it("cg-03 (pending) → getPrescriptions('pt-01') is []", async () => {
    setScriptSession(naserForged);
    expect(await pg.getPrescriptions('pt-01')).toEqual([]);
  });

  it("cg-03 (pending) → raw count(*) from prescriptions inside withSession is 0", async () => {
    const [row] = await withSession(naserForged, (sql) => sql`select current_user as who, count(*)::int as n from prescriptions`);
    expect(row).toEqual({ who: 'jurah_app', n: 0 });
  });

  it("cg-01 (active) → the same raw count for pt-01 is 4", async () => {
    const [row] = await withSession(abdullah, (sql) => sql`select count(*)::int as n from prescriptions where patient_id = 'pt-01'`);
    expect(row?.n).toBe(4);
  });

  it('every non-active caregiver row reads nothing of حمد', async () => {
    for (const id of ['cg-03', 'cg-04', 'cg-05', 'cg-06', 'cg-07']) {
      const [row] = await withSession({ subjectId: id, role: 'caregiver', linkedPatientId: 'pt-01' }, (sql) => sql`
        select (select count(*)::int from prescriptions) + (select count(*)::int from doses)
             + (select count(*)::int from interaction_alerts) + (select count(*)::int from audit_events) as n`);
      expect(row?.n, id).toBe(0);
    }
  });
});

describe('the four Gate 1 functions — byte-for-byte against tests/fixtures/shapes.json', () => {
  const shapes = JSON.parse(readFileSync('tests/fixtures/shapes.json', 'utf8')) as Record<string, unknown>;
  const same = (key: string, value: unknown) => expect(JSON.stringify(value)).toBe(JSON.stringify(shapes[key]));

  it('getPatient(pt-01) as حمد', async () => {
    setScriptSession(hamad);
    same('getPatient(pt-01)', await pg.getPatient('pt-01'));
  });
  it('getPrescriptions(pt-01) as حمد', async () => {
    setScriptSession(hamad);
    same('getPrescriptions(pt-01)', await pg.getPrescriptions('pt-01'));
  });
  it('getSettings(pt-01) as حمد (patientId first)', async () => {
    setScriptSession(hamad);
    same('getSettings(pt-01)', await pg.getSettings('pt-01'));
  });
  it('getSettings(pt-04) as بدر — no row → defaults (patientId last) and NO ROW WRITTEN', async () => {
    const count = async () => (await getSql()`select count(*)::int as n from settings where patient_id = 'pt-04'`)[0]?.n;
    expect(await count()).toBe(0);
    setScriptSession({ subjectId: 'pt-04', role: 'patient' });
    same('getSettings(pt-04, no row)', await pg.getSettings('pt-04'));
    expect(await count()).toBe(0);
  });
  it('getInvitationForConsent(cg-08) as سارة (the invited Civil ID) — exactly five keys', async () => {
    setScriptSession({ subjectId: 'pt-03', role: 'patient' });
    const v = await pg.getInvitationForConsent('cg-08');
    same('getInvitationForConsent(cg-08)', v);
    expect(Object.keys(v)).toEqual(['id', 'patientFirstName', 'relationship', 'status', 'expiresAt']);
  });
  it('getInvitationForConsent(cg-08) as حمد (not the invitee) — the expired placeholder (E-24)', async () => {
    setScriptSession(hamad);
    expect(await pg.getInvitationForConsent('cg-08')).toEqual({ id: 'cg-08', patientFirstName: '', relationship: '', status: 'expired', expiresAt: '2026-09-21T09:15:00+03:00' });
  });
  it('no projection returns a Civil ID (G9)', async () => {
    setScriptSession(hamad);
    const all = JSON.stringify([await pg.getPatient('pt-01'), await pg.getPrescriptions('pt-01'), await pg.getSettings('pt-01')]);
    expect(all).not.toMatch(/[0-9]{12}/);
  });
});

describe('functions and privileges', () => {
  it('iso_kw round-trips 2026-09-21T09:15:00+03:00', async () => {
    const [row] = await getSql()`select iso_kw('2026-09-21T09:15:00+03:00'::timestamptz) as v`;
    expect(row?.v).toBe('2026-09-21T09:15:00+03:00');
  });

  it("mask_name matches the seed's eight examples AND maskName() on the same inputs", async () => {
    const examples: [string, string][] = [
      ['عبدالله محمد عبدالعزيز المطيري', 'عبدالله م*** ع*** المطيري'],
      ['ناصر حمد المطيري', 'ناصر ح*** المطيري'],
      ['سارة يوسف العجمي', 'سارة ي*** العجمي'],
      ['منى خالد المطيري', 'منى خ*** المطيري'],
      ['بدر فهد العنزي', 'بدر ف*** العنزي'],
      ['طلال عبدالله المطيري', 'طلال ع*** المطيري'],
      ['دلال عبدالرحمن المطيري', 'دلال ع*** المطيري'],
      ['حمد المطيري', 'حمد المطيري'],
      ['د. خالد عبدالرحمن الرشيد', maskName('د. خالد عبدالرحمن الرشيد')],
      ['م. دانة فهد السالم', maskName('م. دانة فهد السالم')],
    ];
    for (const [name, expected] of examples) {
      const [row] = await getSql()`select mask_name(${name}) as m`;
      expect(row?.m, name).toBe(expected);
      expect(maskName(name), name).toBe(expected);
    }
  });

  it('G1 in grants: jurah_agent alone may UPDATE doses.status', async () => {
    const [row] = await getSql()`select
      has_column_privilege('jurah_agent', 'doses', 'status', 'UPDATE') as agent_status,
      has_column_privilege('jurah_app', 'doses', 'status', 'UPDATE') as app_status,
      has_column_privilege('jurah_app', 'doses', 'recorded_at', 'UPDATE') as app_recorded_at,
      has_column_privilege('jurah_app', 'doses', 'source', 'UPDATE') as app_source,
      has_table_privilege('jurah_agent', 'doses', 'UPDATE') as agent_table_level`;
    // has_table_privilege is false for a COLUMN-level grant; the column check is the one that binds.
    expect(row).toEqual({ agent_status: true, app_status: false, app_recorded_at: false, app_source: false, agent_table_level: false });
  });

  it('anon / authenticated / service_role hold no grant on any table or view', async () => {
    const [row] = await getSql()`select count(*)::int as n from pg_class c cross join unnest(array['anon', 'authenticated', 'service_role']) r
      where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'v')
        and (has_table_privilege(r, c.oid, 'SELECT') or has_table_privilege(r, c.oid, 'INSERT')
          or has_table_privilege(r, c.oid, 'UPDATE') or has_table_privilege(r, c.oid, 'DELETE'))`;
    expect(row?.n).toBe(0);
  });

  it('every table has RLS enabled (and not forced); both app roles are NOBYPASSRLS NOLOGIN', async () => {
    const [row] = await getSql()`select count(*)::int as tables, count(*) filter (where relrowsecurity)::int as rls,
      count(*) filter (where relforcerowsecurity)::int as forced
      from pg_class where relnamespace = 'public'::regnamespace and relkind = 'r'`;
    expect(row).toEqual({ tables: 18, rls: 18, forced: 0 });
    const roles = await getSql()`select rolname, rolbypassrls, rolcanlogin from pg_roles where rolname like 'jurah%' order by rolname`;
    expect(roles.map((r) => ({ ...r }))).toEqual([
      { rolname: 'jurah_agent', rolbypassrls: false, rolcanlogin: false },
      { rolname: 'jurah_app', rolbypassrls: false, rolcanlogin: false },
    ]);
  });

  it('settings has exactly patient_id + the seven keys (E-12)', async () => {
    const cols = await getSql()`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'settings' order by ordinal_position`;
    expect(cols.map((c) => c.column_name)).toEqual(['patient_id', 'adherence_check_in_enabled', 'adherence_check_in_frequency',
      'refill_alerts_enabled', 'calendar_sync_enabled', 'web_push_enabled', 'notification_channel', 'language']);
  });

  it('lookup_audit and audit_log_admin have no Civil ID column (G9)', async () => {
    const cols = await getSql()`select table_name, column_name from information_schema.columns where table_schema = 'public'
      and table_name in ('lookup_audit', 'audit_log_admin') and column_name ilike '%civil%'`;
    expect(cols.length).toBe(0);
  });

  it('the admin view shows masked names to an admin and nothing to anyone else', async () => {
    const admin = await probe({ role: 'jurah_app', session: S.dana }, (tx) => tx`select count(*)::int as n, count(*) filter (where patient_masked_name = 'حمد س*** المطيري')::int as masked from audit_log_admin`);
    expect(admin[0]?.n).toBe(47);
    expect(admin[0]?.masked).toBeGreaterThan(0);
    const reviewer = await probe({ role: 'jurah_app', session: S.khalidReviewer }, (tx) => tx`select count(*)::int as n from audit_log_admin`);
    expect(reviewer[0]?.n).toBe(0);
    const patient = await probe({ role: 'jurah_app', session: S.hamad }, (tx) => tx`select count(*)::int as n from audit_log_admin`);
    expect(patient[0]?.n).toBe(0);
    const system = await probe(SYSTEM, (tx) => tx`select count(*)::int as n from audit_log_admin`);
    expect(system[0]?.n).toBe(0);
  });
});

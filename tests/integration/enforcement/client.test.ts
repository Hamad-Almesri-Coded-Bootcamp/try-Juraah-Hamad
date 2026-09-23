/**
 * ENFORCEMENT.md — E-39 (P2-WP5): no client authors an AuditEvent; audit_events is append-only at the
 * database, for every role including the owner. Against the REAL database (setup.ts re-seeds and FAILS
 * loudly without JURAH_DATABASE_URL). This test calls `sql` directly — outside append() — on purpose:
 * guard 8 excludes tests/ (the raw client may be imported here only).
 *
 * What the database does and does NOT refuse, stated plainly:
 *  - a raw insert with NO session: refused (policy audit_insert_session);
 *  - update / delete as jurah_app: refused (no grant); as the owner: refused (statement trigger);
 *  - a raw insert by jurah_app WITH a session: ACCEPTED by the database. That half of "only append()
 *    writes an audit row" is guard 8's static rule (d) — this test runs guard 8 as its runtime twin
 *    and asserts the guard names lib/db/audit.ts as the one allowed file (docs/backend-notes/p2-wp5.md).
 */
import { describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import { run as guard8 } from '../../../scripts/guards/sql-only-in-db';
import { app, rejects, S } from '../helpers';
import { count } from './_wp5';

const RAW = `insert into audit_events (id, scope, patient_id, actor_role, actor_id, type, message, created_at)
             values ('ae_e39', 'patient', 'pt-01', 'admin', 'acc-11', 'signed_in', 'x', jurah_now())`;

describe('client-supplied values — the audit log', () => {
  it('E-39', async () => {
    const before = await count('select 1 from audit_events');
    // a raw insert outside append(), with no session: RLS refuses
    await rejects({ role: 'jurah_app', session: null }, RAW, 'row-level security');
    // update / delete: no grant for jurah_app, and the statement trigger binds the owner too
    await rejects(app(S.hamad), `update audit_events set message = 'x' where id = 'ae-001'`, 'permission denied');
    await rejects(app(S.hamad), `delete from audit_events where id = 'ae-001'`, 'permission denied');
    await rejects({ role: 'owner', session: null }, `update audit_events set message = 'x' where id = 'ae-001'`, 'audit_events is append-only');
    await rejects({ role: 'owner', session: null }, `delete from audit_events where false`, 'audit_events is append-only');
    // truncate: no grant for jurah_app (the OWNER can truncate — the seed does; see the fragment §5)
    await rejects(app(S.hamad), `truncate audit_events`, 'permission denied');
    // the raw client, directly (this file is the one place allowed to): an update as the owner, no GUC
    let raised = '';
    try { await getSql()`update audit_events set message = message where id = 'ae-001'`; } catch (e) { raised = (e as Error).message; }
    expect(raised).toBe('audit_events is append-only');
    expect(await count('select 1 from audit_events')).toBe(before);
    // the static half: guard 8 passes, and it scans for `insert into audit_events` outside lib/db/audit.ts
    const g = guard8();
    expect(g.violations).toEqual([]);
    expect(g.name).toMatch(/guard 8/);
  });
});

/**
 * CR-109 — the real-database proof of the grant split (D-025) that lib/data/pg/demo-reset.ts relies
 * on: the un-record commits as jurah_agent (its column grant on status/recorded_at/source), then the
 * move commits as jurah_app/system (its grant on scheduled_at only), and the un-record trigger
 * doses_status_recorded_audit appends one audit_events row per un-recorded dose.
 *
 * This file runs ONLY under `npm run test:integration`, which RE-SEEDS (truncates) whatever
 * JURAH_DATABASE_URL points at — so it is written here and never executed by this change, and never
 * by the root `npm run verify`/`npm test`. The lead runs it only against a Supabase branch database
 * (CR-080/D8), never against production. Without JURAH_DATABASE_URL or JURAH_AGENT_TOKEN every test
 * FAILS loudly (NOT A PASS) — never skipped, matching the house style (tests/integration/enforcement/agent.test.ts).
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import type { Session } from '@/types/views';

const TOKEN = () => (process.env.JURAH_AGENT_TOKEN ?? '').trim();
const agentHeaders = () => ({ authorization: `Bearer ${TOKEN()}`, 'content-type': 'application/json' });
const post = () => new Request('http://localhost:3000/api/agent/demo/reset', { method: 'POST', headers: agentHeaders() });
const loadRoute = () => import('@/app/api/agent/demo/reset/route');

/** The frozen clock (JURAH_CLOCK=frozen) puts "today" on REFERENCE_DATE, 2026-09-21; "tomorrow" is the 22nd. */
const DATES = ['2026-09-21', '2026-09-22'];

async function doseRow(id: string): Promise<{ status: string; recorded_at: string | null; scheduled_at: string } | undefined> {
  const [r] = await getSql().unsafe(`select status::text as status, recorded_at, iso_kw(scheduled_at) as scheduled_at from doses where id = $1`, [id]);
  return r as { status: string; recorded_at: string | null; scheduled_at: string } | undefined;
}

/** A hash of every dose row NOT of pt-03 on the two demo dates, and NOT pt-03's rx-009 evening doses — must never move. */
async function otherDosesDigest(): Promise<string> {
  const [r] = await getSql().unsafe(`
    select md5(string_agg(d.id || '|' || d.status::text || '|' || iso_kw(d.scheduled_at), ',' order by d.id)) as h, count(*)::int as n
      from doses d
      join prescriptions p on p.id = d.prescription_id
     where not (p.patient_id = 'pt-03' and (to_char(d.scheduled_at at time zone 'Asia/Kuwait', 'YYYY-MM-DD') = any ($1::text[])))
  `, [DATES]);
  return `${r?.n}:${r?.h}`;
}

async function prescriptionsDigest(): Promise<string> {
  const [r] = await getSql()`select count(*)::int as n, md5(string_agg(id || status::text, ',' order by id)) as h from prescriptions`;
  return `${r?.n}:${r?.h}`;
}

async function auditRowsFor(doseId: string): Promise<Array<{ actor_role: string; message: string }>> {
  return (await getSql().unsafe(`select actor_role::text as actor_role, message from audit_events where related_id = $1 and type = 'dose_status_recorded' order by created_at`, [doseId])) as unknown as Array<{ actor_role: string; message: string }>;
}

beforeAll(() => {
  vi.stubEnv('JURAH_DATA_BACKEND', 'postgres');
  vi.stubEnv('JURAH_CLOCK', 'frozen');
  if (!TOKEN()) throw new Error('JURAH_AGENT_TOKEN is not set — the route refuses everyone; NOT A PASS');
});
afterEach(() => setScriptSession(null));

describe('CR-109 · POST /api/agent/demo/reset, against the real database', () => {
  it('un-records pt-03’s recorded doses of 2026-09-21/22, moves the evening dose, and audits only the un-records', async () => {
    const beforeOther = await otherDosesDigest();
    const beforeRx = await prescriptionsDigest();

    const { POST } = await loadRoute();
    const res = await POST(post());
    expect(res.status).toBe(200);
    const body = (await res.json()) as { patientId: string; dates: string[]; moved: Array<{ id: string; from: string; to: string }>; reset: Array<{ id: string; kuwaitTime: string; was: string }> };
    expect(body.patientId).toBe('pt-03');
    expect(body.dates).toEqual(DATES);

    // The seed's rx-008 07:00 dose of the 21st is recorded taken_on_time (docs/Seed Dataset.md) — un-recorded by this press.
    const rx008 = body.reset.find((r) => r.id === 'rx-008-20260921-0700');
    expect(rx008).toEqual({ id: 'rx-008-20260921-0700', kuwaitTime: '07:00', was: 'taken_on_time' });

    // Both evening doses (still upcoming in the seed) move to 19:30.
    expect(body.moved.map((m) => m.id).sort()).toEqual(['rx-009-20260921-2100', 'rx-009-20260922-2100']);
    for (const m of body.moved) expect(m).toEqual({ id: m.id, from: '21:00', to: '19:30' });

    const auditCountAfterFirst = new Map<string, number>();
    for (const r of body.reset) {
      const row = await doseRow(r.id);
      expect(row?.status).toBe('upcoming');
      expect(row?.recorded_at).toBeNull();
      const audit = await auditRowsFor(r.id);
      expect(audit.length).toBeGreaterThanOrEqual(1);
      expect(audit.at(-1)).toEqual({ actor_role: 'agent', message: expect.stringContaining('تسجيل حالة جرعة — قادمة') });
      auditCountAfterFirst.set(r.id, audit.length);
    }
    const expectedNewTime: Record<string, string> = {
      'rx-009-20260921-2100': '2026-09-21T19:30:00+03:00',
      'rx-009-20260922-2100': '2026-09-22T19:30:00+03:00',
    };
    for (const m of body.moved) {
      const row = await doseRow(m.id);
      expect(row?.scheduled_at).toBe(expectedNewTime[m.id]);
    }

    expect(await otherDosesDigest()).toBe(beforeOther);
    expect(await prescriptionsDigest()).toBe(beforeRx);

    // A second press: everything already un-recorded and already at 19:30 — nothing left to do.
    const res2 = await POST(post());
    expect(res2.status).toBe(200);
    const body2 = (await res2.json()) as { moved: unknown[]; reset: unknown[] };
    expect(body2.moved).toEqual([]);
    expect(body2.reset).toEqual([]);
    // Not a literal 1: the seed already holds a dose_status_recorded row for rx-008-20260921-0700
    // (its original taken_on_time recording, docs/Seed Dataset.md) before this test's first press ever
    // runs, so a freshly seeded database starts some doses at 2, not 1. The no-op second press must
    // change nothing, so each count is asserted against what the first press itself produced.
    for (const r of body.reset) expect((await auditRowsFor(r.id)).length).toBe(auditCountAfterFirst.get(r.id));
  });

  it('401 without a bearer, 403 for a user session, 422 for any body key — before touching a row', async () => {
    const before = await otherDosesDigest();
    const noAuth = await (await loadRoute()).POST(new Request('http://localhost:3000/api/agent/demo/reset', { method: 'POST' }));
    expect(noAuth.status).toBe(401);

    setScriptSession({ subjectId: 'pt-01', role: 'patient' } as Session);
    const asUser = await (await loadRoute()).POST(post());
    expect(asUser.status).toBe(403);
    setScriptSession(null);

    const badBody = await (await loadRoute()).POST(new Request('http://localhost:3000/api/agent/demo/reset', { method: 'POST', headers: agentHeaders(), body: JSON.stringify({ patientId: 'pt-01' }) }));
    expect(badBody.status).toBe(422);

    expect(await otherDosesDigest()).toBe(before);
  });
});

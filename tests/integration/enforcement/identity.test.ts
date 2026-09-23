/**
 * ENFORCEMENT.md — the identity rows owned by P2-WP5: E-13 (full: bytes AND latency), E-14 (session,
 * rate limit, audit), E-15 (no Civil ID returned or written), each titled by its id, against the REAL
 * database (setup.ts re-seeds and FAILS loudly without JURAH_DATABASE_URL — never skipped-as-pass).
 * WP2's auth.test.ts proves E-13's session half at the cookie level; this file proves the lookup.
 *
 * The seam function runs from lib/data/pg/writes.ts under a trusted script session, whose rate-limit
 * key is `script:<subjectId>` (no sid — docs/backend-notes/p2-wp5.md). The timing loop clears
 * lookup_audit as the owner OUTSIDE the timed window so the 10-per-60-s limit never trips mid-sample.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { getSql } from '@/lib/db/client';
import * as pg from '@/lib/data/pg/writes';
import { app, rejects } from '../helpers';
import { HAMAD, NASER_PENDING, as, asJson, count, liveMessages, reseed } from './_wp5';

const WITH_ACCOUNT = '285061400412'; // عبدالله
const NO_ACCOUNT = '277091900873'; // cg-05's invitee: no account
const clearLookups = () => getSql()`delete from lookup_audit`;

beforeEach(async () => { await reseed(); });

function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const q = (p: number) => s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))]!;
  return { n: s.length, median: q(0.5), p95: q(0.95), min: s[0]!, max: s[s.length - 1]! };
}

describe('G9 — the masked-name lookup', () => {
  it('E-13', async () => {
    const a = await asJson(HAMAD, () => pg.lookupMaskedName(WITH_ACCOUNT));
    const n = await asJson(HAMAD, () => pg.lookupMaskedName(NO_ACCOUNT));
    console.log(`E-13 bodies: ${a} | ${n}`);
    expect(a).toBe('{"maskedName":"عبدالله م*** ع*** المطيري"}');
    expect(n).toBe('{"maskedName":null}');
    // byte-identical apart from the maskedName VALUE: same keys, same order, same framing
    expect(a.replace(/"maskedName":(null|"[^"]*")/, '"maskedName":X')).toBe(n.replace(/"maskedName":(null|"[^"]*")/, '"maskedName":X'));
    expect(Object.keys(JSON.parse(a))).toEqual(Object.keys(JSON.parse(n)));
    // 200 timed samples each, interleaved, through the real seam function
    const ta: number[] = [];
    const tn: number[] = [];
    for (let i = 0; i < 200; i++) {
      if (i % 5 === 0) await clearLookups(); // outside the timed window
      for (const [id, out] of (i % 2 ? [[WITH_ACCOUNT, ta], [NO_ACCOUNT, tn]] : [[NO_ACCOUNT, tn], [WITH_ACCOUNT, ta]]) as [string, number[]][]) {
        const t0 = performance.now();
        await as(HAMAD, () => pg.lookupMaskedName(id));
        out.push(performance.now() - t0);
      }
    }
    const A = stats(ta);
    const N = stats(tn);
    console.log(`E-13 latency (ms) — with account: median ${A.median.toFixed(2)} p95 ${A.p95.toFixed(2)} [${A.min.toFixed(2)}, ${A.max.toFixed(2)}] · no account: median ${N.median.toFixed(2)} p95 ${N.p95.toFixed(2)} [${N.min.toFixed(2)}, ${N.max.toFixed(2)}]`);
    expect(A.n).toBe(200);
    expect(N.n).toBe(200);
    // the distributions overlap: each median lies inside the other's [min, p95]
    expect(A.median).toBeLessThanOrEqual(N.p95);
    expect(N.median).toBeLessThanOrEqual(A.p95);
    expect(A.median).toBeGreaterThanOrEqual(N.min);
    expect(N.median).toBeGreaterThanOrEqual(A.min);
  });

  it('E-14', async () => {
    // no session: the null shape, no transaction, no row
    expect(await asJson(null, () => pg.lookupMaskedName(WITH_ACCOUNT))).toBe('{"maskedName":null}');
    expect(await count('select 1 from lookup_audit')).toBe(0);
    // ten answered, the eleventh refused with the SAME null shape — and eleven audit rows, no Civil ID column
    for (let i = 1; i <= 10; i++) {
      expect(await asJson(HAMAD, () => pg.lookupMaskedName(WITH_ACCOUNT)), `call ${i}`).toBe('{"maskedName":"عبدالله م*** ع*** المطيري"}');
    }
    expect(await asJson(HAMAD, () => pg.lookupMaskedName(WITH_ACCOUNT)), 'call 11').toBe('{"maskedName":null}');
    expect(await count(`select 1 from lookup_audit where session_id = 'script:pt-01' and subject_id = 'pt-01'`)).toBe(11);
    expect(await count(`select 1 from information_schema.columns where table_name = 'lookup_audit' and column_name ilike '%civil%'`)).toBe(0);
    // D-037: the window is the wall clock — rows aged past 60 s no longer count
    await getSql()`update lookup_audit set at = at - interval '61 seconds' where session_id = 'script:pt-01'`;
    expect(await asJson(HAMAD, () => pg.lookupMaskedName(WITH_ACCOUNT)), 'call 12, after the window').toBe('{"maskedName":"عبدالله م*** ع*** المطيري"}');
    // another session is not limited by حمد's
    expect(await asJson(NASER_PENDING, () => pg.lookupMaskedName(WITH_ACCOUNT))).toBe('{"maskedName":"عبدالله م*** ع*** المطيري"}');
    // jurah_app cannot reach accounts by itself — only through the definer, which audits
    await rejects(app({ subjectId: 'pt-01', role: 'patient', civilId: '255031200187' }), 'select name from accounts', 'permission denied');
  });

  it('E-15', async () => {
    // every write's returned shape, and every audit message the writes append, scanned for \d{12}
    const shapes: string[] = [];
    shapes.push(await asJson(HAMAD, () => pg.lookupMaskedName(WITH_ACCOUNT)));
    shapes.push(await asJson(HAMAD, () => pg.inviteCaregiver('pt-01', { civilId: '299999900000', name: 'اختبار', relationship: 'قريب' })));
    shapes.push(await asJson(HAMAD, () => pg.inviteCaregiver('pt-01', { civilId: '292043000517', name: 'منى', relationship: 'قريبة' })));
    shapes.push(await asJson(HAMAD, () => pg.requestRefill('pt-01', 'rx-002')));
    shapes.push(await asJson(HAMAD, () => pg.updateSettings('pt-01', { refillAlertsEnabled: true })));
    shapes.push(await asJson(NASER_PENDING, () => pg.acceptInvitation('cg-03')));
    for (const s of shapes) expect(s, s).not.toMatch(/\d{12}/);
    const messages = (await liveMessages()).map((r) => String(r.message));
    console.log(`E-15 live audit messages: ${messages.join(' / ')}`);
    expect(messages.length).toBeGreaterThanOrEqual(4);
    for (const m of messages) expect(m).not.toMatch(/\d{12}/);
    // D-036: both invitations (منى has an account, 299999900000 has none) write the same neutral line
    expect(messages.filter((m) => m === 'دعوة مقدّم رعاية أُرسلت')).toHaveLength(2);
    expect(messages.some((m) => m.includes('منى'))).toBe(false);
    // the database refuses a message carrying one, whoever writes it
    await rejects(app({ subjectId: 'pt-01', role: 'patient', civilId: '255031200187' }),
      `insert into audit_events (id, scope, patient_id, actor_role, actor_id, type, message, created_at) values ('ae_e15', 'patient', 'pt-01', 'patient', 'pt-01', 'caregiver_invited', 'x 255031200187', jurah_now())`,
      'audit_message_no_civil_id');
  });
});

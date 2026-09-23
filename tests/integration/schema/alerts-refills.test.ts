/** interaction_alerts (alert_review_once) and refill_requests (refill_routing, D-014). */
import { describe, expect, it } from 'vitest';
import { AGENT, S, SYSTEM, accepts, app, rejects } from '../helpers';

describe('interaction_alerts', () => {
  const ins = (extra: string, vals: string, involved = "array['rx-001']") =>
    `insert into interaction_alerts (id, patient_id, involved_prescription_ids, severity, description, source_citation, created_at, review_status${extra}) values ('iat', 'pt-01', ${involved}, 'info', 'x', '', jurah_now()${vals})`;
  it('alert_reviewed_complete', async () => { await rejects(SYSTEM, ins('', ", 'reviewed'"), 'alert_reviewed_complete'); });
  it('alert_unreviewed_clean', async () => { await rejects(SYSTEM, ins(', reviewer_note', ", 'pending_medical_review', 'x'"), 'alert_unreviewed_clean'); });
  it('alert_involves_something', async () => { await rejects(SYSTEM, ins('', ", 'auto_cleared'", "'{}'::text[]"), 'alert_involves_something'); });
  it('inserts are jurah_agent only', async () => {
    await rejects(app(S.hamad), ins('', ", 'auto_cleared'"), 'permission denied');
    expect((await accepts(AGENT, ins('', ", 'auto_cleared'"))).count).toBe(1);
  });
  it('alert_review_once — nothing but the five review fields ever changes', async () => {
    await rejects({ role: 'owner', session: S.khalidReviewer }, `update interaction_alerts set description = 'x' where id = 'ia-001'`, 'alert_review_once: only the five review fields');
  });
  it('alert_review_once — a second decision raises (ia-002 is already reviewed)', async () => {
    await rejects({ role: 'owner', session: S.khalidReviewer }, `update interaction_alerts set reviewer_decision = 'cleared', reviewed_at = jurah_now() where id = 'ia-002'`, 'alert_review_once: this alert has already been decided');
    // Through RLS the reviewer cannot see ia-002 at all: 0 rows, nothing changed.
    expect((await accepts(app(S.khalidReviewer), `update interaction_alerts set reviewer_decision = 'cleared' where id = 'ia-002'`)).count).toBe(0);
  });
  it('alert_review_once — only a reviewer decides', async () => {
    await rejects({ role: 'owner', session: S.dana }, `update interaction_alerts set review_status = 'reviewed', reviewer_decision = 'confirmed', reviewed_at = jurah_now(), reviewed_by = 'acc-11' where id = 'ia-001'`, 'alert_review_once: only a reviewer may decide');
  });
  it('POSITIVE: the reviewer decides pending ia-001 once', async () => {
    const r = await accepts(app(S.khalidReviewer), `update interaction_alerts set review_status = 'reviewed', reviewer_decision = 'confirmed', reviewed_at = jurah_now(), reviewed_by = 'acc-10' where id = 'ia-001'`,
      `select review_status::text from interaction_alerts where id = 'ia-001'`);
    expect(r).toEqual({ count: 1, value: 'reviewed' });
  });
});

describe('refill_requests', () => {
  const ins = (id: string, rx: string, routed = 'public_pharmacy', patient = 'pt-01') =>
    `insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status) values ('${id}', '${patient}', '${rx}', jurah_now(), '${routed}', 'requested')`;
  it("refill_routing — another patient's prescription (rx-008 as حمد) is refused", async () => {
    await rejects(app(S.hamad), ins('r1', 'rx-008'), 'refill_routing');
    await rejects(SYSTEM, ins('r1', 'rx-008'), 'refill_routing: prescription does not belong to this patient');
  });
  it('refill_routing — a discontinued prescription (rx-004) is refused', async () => {
    await rejects(app(S.hamad), ins('r2', 'rx-004'), 'refill_routing: prescription is not active');
  });
  it('refill_routing — routed_to is OVERWRITTEN from the sector: a client-supplied value never survives', async () => {
    const r = await accepts(app(S.hamad), ins('r3', 'rx-003', 'private_pharmacy'), `select routed_to::text from refill_requests where id = 'r3'`);
    expect(r).toEqual({ count: 1, value: 'public_pharmacy' });
    const p = await accepts(app(S.hamad), ins('r4', 'rx-002', 'public_pharmacy'), `select routed_to::text from refill_requests where id = 'r4'`);
    expect(p.value).toBe('private_pharmacy');
  });
  it('refill_routed_matches_sector — even the owner cannot store a routing that contradicts the sector', async () => {
    await rejects(SYSTEM, `alter table refill_requests disable trigger refill_routing; update refill_requests set routed_to = 'private_pharmacy' where id = 'rf-01'`, 'refill_routed_matches_sector');
  });
  it('refill_requests_prescription_owner_fkey — ownership is also a foreign key', async () => {
    await rejects(SYSTEM, `alter table refill_requests disable trigger refill_routing;
      insert into refill_requests (id, patient_id, prescription_id, requested_at, routed_to, status, sector)
      values ('r5', 'pt-01', 'rx-008', jurah_now(), 'public_pharmacy', 'requested', 'public')`, 'refill_requests_prescription_owner_fkey');
  });
  it('a caregiver session cannot request a refill for its patient (E-29)', async () => {
    await rejects(app(S.abdullah), ins('r6', 'rx-003'), 'row-level security');
  });
  it('only the status of a refill may change', async () => {
    await rejects(SYSTEM, `update refill_requests set prescription_id = 'rx-001' where id = 'rf-01'`, "refill_routing: only a refill's status may change");
  });
});

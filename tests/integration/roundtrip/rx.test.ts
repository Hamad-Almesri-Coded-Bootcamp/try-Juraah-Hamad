/**
 * P2-WP3a round trip — getPrescriptions · getPrescription · getDosesForDay · getDoseHistory ·
 * getRecentDoses · submitPrescriptionImage · savePrescriptionDraft through the REAL Postgres path
 * (lib/data/pg/reads-rx.ts → withSession() → jurah_app + RLS), under the seeded session
 * print-shapes uses, compared with tests/fixtures/shapes.json AS A STRING (key order included —
 * BACKEND-PLAN §6, never deep-equal). Created rows (the draft, the saved prescription) carry opaque
 * ids (CR-041): the id is asserted present and a string, every other byte is compared.
 *
 * Without JURAH_DATABASE_URL tests/integration/setup.ts fails every test loudly (NOT A PASS).
 */
import { describe, expect, it } from 'vitest';
import shapes from '../../fixtures/shapes.json';
import { getSql } from '@/lib/db/client';
import { setScriptSession } from '@/lib/session/cookie';
import * as rx from '@/lib/data/pg/reads-rx';
import type { Session } from '@/types/views';

const fixture = shapes as unknown as Record<string, unknown>;
const HAMAD: Session = { subjectId: 'pt-01', role: 'patient' };
const SARA: Session = { subjectId: 'pt-03', role: 'patient' };
const ABDULLAH: Session = { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' };

async function as<T>(s: Session | null, fn: () => Promise<T>): Promise<T> {
  setScriptSession(s);
  return fn();
}
const str = (v: unknown) => JSON.stringify(v);
const opaque = (v: unknown, key: string) => str({ ...(v as object), [key]: '<created>' });

describe('WP3a round trip — string-equal to shapes.json', () => {
  it('getPrescriptions(pt-01) as حمد', async () => {
    expect(str(await as(HAMAD, () => rx.getPrescriptions('pt-01')))).toBe(str(fixture['getPrescriptions(pt-01)']));
  });
  it('getPrescription(rx-001) as حمد', async () => {
    expect(str(await as(HAMAD, () => rx.getPrescription('rx-001')))).toBe(str(fixture['getPrescription(rx-001)']));
  });
  it('getDosesForDay(pt-01, 2026-09-21) as حمد — and byte-identical as عبدالله (E-31)', async () => {
    const got = str(await as(HAMAD, () => rx.getDosesForDay('pt-01', '2026-09-21')));
    expect(got).toBe(str(fixture['getDosesForDay(pt-01, 2026-09-21)']));
    expect(str(await as(ABDULLAH, () => rx.getDosesForDay('pt-01', '2026-09-21')))).toBe(got);
  });
  it('getDoseHistory(rx-008) as سارة', async () => {
    expect(str(await as(SARA, () => rx.getDoseHistory('rx-008')))).toBe(str(fixture['getDoseHistory(rx-008)']));
  });
  it('getRecentDoses(pt-03, 7) as سارة (CR-046: served, no caller)', async () => {
    expect(str(await as(SARA, () => rx.getRecentDoses('pt-03', 7)))).toBe(str(fixture['getRecentDoses(pt-03, 7)']));
  });
  it('a malformed date or NaN window returns the refusal shape, never a throw', async () => {
    expect(str(await as(HAMAD, () => rx.getDosesForDay('pt-01', '2026-02-30')))).toBe('[]');
    expect(str(await as(HAMAD, () => rx.getDosesForDay('pt-01', '2026-13-01')))).toBe('[]');
    expect(str(await as(HAMAD, () => rx.getDosesForDay('pt-01', 'not-a-date')))).toBe('[]');
    expect(str(await as(HAMAD, () => rx.getRecentDoses('pt-01', Number.NaN)))).toBe('[]');
  });

  it('submitPrescriptionImage(pt-01) then savePrescriptionDraft(pt-01) as حمد — the shapes, and the one transaction', async () => {
    const extraction = await as(HAMAD, () => rx.submitPrescriptionImage('pt-01', new Blob([new Uint8Array(500)])));
    if (!('draftId' in extraction)) throw new Error('expected a draft');
    expect(typeof extraction.draftId).toBe('string');
    expect(opaque(extraction, 'draftId')).toBe(opaque(fixture['submitPrescriptionImage(pt-01)'], 'draftId'));
    const [draft] = await getSql()`select octet_length(image) as bytes, confident from prescription_drafts where draft_id = ${extraction.draftId}`;
    expect(draft).toEqual({ bytes: 500, confident: true }); // CR-049/CR-050: the image and the draft are stored

    const [before] = await getSql()`select (select count(*)::int from doses) as doses, (select count(*)::int from audit_events) as audit`;
    const saved = await as(HAMAD, () => rx.savePrescriptionDraft('pt-01', extraction.draftId));
    expect(typeof saved.id).toBe('string');
    expect(saved.id).not.toBe('');
    expect(opaque(saved, 'id')).toBe(opaque(fixture['savePrescriptionDraft(pt-01)'], 'id'));

    const [after] = await getSql()`select (select count(*)::int from doses) as doses, (select count(*)::int from audit_events) as audit,
      (select count(*)::int from prescription_drafts where draft_id = ${extraction.draftId}) as draft_left`;
    expect(after).toEqual({ doses: before!.doses + 21, audit: before!.audit + 1, draft_left: 0 });
    const doses = await getSql()`select status::text as status, tracked, source::text as source, count(*)::int as n
      from doses where prescription_id = ${saved.id} group by 1, 2, 3`;
    expect(doses).toEqual([{ status: 'upcoming', tracked: false, source: 'seed', n: 21 }]); // حمد's tracking is off (G1, rule 3)
    const [audit] = await getSql()`select type::text as type, actor_role::text as actor_role, actor_id, message, iso_kw(created_at) as at, related_id
      from audit_events where related_id = ${saved.id}`;
    expect(audit).toEqual({ type: 'prescription_added', actor_role: 'patient', actor_id: 'pt-01', message: 'أُضيفت وصفة Ibuprofen', at: '2026-09-21T09:15:00+03:00', related_id: saved.id });
    // and the new doses reach the day list under the same projection
    const day = await as(HAMAD, () => rx.getDosesForDay('pt-01', '2026-09-21'));
    expect(day.filter((d) => d.prescriptionId === saved.id).map((d) => d.scheduledAt)).toEqual([
      '2026-09-21T08:00:00+03:00', '2026-09-21T14:00:00+03:00', '2026-09-21T20:00:00+03:00',
    ]);
  });

  it('no Civil ID in any shape this package returns', async () => {
    const all = [
      await as(HAMAD, () => rx.getPrescriptions('pt-01')), await as(HAMAD, () => rx.getDosesForDay('pt-01', '2026-09-21')),
      await as(SARA, () => rx.getDoseHistory('rx-008')), await as(SARA, () => rx.getRecentDoses('pt-03', 7)),
    ];
    expect(str(all)).not.toMatch(/\d{12}/);
  });
});

/**
 * `resolveCivilId`, unit-tested against docs/ROLES.md → "The seed, resolved" for all twelve
 * Civil IDs, plus a thirteenth (not in the test list). Calls the store directly, never the
 * `'use server'` wrappers (docs/briefs/WP1.md §8).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { reset, getStore } from '@/lib/data/mock/store';
import { resolveCivilId } from '@/lib/session/resolve';

beforeEach(() => reset());

describe('resolveCivilId — the seed, resolved (ROLES.md)', () => {
  it('حمد (255031200187) → single_role patient', () => {
    const o = resolveCivilId('255031200187', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'single_role', session: { subjectId: 'pt-01', role: 'patient' } });
  });

  it('فاطمة (258071100342) → single_role patient', () => {
    const o = resolveCivilId('258071100342', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'single_role', session: { subjectId: 'pt-02', role: 'patient' } });
  });

  it('سارة (290022500654) → multiple_roles (patient + caregiver)', () => {
    const o = resolveCivilId('290022500654', getStore(), REFERENCE_NOW);
    expect(o.kind).toBe('multiple_roles');
    if (o.kind !== 'multiple_roles') throw new Error('unreachable');
    expect(o.options.map((x) => x.role).sort()).toEqual(['caregiver', 'patient']);
    const cg = o.options.find((x) => x.role === 'caregiver');
    expect(cg).toMatchObject({ subjectId: 'cg-02', linkedPatientId: 'pt-01', patientFirstName: 'حمد' });
  });

  it('عبدالله (285061400412) → single_role caregiver, linked to pt-01', () => {
    const o = resolveCivilId('285061400412', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'single_role', session: { subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' } });
  });

  it('ناصر (288110300229) → pending_invitation_only', () => {
    const o = resolveCivilId('288110300229', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'pending_invitation_only', invitationId: 'cg-03' });
  });

  it('منى (292043000517) → no_claims (declined invitation)', () => {
    const o = resolveCivilId('292043000517', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'no_claims' });
  });

  it('277091900873 (no account, expired invitation) → no_claims, byte-identical to منى', () => {
    const o = resolveCivilId('277091900873', getStore(), REFERENCE_NOW);
    const monaOutcome = resolveCivilId('292043000517', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'no_claims' });
    expect(JSON.stringify(o)).toBe(JSON.stringify(monaOutcome));
  });

  it('د. خالد (280012000961) → multiple_roles (reviewer + admin)', () => {
    const o = resolveCivilId('280012000961', getStore(), REFERENCE_NOW);
    expect(o.kind).toBe('multiple_roles');
    if (o.kind !== 'multiple_roles') throw new Error('unreachable');
    expect(o.options.map((x) => ({ role: x.role, subjectId: x.subjectId })).sort((a, b) => a.role.localeCompare(b.role))).toEqual([
      { role: 'admin', subjectId: 'acc-10' },
      { role: 'reviewer', subjectId: 'acc-10' },
    ]);
  });

  it('م. دانة (293080700148) → single_role admin', () => {
    const o = resolveCivilId('293080700148', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'single_role', session: { subjectId: 'acc-11', role: 'admin' } });
  });

  it('بدر (268110500413) → single_role patient', () => {
    const o = resolveCivilId('268110500413', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'single_role', session: { subjectId: 'pt-04', role: 'patient' } });
  });

  it('طلال (298052000731) → no_claims (revoked after acceptance)', () => {
    const o = resolveCivilId('298052000731', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'no_claims' });
  });

  it('دلال (285092200664) → no_claims (revoked, cancelled before any answer)', () => {
    const o = resolveCivilId('285092200664', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'no_claims' });
  });

  it('a thirteenth valid-shaped ID → not_in_test_list', () => {
    const o = resolveCivilId('299999900000', getStore(), REFERENCE_NOW);
    expect(o).toEqual({ kind: 'not_in_test_list' });
  });

  it('a malformed value → not_in_test_list', () => {
    expect(resolveCivilId('abc', getStore(), REFERENCE_NOW)).toEqual({ kind: 'not_in_test_list' });
  });
});

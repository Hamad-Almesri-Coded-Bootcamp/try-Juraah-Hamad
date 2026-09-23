/**
 * Read-time invitation expiry — P2-WP4 (docs/briefs/P2-WP4.md), against the seed's eight Caregiver
 * rows (lib/data/mock/seed.ts → buildCaregivers) and cross-checked against the mock's own rule
 * (lib/data/mock/caregivers.ts → pendingInvitationsFor keeps `expiresAt > nowIso`).
 * `nowIso` is always passed in; nothing here reads a clock.
 */
import { describe, expect, it } from 'vitest';
import type { Caregiver } from '@/types/contracts';
import { REFERENCE_NOW } from '@/lib/config';
import { buildCaregivers, buildSeedState } from '@/lib/data/mock/seed';
import { pendingInvitationsFor } from '@/lib/data/mock/caregivers';
import { foldInvitationExpiry, invitationsToExpire } from '@/lib/schedule/expiry';

const ids = (list: Caregiver[]) => list.map((c) => c.id);
const statusesAt = (nowIso: string) => Object.fromEntries(buildCaregivers().map((c) => [c.id, foldInvitationExpiry(c, nowIso)]));

describe('foldInvitationExpiry — the seed at REFERENCE_NOW (2026-09-21T09:15:00+03:00)', () => {
  it('every row reads as its stored status: both pending invitations are still live', () => {
    expect(statusesAt(REFERENCE_NOW)).toEqual({
      'cg-01': 'active', 'cg-02': 'active', 'cg-03': 'pending', 'cg-04': 'declined',
      'cg-05': 'expired', 'cg-06': 'revoked', 'cg-07': 'revoked', 'cg-08': 'pending',
    });
  });

  it('an active row whose expiresAt is long past stays active (cg-01 2026-09-16, cg-02 2026-09-03)', () => {
    const s = statusesAt(REFERENCE_NOW);
    expect(s['cg-01']).toBe('active');
    expect(s['cg-02']).toBe('active');
  });

  it('invitationsToExpire selects nothing', () => {
    expect(invitationsToExpire(buildCaregivers(), REFERENCE_NOW)).toEqual([]);
  });
});

describe('foldInvitationExpiry — the <= boundary on ناصر (cg-03, expires 2026-10-02T20:10:00+03:00)', () => {
  it('one second before: still pending', () => {
    expect(statusesAt('2026-10-02T20:09:59+03:00')['cg-03']).toBe('pending');
  });

  it('exactly at expiresAt: expired (a pending row stops being acceptable AT its expiry)', () => {
    expect(statusesAt('2026-10-02T20:10:00+03:00')['cg-03']).toBe('expired');
    expect(ids(invitationsToExpire(buildCaregivers(), '2026-10-02T20:10:00+03:00'))).toEqual(['cg-03']);
  });

  it('the same instant written in UTC gives the same answer (comparison is by instant, not by string)', () => {
    expect(statusesAt('2026-10-02T17:10:00Z')['cg-03']).toBe('expired');
    expect(statusesAt('2026-10-02T17:09:59Z')['cg-03']).toBe('pending');
    const utcRow: Caregiver = { ...buildCaregivers()[2]!, expiresAt: '2026-10-02T17:10:00Z' };
    expect(foldInvitationExpiry(utcRow, '2026-10-02T20:09:59+03:00')).toBe('pending');
    expect(foldInvitationExpiry(utcRow, '2026-10-02T20:10:00+03:00')).toBe('expired');
  });
});

describe('invitationsToExpire — the job selection over time', () => {
  it('2026-10-03: only cg-03; cg-08 (expires 2026-10-04 09:30) still live', () => {
    expect(ids(invitationsToExpire(buildCaregivers(), '2026-10-03T00:00:00+03:00'))).toEqual(['cg-03']);
  });

  it('2026-10-05: cg-03 and cg-08, in input order', () => {
    expect(ids(invitationsToExpire(buildCaregivers(), '2026-10-05T00:00:00+03:00'))).toEqual(['cg-03', 'cg-08']);
  });

  it('never selects a declined, expired, revoked or active row, however late the clock', () => {
    const selected = invitationsToExpire(buildCaregivers(), '2030-01-01T00:00:00+03:00');
    expect(ids(selected)).toEqual(['cg-03', 'cg-08']);
    for (const c of selected) expect(c.status).toBe('pending');
  });

  it('does not mutate the rows it selects — the writer half moves them, not this function', () => {
    const rows = buildCaregivers();
    const snap = structuredClone(rows);
    const selected = invitationsToExpire(rows, '2030-01-01T00:00:00+03:00');
    expect(rows).toEqual(snap);
    for (const c of selected) expect(c.status).toBe('pending');
  });
});

describe('foldInvitationExpiry agrees with the mock (pendingInvitationsFor) at every instant it is asked', () => {
  const instants = [
    REFERENCE_NOW, '2026-09-18T20:09:00+03:00', '2026-09-18T20:10:00+03:00', '2026-10-02T20:09:59+03:00',
    '2026-10-02T20:10:00+03:00', '2026-10-02T20:10:01+03:00', '2026-10-04T09:29:59+03:00', '2026-10-04T09:30:00+03:00', '2027-01-01T00:00:00+03:00',
  ];
  it.each(instants)('at %s', (nowIso) => {
    const store = buildSeedState();
    for (const c of store.caregivers.filter((x) => x.status === 'pending')) {
      const liveInMock = pendingInvitationsFor(store, c.civilId, nowIso).some((x) => x.id === c.id);
      expect(foldInvitationExpiry(c, nowIso) === 'pending').toBe(liveInMock);
    }
  });
});

describe('malformed input', () => {
  it('a pending row whose expiresAt does not parse FAILS CLOSED — it reads as expired', () => {
    const bad: Caregiver = { ...buildCaregivers()[2]!, expiresAt: 'not-a-date' };
    expect(foldInvitationExpiry(bad, REFERENCE_NOW)).toBe('expired');
    expect(ids(invitationsToExpire([bad], REFERENCE_NOW))).toEqual(['cg-03']);
  });

  it('a nowIso that does not parse throws (a caller bug, never a silent "not expired")', () => {
    expect(() => foldInvitationExpiry(buildCaregivers()[2]!, '')).toThrow(RangeError);
    expect(() => invitationsToExpire(buildCaregivers(), 'soon')).toThrow(RangeError);
  });
});

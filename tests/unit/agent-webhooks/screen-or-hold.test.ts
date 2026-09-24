// @vitest-environment node
/**
 * F3 — lib/data/pg/screening.ts screenOrHold. The screening call and the agent's alert insert are
 * stubbed; this proves the rule: a saved prescription is screened, or — when screening cannot be
 * confirmed — HELD for a specialist by a pending_medical_review alert on it. Never silently unchecked.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  configured: true,
  screened: true,
  insert: vi.fn(async (input: unknown): Promise<unknown> => { void input; return { kind: 'ok', alert: { id: 'ia_HOLD' } }; }),
  calls: [] as unknown[],
}));
vi.mock('@/lib/agent-webhooks', () => ({
  screeningConfigured: () => h.configured,
  requestScreening: async (...args: unknown[]) => { h.calls.push(args); return h.screened; },
}));
vi.mock('@/lib/data/pg/agent', () => ({ insertAlert: h.insert }));

import { screenOrHold } from '@/lib/data/pg/screening';

const RX = { id: 'rx_NEW', needsReview: false, status: 'active' as const, drug: { genericName: 'Ibuprofen' } as never };

beforeEach(() => { h.configured = true; h.screened = true; h.calls = []; h.insert.mockClear(); });

describe('F3 screenOrHold', () => {
  it('screening confirmed -> screened, nothing raised; the agent is asked about THIS prescription', async () => {
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('screened');
    expect(h.calls).toEqual([['pt-01', 'rx_NEW', 'ar']]);
    expect(h.insert).not.toHaveBeenCalled();
  });
  it('screening NOT confirmed (down, timeout, refused) -> held: a pending_medical_review warning on that prescription', async () => {
    h.screened = false;
    expect(await screenOrHold('pt-01', RX, 'en')).toBe('held');
    expect(h.insert).toHaveBeenCalledTimes(1);
    const input = h.insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(input).toMatchObject({ patientId: 'pt-01', involvedPrescriptionIds: ['rx_NEW'], severity: 'warning', reviewStatus: 'pending_medical_review', sourceCitation: '' });
    expect(String(input.description)).toMatch(/Ibuprofen/);
    expect(String(input.description)).toMatch(/مراجعة مختص/);
  });
  it('screening not configured (the CR-049 stub) -> skipped: no call, nothing raised, behaviour unchanged', async () => {
    h.configured = false;
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('skipped');
    expect(h.calls).toEqual([]);
    expect(h.insert).not.toHaveBeenCalled();
  });
  it('a flagged prescription (awaiting field review) is not screened yet - the reviewer\'s confirmation screens it', async () => {
    expect(await screenOrHold('pt-01', { ...RX, needsReview: true }, 'ar')).toBe('skipped');
    expect(h.calls).toEqual([]);
  });
  it('the hold itself failing never throws into the save (the save has already committed)', async () => {
    h.screened = false;
    h.insert.mockRejectedValueOnce(new Error('db down'));
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('skipped');
  });
});

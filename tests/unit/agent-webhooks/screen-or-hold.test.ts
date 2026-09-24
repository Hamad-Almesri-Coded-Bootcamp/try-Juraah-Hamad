// @vitest-environment node
/**
 * F3 / AP-10 — lib/data/pg/screening.ts screenOrHold. The screening call and the agent's alert insert
 * are stubbed; this proves the rule: a saved prescription is screened, or (when n8n does not accept
 * the request) HELD for a specialist by a pending_medical_review alert on it, written in the patient's
 * language from the copy catalogue. Never silently unchecked, and never fire-and-forget.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copy } from '@/i18n';

const h = vi.hoisted(() => ({
  configured: true,
  screened: true as boolean | Promise<boolean>,
  language: 'ar' as 'ar' | 'en',
  insert: vi.fn(async (input: unknown): Promise<unknown> => { void input; return { kind: 'ok', alert: { id: 'ia_HOLD' } }; }),
  lang: vi.fn(async (patientId: string): Promise<'ar' | 'en'> => { void patientId; return h.language; }),
  calls: [] as unknown[],
}));
vi.mock('@/lib/agent-webhooks', () => ({
  screeningConfigured: () => h.configured,
  requestScreening: async (...args: unknown[]) => { h.calls.push(args); return h.screened; },
}));
vi.mock('@/lib/data/pg/agent', () => ({ insertAlert: h.insert, patientLanguage: h.lang }));

import { screenOrHold } from '@/lib/data/pg/screening';

const RX = { id: 'rx_NEW', needsReview: false, status: 'active' as const, drug: { genericName: 'Ibuprofen' } as never };

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  h.configured = true; h.screened = true; h.language = 'ar'; h.calls = [];
  h.insert.mockClear(); h.lang.mockClear();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => { warn.mockRestore(); error.mockRestore(); });

describe('F3 screenOrHold', () => {
  it('screening confirmed -> screened, nothing raised; the agent is asked about THIS prescription', async () => {
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('screened');
    expect(h.calls).toEqual([['pt-01', 'rx_NEW', 'ar']]);
    expect(h.insert).not.toHaveBeenCalled();
    expect(h.lang).not.toHaveBeenCalled(); // the caller's language is used as given
  });
  it('screening NOT confirmed (down, timeout, refused) -> held: a pending_medical_review warning on that prescription', async () => {
    h.screened = false;
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('held');
    expect(h.insert).toHaveBeenCalledTimes(1);
    const input = h.insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(input).toMatchObject({ patientId: 'pt-01', involvedPrescriptionIds: ['rx_NEW'], severity: 'warning', reviewStatus: 'pending_medical_review', sourceCitation: '' });
    expect(input.description).toBe(copy.safety.screeningHeldTemplate.ar.replace('{drug}', 'Ibuprofen'));
    expect(String(input.description)).not.toContain('—'); // no em dash in the stored text
    expect(warn).toHaveBeenCalledTimes(1); // the miss is also in the server log
  });
  it('the hold is written in the patient\'s language: English for an English patient', async () => {
    h.screened = false;
    expect(await screenOrHold('pt-03', RX, 'en')).toBe('held');
    const input = h.insert.mock.calls[0]![0] as Record<string, unknown>;
    expect(input.description).toBe('We could not finish checking Ibuprofen against your other medicines, so a medical reviewer will look at it before it is relied on.');
  });
  it('no language given (a reviewer\'s confirmation, a refill, an agent save) -> the patient\'s own, read under the agent role', async () => {
    h.language = 'en';
    expect(await screenOrHold('pt-03', RX)).toBe('screened');
    expect(h.lang).toHaveBeenCalledWith('pt-03');
    expect(h.calls).toEqual([['pt-03', 'rx_NEW', 'en']]);
  });
  it('screening not configured (production today, the CR-049 stub) -> skipped: no call, no read, nothing raised', async () => {
    h.configured = false;
    expect(await screenOrHold('pt-01', RX)).toBe('skipped');
    expect(h.calls).toEqual([]);
    expect(h.lang).not.toHaveBeenCalled();
    expect(h.insert).not.toHaveBeenCalled();
  });
  it('a flagged prescription (awaiting field review) is not screened yet - the reviewer\'s confirmation screens it', async () => {
    expect(await screenOrHold('pt-01', { ...RX, needsReview: true }, 'ar')).toBe('skipped');
    expect(h.calls).toEqual([]);
    expect(h.insert).not.toHaveBeenCalled();
  });
  it('the hold itself failing never throws into the save (the save has already committed); the miss is logged as an error', async () => {
    h.screened = false;
    h.insert.mockRejectedValueOnce(new Error('db down'));
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('skipped');
    expect(error).toHaveBeenCalledTimes(1);
    expect(String(error.mock.calls[0]![0])).toMatch(/NOT SCREENED AND NOT HELD: prescription rx_NEW/);
  });
  it('a refused hold is logged as an error too, never reported as held', async () => {
    h.screened = false;
    h.insert.mockResolvedValueOnce({ kind: 'prescriptions_not_of_patient', ids: ['rx_NEW'] });
    expect(await screenOrHold('pt-01', RX, 'ar')).toBe('skipped');
    expect(error).toHaveBeenCalledTimes(1);
  });
  it('awaited, never fire-and-forget: screenOrHold settles only after n8n has answered the request', async () => {
    let answer!: (v: boolean) => void;
    h.screened = new Promise<boolean>((r) => { answer = r; });
    let settled = false;
    const p = screenOrHold('pt-01', RX, 'ar').then((v) => { settled = true; return v; });
    await new Promise((r) => setTimeout(r, 20));
    expect(settled).toBe(false);
    answer(true);
    expect(await p).toBe('screened');
    expect(settled).toBe(true);
  });
});

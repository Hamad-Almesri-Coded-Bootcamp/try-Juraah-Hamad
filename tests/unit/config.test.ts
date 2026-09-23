import { afterEach, describe, expect, it, vi } from 'vitest';
import { clockIsReal, kuwaitNow, REFERENCE_NOW, referenceNow, TO_BE_SUPPLIED, BOT_HANDLE, BOT_IS_SIMULATED } from '@/lib/config';

describe('config module', () => {
  it('fixes REFERENCE_NOW to the seed clock: Monday 2026-09-21 09:15 Kuwait time', () => {
    expect(REFERENCE_NOW).toBe('2026-09-21T09:15:00+03:00');
    const d = referenceNow();
    expect(d.toISOString()).toBe('2026-09-21T06:15:00.000Z');
    expect(d.getUTCDay()).toBe(1);
  });
  it('labels the bot as simulated while the real handle is owed', () => {
    expect(BOT_HANDLE).toBe('@jurah_bot');
    expect(BOT_IS_SIMULATED).toBe(true);
    expect(TO_BE_SUPPLIED).toBe('[TO BE SUPPLIED]');
  });
});

// CR-064 (b): production runs on the real Kuwait clock; everything else keeps the seed's frozen one.
describe('the app clock', () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });
  it('is frozen by default (tests, local runs, previews)', () => {
    vi.stubEnv('JURAH_CLOCK', ''); vi.stubEnv('VERCEL_ENV', '');
    expect(clockIsReal()).toBe(false);
    expect(kuwaitNow()).toBe(REFERENCE_NOW);
  });
  it('is real in production, printed in Kuwait time with the +03:00 offset', () => {
    vi.stubEnv('JURAH_CLOCK', ''); vi.stubEnv('VERCEL_ENV', 'production');
    vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-23T22:30:05Z'));
    expect(kuwaitNow()).toBe('2026-09-24T01:30:05+03:00');
    expect(referenceNow().toISOString()).toBe('2026-09-23T22:30:05.000Z');
  });
  it('JURAH_CLOCK overrides either way', () => {
    vi.stubEnv('VERCEL_ENV', 'production'); vi.stubEnv('JURAH_CLOCK', 'frozen');
    expect(kuwaitNow()).toBe(REFERENCE_NOW);
    vi.stubEnv('VERCEL_ENV', ''); vi.stubEnv('JURAH_CLOCK', 'real');
    expect(clockIsReal()).toBe(true);
  });
});

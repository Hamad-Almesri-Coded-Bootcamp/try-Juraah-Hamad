import { describe, expect, it } from 'vitest';
import { REFERENCE_NOW, referenceNow, TO_BE_SUPPLIED, BOT_HANDLE, BOT_IS_SIMULATED } from '@/lib/config';

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

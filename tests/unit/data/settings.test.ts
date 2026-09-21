/**
 * `applySettingsPatch` — the seven permitted keys only, and `adherenceCheckInEnabled: true`
 * refused without a `connected` MessagingLink (docs/briefs/WP1.md §8).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { reset, getStore } from '@/lib/data/mock/store';
import { applySettingsPatch } from '@/lib/data/mock/settings';

beforeEach(() => reset());

describe('applySettingsPatch', () => {
  it('applies a permitted key (رsettings for حمد, pt-01)', () => {
    const updated = applySettingsPatch(getStore(), 'pt-01', { refillAlertsEnabled: false }, REFERENCE_NOW);
    expect(updated.refillAlertsEnabled).toBe(false);
  });

  it('ignores a key outside the permitted seven', () => {
    const before = { ...getStore().settings.find((s) => s.patientId === 'pt-01')! };
    const patch = { language: 'ar', notARealKey: 'x' } as unknown as Parameters<typeof applySettingsPatch>[2];
    const updated = applySettingsPatch(getStore(), 'pt-01', patch, REFERENCE_NOW);
    expect(updated).not.toHaveProperty('notARealKey');
    expect(updated.language).toBe(before.language);
  });

  it('refuses adherenceCheckInEnabled:true for حمد (MessagingLink not_connected)', () => {
    const updated = applySettingsPatch(getStore(), 'pt-01', { adherenceCheckInEnabled: true }, REFERENCE_NOW);
    expect(updated.adherenceCheckInEnabled).toBe(false);
    expect(getStore().auditEvents.some((e) => e.type === 'tracking_enabled' && e.patientId === 'pt-01')).toBe(false);
  });

  it('accepts adherenceCheckInEnabled:true for بدر once a connected link exists, and appends tracking_enabled', () => {
    const store = getStore();
    store.messagingLinks.push({ id: 'ml-test', subjectType: 'patient', subjectId: 'pt-04', channel: 'telegram', status: 'connected', connectedAt: REFERENCE_NOW });
    const updated = applySettingsPatch(store, 'pt-04', { adherenceCheckInEnabled: true }, REFERENCE_NOW);
    expect(updated.adherenceCheckInEnabled).toBe(true);
    expect(store.auditEvents.some((e) => e.type === 'tracking_enabled' && e.patientId === 'pt-04')).toBe(true);
  });

  it('سارة (already connected) can toggle tracking off, appending tracking_disabled', () => {
    const store = getStore();
    const updated = applySettingsPatch(store, 'pt-03', { adherenceCheckInEnabled: false }, REFERENCE_NOW);
    expect(updated.adherenceCheckInEnabled).toBe(false);
    expect(store.auditEvents.some((e) => e.type === 'tracking_disabled' && e.patientId === 'pt-03')).toBe(true);
  });
});

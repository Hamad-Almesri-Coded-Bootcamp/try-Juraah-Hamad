/**
 * AP-09 (CR-086): one mock store per server process. Next bundles a route handler apart from the
 * pages, so each bundle loads its own copy of lib/data/mock/*. With a module-level store, the
 * Telegram link route minted a link that E5 never saw (seen in a local run). The store now lives
 * on globalThis, and live ids are counted from the store, so two module copies share one state and
 * never hand out one id twice. A second copy is simulated here with vi.resetModules().
 */
import { describe, expect, it, vi } from 'vitest';

async function freshCopy() {
  vi.resetModules();
  const store = await import('@/lib/data/mock/store');
  const audit = await import('@/lib/data/mock/audit');
  return { ...store, ...audit };
}

describe('the mock store is shared by every module copy (route handlers and pages alike)', () => {
  it('a row written through one copy is read through another', async () => {
    const pages = await freshCopy();
    pages.reset();
    const route = await freshCopy();
    expect(route.getStore()).toBe(pages.getStore());
    route.getStore().messagingLinks.push({ id: 'ml-live-1', subjectType: 'patient', subjectId: 'pt-01', channel: 'telegram', status: 'pending' });
    expect(pages.getStore().messagingLinks.at(-1)?.id).toBe('ml-live-1');
  });

  it('live audit ids stay unique when two copies append to the same store', async () => {
    const a = await freshCopy();
    a.reset();
    const b = await freshCopy();
    const event = { scope: 'patient' as const, patientId: 'pt-01', actor: { role: 'patient' as const, id: 'pt-01' }, type: 'messaging_connected' as const, message: 'تم ربط تيليقرام', createdAt: '2026-09-21T09:15:00+03:00' };
    const first = a.append(a.getStore(), event);
    const second = b.append(b.getStore(), event);
    const third = a.append(a.getStore(), event);
    expect([first.id, second.id, third.id]).toEqual(['ae-live-0001', 'ae-live-0002', 'ae-live-0003']);
    a.reset();
    expect(b.append(b.getStore(), event).id).toBe('ae-live-0001'); // a fresh store starts again at one
  });
});

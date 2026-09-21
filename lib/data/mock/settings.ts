/**
 * `updateSettings`'s mutation logic, pulled out of `lib/data/index.ts` so it is directly
 * unit-testable (docs/briefs/WP1.md §8: "updateSettings refuses a non-permitted key and refuses
 * tracking-on without a connected link"). Accepts only the seven permitted keys (Feature Toggle
 * Policy) and refuses `adherenceCheckInEnabled: true` unless the patient has a `connected`
 * MessagingLink. Appends `tracking_enabled` / `tracking_disabled` only when the flag actually flips.
 */
import type { Settings } from '@/types/contracts';
import type { PermittedSettingsPatch } from '@/types/views';
import { append } from './audit';
import { messagingLinkFor } from './reads';
import { DEFAULT_SETTINGS } from './seed';
import type { StoreState } from './types';

const PERMITTED_KEYS: (keyof PermittedSettingsPatch)[] = [
  'adherenceCheckInEnabled', 'adherenceCheckInFrequency', 'refillAlertsEnabled',
  'calendarSyncEnabled', 'webPushEnabled', 'notificationChannel', 'language',
];

export function applySettingsPatch(store: StoreState, patientId: string, patch: PermittedSettingsPatch, nowIso: string): Settings {
  let row = store.settings.find((x) => x.patientId === patientId);
  if (!row) {
    row = { ...DEFAULT_SETTINGS, patientId };
    store.settings.push(row);
  }
  const wasTracking = row.adherenceCheckInEnabled;

  for (const key of Object.keys(patch) as (keyof PermittedSettingsPatch)[]) {
    if (!PERMITTED_KEYS.includes(key)) continue; // refuses any key outside the permitted seven
    if (key === 'adherenceCheckInEnabled' && patch.adherenceCheckInEnabled === true) {
      const link = messagingLinkFor(store, { subjectType: 'patient', subjectId: patientId });
      if (link.status !== 'connected') continue; // refused without a connected link
    }
    (row as unknown as Record<string, unknown>)[key] = patch[key];
  }

  if (row.adherenceCheckInEnabled !== wasTracking) {
    append(store, {
      scope: 'patient', patientId, actor: { role: 'patient', id: patientId },
      type: row.adherenceCheckInEnabled ? 'tracking_enabled' : 'tracking_disabled',
      message: row.adherenceCheckInEnabled ? 'تفعيل متابعة الجرعات' : 'إيقاف متابعة الجرعات',
      createdAt: nowIso, relatedId: patientId,
    });
  }
  return row;
}

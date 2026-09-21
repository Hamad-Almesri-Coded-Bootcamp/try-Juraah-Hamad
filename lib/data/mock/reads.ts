/**
 * Pure "no row → documented default" reads (docs/Seed Dataset.md — بدر: "reading settings for a
 * patient who has no row returns the documented defaults … and never writes a row as a side
 * effect of being read"). Pulled out of `lib/data/index.ts` so the unit tests can call them
 * directly against the store, without a session cookie (docs/briefs/WP1.md §8).
 */
import type { MessagingLink, PushSubscription, Settings } from '@/types/contracts';
import type { Subject } from '@/types/views';
import { DEFAULT_SETTINGS } from './seed';
import type { StoreState } from './types';

export function settingsFor(store: StoreState, patientId: string): Settings {
  return store.settings.find((s) => s.patientId === patientId) ?? { ...DEFAULT_SETTINGS, patientId };
}

/** The most recently created row for a subject "wins" (فاطمة has two — docs/backend-notes/wp1.md §2). */
export function messagingLinkFor(store: StoreState, subject: Subject): MessagingLink {
  const current = store.messagingLinks.filter((l) => l.subjectType === subject.subjectType && l.subjectId === subject.subjectId).at(-1);
  return current ?? { id: 'ml-default', subjectType: subject.subjectType, subjectId: subject.subjectId, channel: 'telegram', status: 'not_connected' };
}

/** `null` for "no subscription exists" — PushSubscription's own return type already carries `| null`
 * (docs/briefs/WP1.md Verification 8: "state which and why"), unlike Settings/MessagingLink, which
 * have prose-documented default shapes. */
export function pushStateFor(store: StoreState, subject: Subject): PushSubscription | null {
  return store.pushSubscriptions.find((p) => p.subjectType === subject.subjectType && p.subjectId === subject.subjectId) ?? null;
}

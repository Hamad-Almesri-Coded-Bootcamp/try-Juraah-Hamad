/**
 * Refusal shapes for the channel writes — owned by package WP6 (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/refusals.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * Each literal is byte-for-byte the one lib/data/mock-impl.ts builds inline for a refused call
 * (a session that is not the subject's own). Two mock refusals return `existing ?? literal` from
 * the mock's global store; under RLS a refused caller can read no row at all, so the Postgres
 * backend always returns the literal (tighter — BACKEND-DIVERGENCES, WP6 fragment).
 */
import { REFERENCE_NOW } from '@/lib/config';
import type { CalendarSubscription, MessagingLink, PushSubscription } from '@/types/contracts';
import type { Subject } from '@/types/views';

/** requestPushPermission — not the subject's own session. */
export function requestPushPermissionRefusal(subject: Subject): PushSubscription {
  return { id: '', subjectType: subject.subjectType, subjectId: subject.subjectId, status: 'active', permission: 'default', createdAt: REFERENCE_NOW };
}

/** startMessagingLink (and getMessagingLink's not-self answer) — the `ml-default` link, never null (G10). */
export function startMessagingLinkRefusal(subject: Subject): MessagingLink {
  return { id: 'ml-default', subjectType: subject.subjectType, subjectId: subject.subjectId, channel: 'telegram', status: 'not_connected' };
}

/** enableCalendarSync — not the patient's own session: no URL, no token. */
export function enableCalendarSyncRefusal(patientId: string): CalendarSubscription {
  return { patientId, icsUrl: '', token: '' };
}

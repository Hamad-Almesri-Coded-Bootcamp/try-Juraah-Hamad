/**
 * The audit-log messages the agent integration point writes (P2-WP7). Plain Arabic in the register
 * of the mock's own messages (lib/data/mock/seed.ts); a name here is a drug's generic name, never a
 * person's, and never a Civil ID (the audit_message_no_civil_id check refuses one anyway).
 *
 * `dose_status_recorded` is NOT here: the trigger doses_status_recorded_audit composes it in SQL
 * (`تسجيل حالة جرعة — <word>: <generic name>`), byte-identical to the seed's five rows.
 */
import type { InteractionAlert } from '@/types/contracts';

/** The seed's form: «إعادة حساب جدول Levothyroxine بعد جرعة فائتة» (actor system). */
export function scheduleRecomputedMessage(genericName: string): string {
  return `إعادة حساب جدول ${genericName} بعد جرعة فائتة`;
}

/** D-032 (DEFAULT): «أُوقفت وصفة <genericName>» (actor agent). The owner may reword it in the copy deck. */
export function prescriptionDiscontinuedMessage(genericName: string): string {
  return `أُوقفت وصفة ${genericName}`;
}

/** The seed's and the mock's form: «أُضيفت وصفة <genericName>». */
export function prescriptionAddedMessage(genericName: string): string {
  return `أُضيفت وصفة ${genericName}`;
}

/**
 * The seed's only example is a danger alert: «تنبيه تعارض خطير: Warfarin و Ibuprofen». No document
 * states the warning/info form; WP7's default drops the severity word («تنبيه تعارض: A و B") and
 * is listed as a copy-deck item in docs/backend-notes/p2-wp7.md.
 */
export function alertRaisedMessage(severity: InteractionAlert['severity'], genericNames: readonly string[]): string {
  const head = severity === 'danger' ? 'تنبيه تعارض خطير' : 'تنبيه تعارض';
  return `${head}: ${genericNames.join(' و ')}`;
}

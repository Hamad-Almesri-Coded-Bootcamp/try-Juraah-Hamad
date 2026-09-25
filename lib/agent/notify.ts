/**
 * Alert delivery for POST /api/agent/alerts (P2-WP7, G12). Notifications ALERT, never collect:
 *  - every push goes through lib/push/send.ts's `sendPush`, whose one builder is a whitelist
 *    `{ title, body, url }` — no `actions`, no `data` (E-06); the payload built here has only those
 *    three keys in the first place;
 *  - safety-critical content is never only in a payload: the body is the severity label and the
 *    url opens the screen that holds the full alert (C2 for the patient, the caregiver's alert
 *    detail for a caregiver). A dropped push loses nothing;
 *  - recipients are lib/data/pg/agent.ts's `recipientsFor` — the patient and ACTIVE caregivers only.
 * While PUSH_IS_SIMULATED and BOT_IS_SIMULATED nothing is read or sent: `delivered: []`.
 * Copy comes from the catalogue (i18n/copy); there is no alert-notification entry, so the app name
 * and the existing severity labels are reused (copy-deck item, docs/backend-notes/p2-wp7.md).
 * A caregiver has no Settings row: its locale is the linked patient's language.
 *
 * AP-18/CR-105: the PATIENT's Telegram send additionally respects `Settings.notificationChannel`
 * ("AI Agents Acceptance Criteria.md" line 193 — `"none"` means send nothing). `recipientsFor`
 * already reads it as exactly one of 'none' | 'telegram' | 'whatsapp' | 'email' (a missing settings
 * row or an unrecognised value normalised to 'none' there, never guessed here); only 'telegram' has
 * a transport, so 'whatsapp' and 'email' fail closed the same as 'none' until one exists. This never
 * gates a caregiver (no Settings row exists for one — an ACTIVE caregiver's chat always receives
 * alerts) or push (contracts.ts:224: notificationChannel is "the CHAT channel" only; push is
 * governed by the granted subscription alone).
 */
import { APP_ORIGIN, BOT_IS_SIMULATED, PUSH_IS_SIMULATED } from '@/lib/config';
import { sendPush, type PushPayload } from '@/lib/push/send';
import { sendMessage } from '@/lib/messaging/telegram';
import { recipientsFor, type RecipientTarget } from '@/lib/data/pg/agent';
import { copy } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InteractionAlert } from '@/types/contracts';

export interface Delivery {
  subjectType: RecipientTarget['subjectType'];
  subjectId: string;
  channel: 'push' | 'telegram';
}

function severityLabel(severity: InteractionAlert['severity'], locale: Locale): string {
  const v = copy.vocabulary;
  const entry = severity === 'danger' ? v.severityDanger : severity === 'warning' ? v.severityWarning : v.severityInfo;
  return entry[locale];
}

/** The screen that holds the full alert for this recipient. */
export function alertPath(alert: Pick<InteractionAlert, 'id'>, subjectType: RecipientTarget['subjectType'], locale: Locale): string {
  return subjectType === 'patient' ? `/${locale}/app/safety/${alert.id}` : `/${locale}/care/alerts/${alert.id}`;
}

/** The only payload an alert push carries: title, body, url — nothing else, ever. */
export function alertPushPayload(alert: Pick<InteractionAlert, 'id' | 'severity'>, subjectType: RecipientTarget['subjectType'], locale: Locale): PushPayload {
  return { title: copy.shell.appName[locale], body: severityLabel(alert.severity, locale), url: alertPath(alert, subjectType, locale) };
}

export function alertChatText(alert: Pick<InteractionAlert, 'id' | 'severity'>, subjectType: RecipientTarget['subjectType'], locale: Locale): string {
  return `${copy.shell.appName[locale]} · ${severityLabel(alert.severity, locale)}\n${APP_ORIGIN}${alertPath(alert, subjectType, locale)}`;
}

export async function deliverAlert(alert: InteractionAlert): Promise<Delivery[]> {
  if (PUSH_IS_SIMULATED && BOT_IS_SIMULATED) return [];
  const recipients = await recipientsFor(alert.patientId);
  if (!recipients) return [];
  const locale: Locale = recipients.language;
  const delivered: Delivery[] = [];
  for (const t of recipients.targets) {
    if (t.push && !PUSH_IS_SIMULATED) {
      const r = await sendPush(t.push, alertPushPayload(alert, t.subjectType, locale));
      if (r.sent) delivered.push({ subjectType: t.subjectType, subjectId: t.subjectId, channel: 'push' });
    }
    // CR-105: 'none' (or an unrecognised value, already normalised to 'none') sends nothing; only
    // 'telegram' has a transport today. This is the PATIENT's own setting only — a caregiver target
    // here has no Settings row and is never gated by it.
    const chatAllowed = t.subjectType !== 'patient' || recipients.notificationChannel === 'telegram';
    if (t.chatId && !BOT_IS_SIMULATED && chatAllowed) {
      const r = await sendMessage(t.chatId, alertChatText(alert, t.subjectType, locale));
      if (r.sent) delivered.push({ subjectType: t.subjectType, subjectId: t.subjectId, channel: 'telegram' });
    }
  }
  return delivered;
}

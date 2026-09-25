// @vitest-environment node
/**
 * AP-18 (docs/AGENTS-POLISH-PLAN.md 7.3) - lib/agent/notify.ts's deliverAlert must respect
 * Settings.notificationChannel: "none" sends no Telegram message to the PATIENT (AI Agents
 * Acceptance Criteria.md line 193: "Settings.notificationChannel respected, 'none' meaning send
 * nothing"). Two things stay unaffected by that setting, per the same spec line and contracts.ts
 * :224 (notificationChannel is "the CHAT channel" only): an ACTIVE caregiver's chat (no Settings
 * row exists for a caregiver at all) and the patient's own push (governed by the granted
 * subscription, not by this setting).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  recipients: vi.fn(async (): Promise<unknown> => null),
  sendMessage: vi.fn(async (): Promise<unknown> => ({ sent: true })),
  sendPush: vi.fn(async (): Promise<unknown> => ({ sent: true, statusCode: 201 })),
}));

vi.mock('@/lib/config', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/config')>()),
  BOT_IS_SIMULATED: false,
  PUSH_IS_SIMULATED: false,
}));
vi.mock('@/lib/data/pg/agent', () => ({ recipientsFor: h.recipients }));
vi.mock('@/lib/messaging/telegram', () => ({ sendMessage: h.sendMessage }));
vi.mock('@/lib/push/send', () => ({ sendPush: h.sendPush }));

import { alertChatText, deliverAlert } from '@/lib/agent/notify';
import type { InteractionAlert } from '@/types/contracts';

// deliverAlert reads only id/patientId/severity (alertPushPayload/alertChatText take even less);
// the rest of InteractionAlert is irrelevant to notification routing, so it is cast, not filled in.
const ALERT = { id: 'ia_X', patientId: 'pt-01', severity: 'danger' as const } as InteractionAlert;
const PUSH = { endpoint: 'https://push.example/x', p256dh: 'k', auth: 'a' };

/** One patient target, one channel value, optionally with push attached. */
const patientOnly = (notificationChannel: unknown, withPush = false) => ({
  patientId: 'pt-01', language: 'ar', notificationChannel,
  targets: [{ subjectType: 'patient', subjectId: 'pt-01', chatId: 'c-patient', push: withPush ? PUSH : null }],
});

describe('deliverAlert - Settings.notificationChannel (AP-18, CR-105)', () => {
  afterEach(() => vi.clearAllMocks());

  it('(a) "none" with a connected chat: sendMessage is never called for the patient', async () => {
    h.recipients.mockResolvedValueOnce(patientOnly('none'));
    const delivered = await deliverAlert(ALERT);
    expect(h.sendMessage).not.toHaveBeenCalled();
    expect(delivered).toEqual([]);
  });

  it('(b) "telegram": called exactly once with alertChatText(alert, "patient", locale)', async () => {
    h.recipients.mockResolvedValueOnce(patientOnly('telegram'));
    const delivered = await deliverAlert(ALERT);
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage).toHaveBeenCalledWith('c-patient', alertChatText(ALERT, 'patient', 'ar'));
    expect(delivered).toEqual([{ subjectType: 'patient', subjectId: 'pt-01', channel: 'telegram' }]);
  });

  it('(c) "whatsapp" and "email": not called - no transport exists, so the code fails closed', async () => {
    for (const channel of ['whatsapp', 'email']) {
      h.recipients.mockResolvedValueOnce(patientOnly(channel));
      await deliverAlert(ALERT);
    }
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it('(d) a missing value (no settings row, read as null) is treated as "none", not "send"', async () => {
    h.recipients.mockResolvedValueOnce(patientOnly(null));
    await deliverAlert(ALERT);
    expect(h.sendMessage).not.toHaveBeenCalled();
  });

  it('(e) an ACTIVE caregiver still gets the alert when the patient reads "none" (no Settings row for caregivers)', async () => {
    h.recipients.mockResolvedValueOnce({
      patientId: 'pt-01', language: 'ar', notificationChannel: 'none',
      targets: [
        { subjectType: 'patient', subjectId: 'pt-01', chatId: 'c-patient', push: null },
        { subjectType: 'caregiver', subjectId: 'cg-01', chatId: 'c-caregiver', push: null },
      ],
    });
    const delivered = await deliverAlert(ALERT);
    expect(h.sendMessage).toHaveBeenCalledTimes(1);
    expect(h.sendMessage).toHaveBeenCalledWith('c-caregiver', alertChatText(ALERT, 'caregiver', 'ar'));
    expect(delivered).toEqual([{ subjectType: 'caregiver', subjectId: 'cg-01', channel: 'telegram' }]);
  });

  it('(f) the patient\'s push still sends under "none" - push is the granted subscription, not the chat channel', async () => {
    h.recipients.mockResolvedValueOnce(patientOnly('none', true));
    const delivered = await deliverAlert(ALERT);
    expect(h.sendPush).toHaveBeenCalledTimes(1);
    expect(h.sendMessage).not.toHaveBeenCalled();
    expect(delivered).toEqual([{ subjectType: 'patient', subjectId: 'pt-01', channel: 'push' }]);
  });
});

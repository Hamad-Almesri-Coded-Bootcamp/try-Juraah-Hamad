/**
 * ENFORCEMENT.md — the `settings` rows (P2-WP5): E-09, E-10, E-11, E-12, each test titled by its id,
 * against the REAL database (tests/integration/setup.ts re-seeds before the file and FAILS loudly
 * without JURAH_DATABASE_URL — never skipped-as-pass). Each row asserts both halves (D-022/CR-044):
 * the database refuses (the trigger / the grant / the owner WHERE, shown with the owner's raw read)
 * AND the seam returns the mock's shape. Mutating tests re-seed first.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import * as pg from '@/lib/data/pg';
import * as mock from '@/lib/data/mock-impl';
import { reset } from '@/lib/data/mock/store';
import { accepts, app, rejects } from '../helpers';
import { ABDULLAH, BADR, HAMAD, SARA, as, asJson, count, owner, reseed } from './_wp5';
import type { Session } from '@/types/views';

beforeEach(async () => { await reseed(); reset(); });

const trackingAudit = () => count(`select 1 from audit_events where type in ('tracking_enabled', 'tracking_disabled')`);
const row = (p: string) => owner<string>(`select row(s.*)::text from settings s where patient_id = '${p}'`);

describe('G10 — the chat is optional', () => {
  it('E-09', async () => {
    // حمد's latest link (ml-01) is not_connected: the trigger resets the flag quietly, no audit row.
    const before = await row('pt-01');
    const audits = await trackingAudit();
    const got = await asJson(HAMAD, () => pg.updateSettings('pt-01', { adherenceCheckInEnabled: true }));
    expect(await row('pt-01')).toBe(before);
    expect(await trackingAudit()).toBe(audits);
    expect(got).toBe(await asJson(HAMAD, () => mock.updateSettings('pt-01', { adherenceCheckInEnabled: true }))); // the mock's shape, unchanged row
    expect(JSON.parse(got).adherenceCheckInEnabled).toBe(false);
    // the trigger itself, with no seam in between: a direct update as حمد is ACCEPTED (1 row) and the
    // value read back in the same transaction is still false (settings_tracking_requires_link)
    const direct = await accepts(app({ subjectId: 'pt-01', role: 'patient', civilId: '255031200187' }),
      `update settings set adherence_check_in_enabled = true where patient_id = 'pt-01'`,
      `select adherence_check_in_enabled from settings where patient_id = 'pt-01'`);
    expect(direct).toEqual({ count: 1, value: false });
    // positive control: سارة (ml-03 connected) off → on is accepted, each flip audited exactly once
    await as(SARA, () => pg.updateSettings('pt-03', { adherenceCheckInEnabled: false }));
    const on = await as(SARA, () => pg.updateSettings('pt-03', { adherenceCheckInEnabled: true }));
    expect(on.adherenceCheckInEnabled).toBe(true);
    expect(await trackingAudit()).toBe(audits + 2);
    const msgs = await count(`select 1 from audit_events where type = 'tracking_enabled' and message = 'تفعيل متابعة الجرعات' and actor_role = 'patient' and actor_id = 'pt-03' and related_id = 'pt-03'`);
    expect(msgs).toBeGreaterThanOrEqual(2); // the seed's ae-014 and the new one
  });

  it('E-10', async () => {
    // بدر has no messaging_links row (and no settings row): every read the seam serves him equals the mock's.
    const reads: [string, () => Promise<unknown>, () => Promise<unknown>][] = [
      ['getPatient', () => pg.getPatient('pt-04'), () => mock.getPatient('pt-04')],
      ['getSettings', () => pg.getSettings('pt-04'), () => mock.getSettings('pt-04')],
      ['getPrescriptions', () => pg.getPrescriptions('pt-04'), () => mock.getPrescriptions('pt-04')],
      ['getDosesForDay', () => pg.getDosesForDay('pt-04', '2026-09-21'), () => mock.getDosesForDay('pt-04', '2026-09-21')],
      ['getRecentDoses', () => pg.getRecentDoses('pt-04', 7), () => mock.getRecentDoses('pt-04', 7)],
      ['getAlerts', () => pg.getAlerts('pt-04'), () => mock.getAlerts('pt-04')],
      ['getRefillOverview', () => pg.getRefillOverview('pt-04'), () => mock.getRefillOverview('pt-04')],
      ['getRefillRequests', () => pg.getRefillRequests('pt-04'), () => mock.getRefillRequests('pt-04')],
      ['getCalendarSubscription', () => pg.getCalendarSubscription('pt-04'), () => mock.getCalendarSubscription('pt-04')],
      ['getActivity', () => pg.getActivity('pt-04'), () => mock.getActivity('pt-04')],
      ['getPushCapability', () => pg.getPushCapability(), () => mock.getPushCapability()],
      ['getPushState', () => pg.getPushState({ subjectType: 'patient', subjectId: 'pt-04' }), () => mock.getPushState({ subjectType: 'patient', subjectId: 'pt-04' })],
      ['getMessagingLink', () => pg.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-04' }), () => mock.getMessagingLink({ subjectType: 'patient', subjectId: 'pt-04' })],
      ['getCaregivers', () => pg.getCaregivers('pt-04'), () => mock.getCaregivers('pt-04')],
      ['getPendingInvitationsForSubject', () => pg.getPendingInvitationsForSubject(), () => mock.getPendingInvitationsForSubject()],
      ['getReviewQueue', () => pg.getReviewQueue(), () => mock.getReviewQueue()],
      ['getAuditLog', () => pg.getAuditLog({}), () => mock.getAuditLog({})],
    ];
    expect(await count(`select 1 from messaging_links where subject_id = 'pt-04'`)).toBe(0);
    for (const [name, real, reference] of reads) {
      expect(await asJson(BADR, real), name).toBe(await asJson(BADR, reference));
    }
  });

  it('E-11', async () => {
    // seam whitelist: the forbidden keys never reach SQL; the row is unchanged
    const before = await row('pt-01');
    const got = await asJson(HAMAD, () => pg.updateSettings('pt-01', { role: 'admin', foo: 1, patientId: 'pt-03' } as never));
    expect(await row('pt-01')).toBe(before);
    expect(got).toBe(await asJson(HAMAD, () => mock.updateSettings('pt-01', { role: 'admin', foo: 1, patientId: 'pt-03' } as never)));
    // the database: patient_id is outside jurah_app's UPDATE grant; there is no role / foo column at all
    await rejects(app({ subjectId: 'pt-01', role: 'patient', civilId: '255031200187' }), `update settings set patient_id = 'pt-03' where patient_id = 'pt-01'`, 'permission denied');
    await rejects(app({ subjectId: 'pt-01', role: 'patient', civilId: '255031200187' }), `update settings set role = 'admin' where patient_id = 'pt-01'`, 'column "role" of relation "settings" does not exist');
    // a caregiver (active, linked) writes nothing and gets the current row back (the mock's refusal)
    const cg = await asJson(ABDULLAH, () => pg.updateSettings('pt-01', { refillAlertsEnabled: false }));
    expect(await row('pt-01')).toBe(before);
    expect(cg).toBe(await asJson(ABDULLAH, () => mock.updateSettings('pt-01', { refillAlertsEnabled: false })));
  });

  it('E-12', async () => {
    const cols = await owner<string>(`select string_agg(column_name::text, ',' order by ordinal_position) from information_schema.columns where table_schema = 'public' and table_name = 'settings'`);
    expect(cols).toBe('patient_id,adherence_check_in_enabled,adherence_check_in_frequency,refill_alerts_enabled,calendar_sync_enabled,web_push_enabled,notification_channel,language');
    // no column, grant or route can disable the dashboard, screening or the engine
    expect(cols).not.toMatch(/dashboard|screen|engine|disable/);
  });
});

describe('updateSettings — the owner path (the mock is the arbiter)', () => {
  it('حمد refillAlertsEnabled → the fixture shape; بدر\'s first write creates his row with patientId LAST (the mock)', async () => {
    const s: Session = HAMAD;
    expect(await asJson(s, () => pg.updateSettings('pt-01', { refillAlertsEnabled: true })))
      .toBe(await asJson(s, () => mock.updateSettings('pt-01', { refillAlertsEnabled: true })));
    expect(await count(`select 1 from settings where patient_id = 'pt-04'`)).toBe(0);
    expect(await asJson(BADR, () => pg.updateSettings('pt-04', { language: 'en' })))
      .toBe(await asJson(BADR, () => mock.updateSettings('pt-04', { language: 'en' })));
    expect(await count(`select 1 from settings where patient_id = 'pt-04'`)).toBe(1);
  });
});

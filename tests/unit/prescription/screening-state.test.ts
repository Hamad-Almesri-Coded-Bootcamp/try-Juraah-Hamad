/**
 * AP-10 / CR-089 — features/prescription/screening-state.ts, the "being checked" derivation. Every
 * condition in its doc comment has a case here, and the seed (at REFERENCE_NOW, with screening live)
 * never reads as being checked.
 */
import { describe, expect, it } from 'vitest';
import { REFERENCE_NOW } from '@/lib/config';
import { buildAlerts, buildAuditEvents, buildPrescriptions } from '@/lib/data/mock/seed';
import { prescriptionsBeingChecked, SCREENING_ANSWER_WINDOW_MINUTES } from '@/features/prescription/screening-state';
import type { AuditEvent, InteractionAlert, Prescription } from '@/types/contracts';

const NOW = '2026-09-21T09:15:00+03:00';
const seed = buildPrescriptions();
const warfarin = seed.find((p) => p.id === 'rx-001')!; // حمد, active
const NEW: Prescription = { ...warfarin, id: 'rx_NEW', drug: { genericName: 'Ibuprofen', strengthMg: 400 }, needsReview: false, status: 'active' };

const added = (id: string, createdAt: string, type: AuditEvent['type'] = 'prescription_added'): AuditEvent => ({
  id: `ae-${id}-${createdAt}`, scope: 'patient', patientId: 'pt-01', actor: { role: 'patient', id: 'pt-01' }, type, message: 'm', createdAt, relatedId: id,
});
const alertOn = (ids: string[], createdAt: string, extra: Partial<InteractionAlert> = {}): InteractionAlert => ({
  id: `ia-${createdAt}`, patientId: 'pt-01', involvedPrescriptionIds: ids, severity: 'info', description: 'd', sourceCitation: '', createdAt, reviewStatus: 'auto_cleared', ...extra,
});
const run = (over: Partial<Parameters<typeof prescriptionsBeingChecked>[0]> = {}) =>
  [...prescriptionsBeingChecked({ prescriptions: [warfarin, NEW], alerts: [], activity: [added('rx_NEW', NOW)], nowIso: NOW, screeningLive: true, ...over })];

describe('CR-089 · a new prescription is "being checked" until screening answers', () => {
  it('a new, unflagged prescription with no answer yet is being checked', () => {
    expect(run()).toEqual(['rx_NEW']);
  });
  it('screening not running on this server (production today) → nothing is being checked', () => {
    expect(run({ screeningLive: false })).toEqual([]);
  });
  it('any alert naming it since the save is the answer: the "screened" marker (CR-077), a finding, or the hold', () => {
    expect(run({ alerts: [alertOn(['rx_NEW'], NOW)] })).toEqual([]); // info / auto_cleared, same second
    expect(run({ alerts: [alertOn(['rx-001', 'rx_NEW'], '2026-09-21T09:15:04+03:00', { severity: 'danger', reviewStatus: 'pending_medical_review' })] })).toEqual([]);
    expect(run({ alerts: [alertOn(['rx_NEW'], '2026-09-21T09:15:09+03:00', { severity: 'warning', reviewStatus: 'pending_medical_review' })] })).toEqual([]);
  });
  it('an alert that predates the save, or names only other prescriptions, is not an answer', () => {
    expect(run({ alerts: [alertOn(['rx_NEW'], '2026-09-21T09:00:00+03:00'), alertOn(['rx-001'], NOW)] })).toEqual(['rx_NEW']);
  });
  it('a flagged prescription is not being checked: its reviewer\'s confirmation screens it (TC-IX-06)', () => {
    expect(run({ prescriptions: [warfarin, { ...NEW, needsReview: true, fieldReviewStatus: 'pending' }] })).toEqual([]);
    expect(run({ prescriptions: [warfarin, { ...NEW, needsReview: true, fieldReviewStatus: 'returned' }] })).toEqual([]);
  });
  it('a confident save (needsReview false beside the CR-054 fieldReviewStatus "pending") IS handed over, so it is being checked', () => {
    expect(run({ prescriptions: [warfarin, { ...NEW, needsReview: false, fieldReviewStatus: 'pending' }] })).toEqual(['rx_NEW']);
  });
  it('once the reviewer confirms it, the confirmation is the trigger', () => {
    const confirmed = { ...NEW, fieldReviewStatus: 'confirmed' as const };
    const activity = [added('rx_NEW', '2026-09-21T08:00:00+03:00'), added('rx_NEW', NOW, 'prescription_field_confirmed')];
    // an answer to the first save (before the confirmation) does not count for the confirmation
    expect(run({ prescriptions: [warfarin, confirmed], activity, alerts: [alertOn(['rx_NEW'], '2026-09-21T08:00:30+03:00')] })).toEqual(['rx_NEW']);
  });
  it('with no other active prescription there is nothing to screen against, so nothing is awaited', () => {
    expect(run({ prescriptions: [NEW] })).toEqual([]);
    expect(run({ prescriptions: [{ ...warfarin, status: 'discontinued' }, NEW] })).toEqual([]);
  });
  it(`the wait lasts at most ${SCREENING_ANSWER_WINDOW_MINUTES} minutes after the save`, () => {
    expect(run({ nowIso: '2026-09-21T09:30:00+03:00' })).toEqual(['rx_NEW']); // exactly 15 minutes
    expect(run({ nowIso: '2026-09-21T09:30:01+03:00' })).toEqual([]);
  });
  it('no trigger row for it (added before the audit log existed), or not active → not being checked', () => {
    expect(run({ activity: [] })).toEqual([]);
    expect(run({ prescriptions: [warfarin, { ...NEW, status: 'completed' }] })).toEqual([]);
  });
  it('the seed at REFERENCE_NOW, with screening live, has nothing being checked', () => {
    expect([...prescriptionsBeingChecked({ prescriptions: seed, alerts: buildAlerts(), activity: buildAuditEvents(), nowIso: REFERENCE_NOW, screeningLive: true })]).toEqual([]);
  });
});

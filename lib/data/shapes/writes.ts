/**
 * Projection literals for the write paths — owned by package WP5 (lead split at Gate 1, D-020/D-022). Only that package edits this file;
 * `lib/data/shapes.ts` is the barrel the lead owns. Rules: docs/briefs/P2-common.md.
 *
 * What a SUCCESSFUL write returns, in the mock's key order (the round trip compares serialised
 * strings). Three of the mock's writes mutate a stored object in place, and in-place mutation has
 * its own key order: an existing key keeps its position, a key the write adds goes to the END, in
 * the order the write assigns it. `inPlace()` reproduces exactly that, so confirmPrescriptionFields
 * returns `…status, frequencyPerDay, startDate, doseTimes, fieldReviewedBy, fieldReviewedAt,
 * fieldReviewNote` for rx-006, as tests/fixtures/shapes.json recorded.
 */
import type { Prescription, RefillRequest, Settings } from '@/types/contracts';
import type { CaregiverView } from '@/types/views';
import { DEFAULT_SETTINGS } from '../mock/seed';
import { str, type DbRow } from './_core';

/** Settings after updateSettings. An existing row: patientId FIRST (the seed literal). A row the
 * write had to CREATE (بدر): the mock pushes `{...DEFAULT_SETTINGS, patientId}`, so patientId LAST. */
export function toSettingsWrite(r: DbRow, created: boolean): Settings {
  const seven = {
    adherenceCheckInEnabled: Boolean(r.adherence_check_in_enabled),
    adherenceCheckInFrequency: r.adherence_check_in_frequency as Settings['adherenceCheckInFrequency'],
    refillAlertsEnabled: Boolean(r.refill_alerts_enabled),
    calendarSyncEnabled: Boolean(r.calendar_sync_enabled),
    webPushEnabled: Boolean(r.web_push_enabled),
    notificationChannel: r.notification_channel as Settings['notificationChannel'],
    language: r.language as Settings['language'],
  };
  const patientId = String(r.patient_id);
  if (created) {
    // key order of DEFAULT_SETTINGS, then patientId (a spread keeps the defaults' order)
    const ordered = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const k of Object.keys(ordered)) ordered[k] = (seven as Record<string, unknown>)[k];
    return { ...ordered, patientId } as Settings;
  }
  return { patientId, ...seven };
}

/** RefillRequest — the mock's `request` literal (id, patientId, prescriptionId, requestedAt, routedTo, status). */
export function toRefillRequestWrite(r: DbRow): RefillRequest {
  return {
    id: String(r.id),
    patientId: String(r.patient_id),
    prescriptionId: String(r.prescription_id),
    requestedAt: String(r.requested_at),
    routedTo: r.routed_to as RefillRequest['routedTo'],
    status: r.status as RefillRequest['status'],
  };
}

/** CaregiverView of a NEW invitation — the mock's inviteCaregiver literal minus civilId:
 * id, name, relationship, linkedPatientId, status, invitedAt, expiresAt, accessLevel. */
export function toInvitedCaregiver(r: DbRow): CaregiverView {
  return {
    id: String(r.id),
    name: String(r.name),
    relationship: String(r.relationship),
    linkedPatientId: String(r.linked_patient_id),
    status: r.status as CaregiverView['status'],
    invitedAt: String(r.invited_at),
    expiresAt: String(r.expires_at),
    accessLevel: String(r.access_level) as CaregiverView['accessLevel'],
  };
}

/**
 * The mock's in-place mutation, as a projection: `before`'s keys in `before`'s order (new values
 * where the write changed them), then every key the write ADDED, in assignment order. A key
 * assigned `undefined` is dropped — JSON drops it in the mock too.
 */
export function inPlace<T extends object>(before: T, assignments: [keyof T, unknown][]): T {
  const out: Record<string, unknown> = { ...(before as Record<string, unknown>) };
  // An existing key is overwritten where it stands; a new key is appended (insertion order).
  for (const [k, v] of assignments) out[k as string] = v;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as T;
}

/** The first whitespace token of a name — the mock's `name.split(/\s+/)[0] ?? ''`. */
export function firstName(name: unknown): string {
  return (str(name) ?? '').split(/\s+/)[0] ?? '';
}

/** The five values a reviewer may confirm (CR-002 / spec "Field confirmation path") picked from
 * `values` — nothing else, whatever the caller sends (E-33). Top-level keys in `values`' own order
 * (the mock's Object.assign order); `drug` merged key by key into the stored drug. */
export interface ConfirmedFields {
  brandName?: string;
  strengthMg?: number;
  frequencyPerDay?: number;
  startDate?: string;
  doseTimes?: string[];
  /** top-level keys in the order `values` lists them (for inPlace). */
  order: ('frequencyPerDay' | 'startDate' | 'doseTimes')[];
  hasDrugChange: boolean;
}

export function pickConfirmedFields(values: Partial<Prescription> | null | undefined): ConfirmedFields {
  const out: ConfirmedFields = { order: [], hasDrugChange: false };
  if (!values || typeof values !== 'object') return out;
  const v = values as Record<string, unknown>;
  const drug = v.drug && typeof v.drug === 'object' ? (v.drug as Record<string, unknown>) : undefined;
  if (drug && drug.brandName !== undefined) { out.brandName = drug.brandName as string; out.hasDrugChange = true; }
  if (drug && drug.strengthMg !== undefined) { out.strengthMg = drug.strengthMg as number; out.hasDrugChange = true; }
  for (const k of Object.keys(v)) {
    if ((k === 'frequencyPerDay' || k === 'startDate' || k === 'doseTimes') && v[k] !== undefined) {
      (out as unknown as Record<string, unknown>)[k] = v[k];
      out.order.push(k);
    }
  }
  return out;
}

/** The stored drug with the two confirmable drug keys applied, in the drug literal's key order
 * (genericName, brandName, strengthMg, strengthUnit). */
export function confirmedDrug(drug: Prescription['drug'], f: ConfirmedFields): Prescription['drug'] {
  const merged: Prescription['drug'] = { ...drug };
  if (f.brandName !== undefined) merged.brandName = f.brandName;
  if (f.strengthMg !== undefined) merged.strengthMg = f.strengthMg;
  const ordered: Record<string, unknown> = {};
  for (const k of ['genericName', 'brandName', 'strengthMg', 'strengthUnit'] as const) if (merged[k] !== undefined) ordered[k] = merged[k];
  return ordered as Prescription['drug'];
}

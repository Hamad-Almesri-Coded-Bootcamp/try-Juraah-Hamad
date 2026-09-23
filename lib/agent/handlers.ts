/**
 * The six agent route handlers (P2-WP7, API-SURFACE §B). Each route.ts under app/api/agent/** is one
 * line that calls one of these. Order, always: auth (403 session / 401 bearer) → body validation
 * (422) → backend (503 under the mock) → the database (lib/data/pg/agent.ts, the only SQL) → status.
 * No SQL here (guard 8), no copy here (guard 7 scans app/**; the audit messages are ./messages.ts).
 *
 * This is the one documented way the AI-agents track writes results. The six agents are NOT built.
 */
import {
  checkInEligibility, insertAlert, insertExtractedPrescription, recipientsFor, recomputeSchedule, recordDoseStatus,
} from '@/lib/data/pg/agent';
import { refuseUnlessAgent } from './auth';
import { invalid, json, readJson, refusedBy, unavailableUnderMock } from './http';
import { deliverAlert } from './notify';
import { parseAlertBody, parseDoseStatusBody, parsePatientIdQuery, parsePrescriptionBody, parseRecomputeBody } from './validate';

/** POST /api/agent/doses/{doseId}/status — 200 · 401 · 403 · 404 · 409 untracked · 422. */
export async function postDoseStatus(request: Request, doseId: string): Promise<Response> {
  const refused = await refuseUnlessAgent(request);
  if (refused) return refused;
  const body = parseDoseStatusBody(await readJson(request));
  if (!body.ok) return invalid(body);
  const mock = unavailableUnderMock();
  if (mock) return mock;
  const r = await recordDoseStatus(doseId, body.value);
  switch (r.kind) {
    case 'ok': return json(200, { dose: r.dose });
    case 'not_found': return json(404, { error: 'dose_not_found' });
    case 'untracked': return json(409, { error: 'untracked_dose' });
    case 'refused': return refusedBy(r.constraint);
  }
}

/** POST /api/agent/schedule/recompute — runs as the system actor (D-025). */
export async function postRecompute(request: Request): Promise<Response> {
  const refused = await refuseUnlessAgent(request);
  if (refused) return refused;
  const body = parseRecomputeBody(await readJson(request));
  if (!body.ok) return invalid(body);
  const mock = unavailableUnderMock();
  if (mock) return mock;
  const r = await recomputeSchedule(body.value);
  switch (r.kind) {
    case 'not_found': return json(404, { error: 'prescription_not_found' });
    case 'dose_not_found': return json(404, { error: 'dose_not_found' });
    case 'dose_of_other_prescription': return json(422, { error: 'invalid_body', field: 'missedDoseId', reason: 'not_a_dose_of_this_prescription' });
    case 'not_a_recorded_miss': return json(409, { error: 'not_a_recorded_miss' });
    case 'not_active': return json(409, { error: 'prescription_not_active' });
    case 'invalid_date': return json(422, { error: 'invalid_body', field: 'discontinuedAt', reason: 'not_an_iso_date' });
    case 'recomputed': return json(200, { changed: r.changed, addedIds: r.addedIds, droppedIds: r.droppedIds });
    case 'discontinued': return json(200, { prescription: r.prescription, cancelledDoseIds: r.cancelledDoseIds });
  }
}

/** POST /api/agent/alerts — 201 `{ alert, delivered }`; `delivered: []` while push and chat are simulated. */
export async function postAlert(request: Request): Promise<Response> {
  const refused = await refuseUnlessAgent(request);
  if (refused) return refused;
  const body = parseAlertBody(await readJson(request));
  if (!body.ok) return invalid(body);
  const mock = unavailableUnderMock();
  if (mock) return mock;
  const r = await insertAlert(body.value);
  if (r.kind === 'prescriptions_not_of_patient') {
    return json(422, { error: 'invalid_body', field: 'involvedPrescriptionIds', reason: 'not_prescriptions_of_this_patient', ids: r.ids });
  }
  if (r.kind === 'refused') return refusedBy(r.constraint);
  // After the commit: a failed or simulated delivery never un-raises the alert (G12, push is optional).
  const delivered = await deliverAlert(r.alert);
  return json(201, { alert: r.alert, delivered });
}

/** POST /api/agent/prescriptions — the extraction write path. 201 `{ prescription, doseCount }`. */
export async function postPrescription(request: Request): Promise<Response> {
  const refused = await refuseUnlessAgent(request);
  if (refused) return refused;
  const body = parsePrescriptionBody(await readJson(request));
  if (!body.ok) return invalid(body);
  const mock = unavailableUnderMock();
  if (mock) return mock;
  const r = await insertExtractedPrescription(body.value);
  if (r.kind === 'refused') return refusedBy(r.constraint);
  return json(201, { prescription: r.prescription, doseCount: r.doseCount });
}

/** GET /api/agent/check-in-eligibility — `[{ patientId, chatId, language, frequency }]`. */
export async function getCheckInEligibility(request: Request): Promise<Response> {
  const refused = await refuseUnlessAgent(request);
  if (refused) return refused;
  const mock = unavailableUnderMock();
  if (mock) return mock;
  return json(200, await checkInEligibility());
}

/** GET /api/agent/alert-recipients?patientId= — push PRESENCE only; the keys never leave the server. */
export async function getAlertRecipients(request: Request): Promise<Response> {
  const refused = await refuseUnlessAgent(request);
  if (refused) return refused;
  const q = parsePatientIdQuery(new URL(request.url).searchParams.get('patientId'));
  if (!q.ok) return invalid(q);
  const mock = unavailableUnderMock();
  if (mock) return mock;
  const r = await recipientsFor(q.value);
  if (!r) return json(404, { error: 'patient_not_found' });
  const [self, ...caregivers] = r.targets;
  return json(200, {
    patientId: r.patientId,
    patient: { chatId: self?.chatId ?? null, push: !!self?.push },
    caregivers: caregivers.map((c) => ({ caregiverId: c.subjectId, chatId: c.chatId, push: !!c.push })),
  });
}

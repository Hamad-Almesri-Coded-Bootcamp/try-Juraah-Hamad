/**
 * CR-066 — the seam's calls to the drug-knowledge agents (n8n, agents/knowledge). Server-only I/O,
 * imported by lib/data/pg alone (and by ./state.ts, which tells a screen only WHETHER screening
 * runs). NOT a 'use server' module on purpose: none of these may become a server action a browser
 * could call with any patient id. The caller has already checked the VERIFIED session (the
 * patient's own) before it gets here.
 *
 * Each function returns null when its URL is not configured — the caller then keeps the CR-049 stub.
 * Once configured, a failure (timeout, non-2xx, a shape the app does not accept) is the conservative
 * outcome, never the stub's canned answer: a real patient's photo must never get a fake result.
 */
import { AGENT_EXTRACTION_URL, AGENT_INBOUND_SECRET, AGENT_SCREENING_URL, AGENT_TRAVEL_CHECK_URL } from '@/lib/config';
import type { DrugCheckOutcome } from '@/types/views';
import {
  extractionPayload, MAX_IMAGE_BYTES, mimeOf, readDrugCheck, readExtraction, screeningPayload, travelPayload,
  webhookConfigured, type AgentLanguage, type ExtractedDraft,
} from './core';

/** Vision + backend round trip; Gemini is usually a few seconds. The page itself waits on this. */
const VISION_TIMEOUT_MS = 45_000;
/** The screening webhook answers on receipt (responseMode onReceived) — it only has to accept the job. */
const SCREENING_TIMEOUT_MS = 8_000;

export const travelCheckConfigured = (): boolean => webhookConfigured(AGENT_TRAVEL_CHECK_URL, AGENT_INBOUND_SECRET);
export const extractionConfigured = (): boolean => webhookConfigured(AGENT_EXTRACTION_URL, AGENT_INBOUND_SECRET);
export const screeningConfigured = (): boolean => webhookConfigured(AGENT_SCREENING_URL, AGENT_INBOUND_SECRET);

async function post(url: string, body: unknown, timeoutMs: number): Promise<{ status: number; json: unknown }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-jurah-secret': AGENT_INBOUND_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
    cache: 'no-store',
  });
  return { status: res.status, json: await res.json().catch(() => null) };
}

async function imageOf(image: Blob, allowPdf: boolean): Promise<{ base64: string; mime: string } | null> {
  if (image.size === 0 || image.size > MAX_IMAGE_BYTES) return null;
  const bytes = new Uint8Array(await image.arrayBuffer());
  const mime = mimeOf(image.type, bytes.subarray(0, 16), allowPdf);
  return mime ? { base64: Buffer.from(bytes).toString('base64'), mime } : null;
}

/** C3 — agent-travel-check. null → not configured (keep the stub). */
export async function askTravelCheck(patientId: string, image: Blob, language: AgentLanguage): Promise<DrugCheckOutcome | null> {
  if (!travelCheckConfigured()) return null;
  try {
    const img = await imageOf(image, false);
    if (!img) return { kind: 'could_not_identify' };
    const { status, json } = await post(AGENT_TRAVEL_CHECK_URL, travelPayload(patientId, img.base64, img.mime, language), VISION_TIMEOUT_MS);
    return readDrugCheck(status, json);
  } catch {
    return { kind: 'could_not_identify' };
  }
}

/** B4 — agent-extraction (save:false). null → not configured (keep the stub). */
export async function askExtraction(
  patientId: string,
  image: Blob,
  language: AgentLanguage,
): Promise<{ draft: ExtractedDraft; imageBase64: string | null } | null> {
  if (!extractionConfigured()) return null;
  try {
    const img = await imageOf(image, true);
    if (!img) return { draft: { kind: 'unreadable' }, imageBase64: null };
    const { status, json } = await post(AGENT_EXTRACTION_URL, extractionPayload(patientId, img.base64, img.mime, language), VISION_TIMEOUT_MS);
    return { draft: readExtraction(status, json, patientId), imageBase64: img.base64 };
  } catch {
    return { draft: { kind: 'unreadable' }, imageBase64: null };
  }
}

/**
 * AP-10 — hands one prescription to the Interaction Screening agent, AFTER the write that made it
 * screenable has COMMITTED (the agent reads it back through /api/agent). AWAITED by its one caller,
 * lib/data/pg/screening.ts screenOrHold, never fire-and-forget: on a serverless function a promise
 * left running after the response is not guaranteed to finish, so a detached call could be lost
 * without a trace. The wait is bounded by SCREENING_TIMEOUT_MS and covers only n8n ACCEPTING the job
 * (the workflow answers on receipt); the result arrives later, as alerts through /api/agent/alerts.
 * Returns whether n8n accepted it. false (down, a timeout, a non-2xx) makes the
 * caller HOLD the prescription for a specialist, so a job n8n did not accept is never silently lost.
 * The save itself has already committed and stands whatever n8n answers.
 */
export async function requestScreening(patientId: string, prescriptionId: string, language: AgentLanguage): Promise<boolean> {
  if (!screeningConfigured()) return false;
  try {
    const { status } = await post(AGENT_SCREENING_URL, screeningPayload(patientId, prescriptionId, language), SCREENING_TIMEOUT_MS);
    return status >= 200 && status < 300;
  } catch {
    return false;
  }
}

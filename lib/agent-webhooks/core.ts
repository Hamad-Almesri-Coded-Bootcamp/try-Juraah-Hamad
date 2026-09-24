/**
 * CR-066 — the seam's bridge to the drug-knowledge agents (agents/knowledge), pure parts
 * (unit-tested in tests/unit/agent-webhooks/core.test.ts). ./index.ts does the I/O.
 *
 * Every answer from n8n is UNTRUSTED input. Each reader below accepts exactly the app's own shape
 * and turns anything else into the conservative outcome the screen already has:
 *   - drug check  → `could_not_identify` (never a guessed drug, never a false "no interaction"),
 *                    or `cannot_verify` (CR-078) when the agent recognised the medicine but could
 *                    not screen it against the whole profile;
 *   - extraction  → `unreadable` (never a fabricated record).
 * An extracted prescription is checked with the backend's OWN validator (lib/agent/validate.ts
 * parsePrescriptionBody, the one POST /api/agent/prescriptions uses) plus CR-002 invariant (1), so
 * the app can never hold a draft the database would refuse.
 */
import { parsePrescriptionBody, UNCERTAIN_FIELD_KEYS, type UncertainField } from '@/lib/agent/validate';
import type { Prescription } from '@/types/contracts';
import type { DrugCheckOutcome } from '@/types/views';

export type AgentLanguage = 'ar' | 'en';

/** A `/webhook/` URL of an activated workflow over https, and a secret; `/webhook-test/` is a bug, never a fallback. */
export function webhookConfigured(url: string, secret: string): boolean {
  return /^https:\/\/[^/\s]+\/webhook\/\S+$/.test(url) && !url.includes('/webhook-test/') && secret.length > 0;
}

export function languageOf(value: unknown): AgentLanguage {
  return value === 'en' ? 'en' : 'ar';
}

const MIME_OK = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

/**
 * The image's media type: the browser's own label when it is one the agents accept, otherwise the
 * file's magic bytes (a picked file can arrive with an empty `type`). null → not an accepted image;
 * the caller answers with the conservative outcome and calls nothing.
 */
export function mimeOf(declared: string, head: Uint8Array, allowPdf: boolean): string | null {
  const d = (declared || '').toLowerCase().trim();
  if (d === 'image/jpg') return 'image/jpeg';
  if (MIME_OK.has(d) || (allowPdf && d === 'application/pdf')) return d;
  const b = head;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  const ascii = (from: number, to: number) => String.fromCharCode(...b.slice(from, to));
  if (b.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  if (b.length >= 12 && ascii(4, 8) === 'ftyp' && /^(heic|heix|hevc|mif1|msf1|heim|heis)$/.test(ascii(8, 12))) return 'image/heic';
  if (allowPdf && b.length >= 4 && ascii(0, 4) === '%PDF') return 'application/pdf';
  return null;
}

/** The agents' own ceiling (agents/knowledge input nodes): 10 MB of image. The server action allows 4 MB anyway. */
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

// ---------------------------------------------------------------------------------------------
// Travel check → DrugCheckOutcome
// ---------------------------------------------------------------------------------------------

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const COULD_NOT_IDENTIFY: DrugCheckOutcome = { kind: 'could_not_identify' };

export function travelPayload(patientId: string, imageBase64: string, mimeType: string, language: AgentLanguage) {
  return { patientId, imageBase64, mimeType, language };
}

/**
 * agent-travel-check's answer → the app's DrugCheckOutcome. Only `appOutcome` is read; anything
 * unexpected is could_not_identify. `cannot_verify` (CR-078) passes through as its own outcome —
 * extra fields on it are never read.
 */
export function readDrugCheck(status: number, body: unknown): DrugCheckOutcome {
  if (status < 200 || status >= 300 || !isObj(body) || !isObj(body.appOutcome)) return COULD_NOT_IDENTIFY;
  const o = body.appOutcome;
  if (o.kind === 'could_not_identify') return COULD_NOT_IDENTIFY;
  if (o.kind === 'cannot_verify') return { kind: 'cannot_verify' };
  if (o.kind !== 'identified') return COULD_NOT_IDENTIFY;
  if (typeof o.drugName !== 'string' || o.drugName.trim().length === 0 || o.drugName.length > 200) return COULD_NOT_IDENTIFY;
  if (o.verdict !== 'no_interaction' && o.verdict !== 'interaction_found') return COULD_NOT_IDENTIFY;
  const drugName = o.drugName.trim();
  if (o.verdict === 'no_interaction') return { kind: 'identified', drugName, verdict: 'no_interaction' };
  // An alert id we cannot trust is dropped, never followed: the screen then shows the finding without the link.
  return typeof o.alertId === 'string' && ID.test(o.alertId)
    ? { kind: 'identified', drugName, verdict: 'interaction_found', alertId: o.alertId }
    : { kind: 'identified', drugName, verdict: 'interaction_found' };
}

// ---------------------------------------------------------------------------------------------
// Extraction → the draft the app stores (ExtractionOutcome minus draftId)
// ---------------------------------------------------------------------------------------------

export function extractionPayload(patientId: string, imageBase64: string, mimeType: string, language: AgentLanguage) {
  // save:false — the agent reads and validates only. The patient confirms in B4, and the app's own
  // savePrescriptionDraft writes the record (no second path into prescriptions).
  return { patientId, imageBase64, mimeType, language, save: false };
}

export type ExtractedDraft =
  | { kind: 'confident'; prescription: Partial<Prescription> }
  | { kind: 'needs_review'; prescription: Partial<Prescription>; uncertainFields: UncertainField[] }
  | { kind: 'unreadable' };

const UNREADABLE: ExtractedDraft = { kind: 'unreadable' };
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** agent-extraction's answer → a draft, or unreadable. */
export function readExtraction(status: number, body: unknown, patientId: string): ExtractedDraft {
  if (status < 200 || status >= 300 || !isObj(body) || !isObj(body.appOutcome)) return UNREADABLE;
  const o = body.appOutcome;
  if (o.kind !== 'confident' && o.kind !== 'needs_review') return UNREADABLE;
  const needsReview = o.kind === 'needs_review';
  const uncertain = needsReview ? o.uncertainFields : [];
  if (!Array.isArray(uncertain)) return UNREADABLE;
  if (needsReview && uncertain.length === 0) return UNREADABLE;
  if (!isObj(o.prescription)) return UNREADABLE;

  // The backend's own validator, on the body the backend itself would receive.
  const v = parsePrescriptionBody({ patientId, prescription: o.prescription, needsReview, uncertainFields: uncertain });
  if (!v.ok) return UNREADABLE;
  const p = v.value.prescription;

  // CR-002 invariant (1): an unflagged prescription carries its full schedule, or it is not unflagged.
  const times = p.doseTimes;
  const scheduleOk = typeof p.frequencyPerDay === 'number' && Array.isArray(times) && times.length === p.frequencyPerDay &&
    times.every((t) => HHMM.test(t)) && new Set(times).size === times.length;
  if (!needsReview && !(typeof p.drug.strengthMg === 'number' && typeof p.startDate === 'string' && scheduleOk)) return UNREADABLE;
  // Whatever IS present must still be coherent (a flagged field is absent, never half-filled).
  if (times !== undefined && !scheduleOk) return UNREADABLE;
  if (!(p.durationDays > 0)) return UNREADABLE;

  const prescription: Partial<Prescription> = {
    ...p,
    needsReview,
    ...(needsReview ? { fieldReviewStatus: 'pending' as const } : {}),
    status: 'active',
  };
  return needsReview
    ? { kind: 'needs_review', prescription, uncertainFields: v.value.uncertainFields.filter((f) => UNCERTAIN_FIELD_KEYS.includes(f)) }
    : { kind: 'confident', prescription };
}

/** The real source read off the paper (CR-042), when the draft carries one; the stub's drafts never do. */
export function draftSource(draft: Partial<Prescription> | undefined): Prescription['source'] | null {
  const s = draft?.source;
  if (!s || typeof s.facilityName !== 'string' || s.facilityName.trim().length === 0) return null;
  return s.sector === 'public' || s.sector === 'private' ? { facilityName: s.facilityName, sector: s.sector } : null;
}

// ---------------------------------------------------------------------------------------------
// Screening
// ---------------------------------------------------------------------------------------------

export function screeningPayload(patientId: string, newPrescriptionId: string, language: AgentLanguage) {
  return { patientId, newPrescriptionId, language };
}

/** Only an active, unflagged prescription is screened; a flagged one waits for the reviewer (TC-IX-06). */
export function shouldScreen(rx: Pick<Prescription, 'id' | 'needsReview' | 'status'> | null | undefined): boolean {
  return !!rx && typeof rx.id === 'string' && ID.test(rx.id) && rx.needsReview === false && rx.status === 'active';
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

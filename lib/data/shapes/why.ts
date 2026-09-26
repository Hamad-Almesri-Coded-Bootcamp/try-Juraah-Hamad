/**
 * CR-113 — "Why they interact": picks the DDInter why-entry for an alert's pair. Pure, shared by the
 * mock and the postgres implementations; the data comes in as an argument, never imported here.
 *
 * Keys are the interaction index's own: lowercase generic names, sorted, joined by "|". A
 * prescription's generic name may be a combination ("Calcium carbonate + vitamin D3"), so every
 * ingredient of one involved prescription is paired with every ingredient of another, and the most
 * severe matching entry wins (Major > Moderate > Minor). Anything malformed reads as no entry:
 * the screen then keeps today's Source card (fail closed, never a guessed explanation).
 */
import type { Prescription } from '@/types/contracts';
import type { AlertWhy } from '@/types/views';

export interface WhyEntry {
  level?: unknown;
  url?: unknown;
  mechanism?: unknown;
  management?: unknown;
  summary?: unknown;
}
export interface WhyData {
  meta?: { citation?: unknown };
  pairs?: Record<string, WhyEntry>;
}

const RANK: Record<AlertWhy['level'], number> = { Major: 0, Moderate: 1, Minor: 2 };
/** The index's canonical name where the common spelling differs (agents/knowledge/src/normalise.js). */
const SYNONYM: Record<string, string> = { paracetamol: 'acetaminophen' };
const DDINTER_RECORD = /^https:\/\/ddinter\.scbdd\.com\//;

export function ingredientsOf(genericName: string): string[] {
  return genericName
    .split('+')
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
    .map((name) => SYNONYM[name] ?? name);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toWhy(entry: WhyEntry | undefined, drugs: [string, string], citation: string): AlertWhy | null {
  if (!entry || typeof entry !== 'object') return null;
  const level = entry.level;
  if (level !== 'Major' && level !== 'Moderate' && level !== 'Minor') return null;
  const url = text(entry.url);
  const mechanism = text(entry.mechanism);
  const management = text(entry.management);
  if (!url || !DDINTER_RECORD.test(url) || !mechanism || !management) return null;
  const raw = entry.summary as { en?: unknown; ar?: unknown } | null | undefined;
  const en = raw ? text(raw.en) : null;
  const ar = raw ? text(raw.ar) : null;
  return { level, drugs, summary: en && ar ? { en, ar } : null, mechanism, management, url, citation };
}

export function alertWhy(involved: Prescription[], data: WhyData | null | undefined): AlertWhy | null {
  if (!data || typeof data !== 'object' || !data.pairs || typeof data.pairs !== 'object') return null;
  const citation = text(data.meta?.citation) ?? '';
  let best: AlertWhy | null = null;
  const lists = involved.map((rx) => ingredientsOf(rx.drug.genericName));
  for (const [i, first] of lists.entries()) {
    for (const second of lists.slice(i + 1)) {
      for (const a of first) {
        for (const b of second) {
          if (a === b) continue;
          const drugs = [a, b].sort() as [string, string];
          const why = toWhy(data.pairs[drugs.join('|')], drugs, citation);
          if (why && (!best || RANK[why.level] < RANK[best.level])) best = why;
        }
      }
    }
  }
  return best;
}

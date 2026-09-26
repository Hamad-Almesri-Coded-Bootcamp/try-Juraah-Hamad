/**
 * CR-113 — "Why they interact": picks the DDInter why-entry for an alert's pair. Pure, shared by the
 * mock and the postgres implementations; the data comes in as an argument, never imported here.
 *
 * Keys are the interaction index's own: lowercase generic names, sorted, joined by "|". The pair
 * comes from two places, and the most severe matching entry wins (Major > Moderate > Minor):
 * - the involved prescriptions: every ingredient of one paired with every ingredient of another (a
 *   generic name may be a combination, "Calcium carbonate + vitamin D3");
 * - the alert's own source citation, which the agents write as "Interaction record: <A> (<id>) x
 *   <B> (<id>), level ..." (agents/knowledge/src/text.js pairCitation). A box-photo alert names only
 *   the patient's prescription - the photographed medicine is not a prescription - so its pair is
 *   known only from the citation (final review, 2026-09-26).
 * Anything malformed reads as no entry: the screen then keeps today's Source card (fail closed,
 * never a guessed explanation).
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
const SYNONYM: Record<string, string> = { paracetamol: 'acetaminophen', 'vitamin d3': 'cholecalciferol', 'vitamin d': 'cholecalciferol' };
const DDINTER_RECORD = /^https:\/\/ddinter\.scbdd\.com\//;
const CITED_PAIR = /Interaction record: (.+?) \(DDInter\d+\) x (.+?) \(DDInter\d+\), level "/g;

const keyOf = (name: string) => {
  const lower = name.trim().toLowerCase();
  return SYNONYM[lower] ?? lower;
};

export function ingredientsOf(genericName: string): string[] {
  return genericName
    .split('+')
    .map((part) => part.trim())
    .filter(Boolean)
    .map(keyOf);
}

/** The pairs an alert's own citation names, as written: [[labelA, labelB], ...]. */
export function citedPairs(citation: string | null | undefined): Array<[string, string]> {
  if (typeof citation !== 'string') return [];
  return [...citation.matchAll(CITED_PAIR)]
    .map((m) => [(m[1] ?? '').trim(), (m[2] ?? '').trim()] as [string, string])
    .filter(([a, b]) => a !== '' && b !== '');
}

function text(value: unknown): string | null {
  // DDInter prints "-" where it has no text: that is no text, never advice to show.
  return typeof value === 'string' && value.trim() !== '' && value.trim() !== '-' ? value : null;
}

function toWhy(entry: WhyEntry | undefined, drugs: [string, string], labels: [string, string], citation: string): AlertWhy | null {
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
  return { level, drugs, labels, summary: en && ar ? { en, ar } : null, mechanism, management, url, citation };
}

export function alertWhy(involved: Prescription[], data: WhyData | null | undefined, alertCitation?: string | null): AlertWhy | null {
  if (!data || typeof data !== 'object' || !data.pairs || typeof data.pairs !== 'object') return null;
  const pairs = data.pairs;
  const citation = text(data.meta?.citation) ?? '';
  let best: AlertWhy | null = null;
  const consider = (labelA: string, labelB: string) => {
    const a = keyOf(labelA);
    const b = keyOf(labelB);
    if (!a || !b || a === b) return;
    const aFirst = a < b;
    const drugs = (aFirst ? [a, b] : [b, a]) as [string, string];
    const labels = (aFirst ? [labelA, labelB] : [labelB, labelA]) as [string, string];
    const why = toWhy(pairs[drugs.join('|')], drugs, labels, citation);
    if (why && (!best || RANK[why.level] < RANK[best.level])) best = why;
  };
  const lists = involved.map((rx) => rx.drug.genericName.split('+').map((part) => part.trim()).filter(Boolean));
  for (const [i, first] of lists.entries()) {
    for (const second of lists.slice(i + 1)) {
      for (const a of first) for (const b of second) consider(a, b);
    }
  }
  for (const [a, b] of citedPairs(alertCitation)) consider(a, b);
  return best;
}

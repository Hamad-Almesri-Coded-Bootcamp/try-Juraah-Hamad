// @vitest-environment node
/**
 * P2-WP6 — lib/calendar/ics.ts against the seed (the mock transcription of docs/Seed Dataset.md),
 * validated by a strict RFC 5545 parser (ical.js), plus the exact rule-3 assertion: an untracked
 * dose carries no status word, and the decision keys off `tracked`, never the status word.
 */
import { describe, expect, it } from 'vitest';
import ICAL from 'ical.js';
import { buildDoses, buildPrescriptions, buildSettings } from '@/lib/data/mock/seed';
import { REFERENCE_NOW } from '@/lib/config';
import { buildIcs, doseSummary, foldLine, ICS_PRODID } from '@/lib/calendar/ics';
import type { DoseWithPrescription } from '@/types/views';

const prescriptions = buildPrescriptions();
const doses = buildDoses(prescriptions, new Map(buildSettings().map((s) => [s.patientId, s])));

function feedFor(patientId: string): DoseWithPrescription[] {
  const rxById = new Map(prescriptions.map((p) => [p.id, p]));
  return doses
    .filter((d) => rxById.get(d.prescriptionId)?.patientId === patientId)
    .map((d) => {
      const rx = rxById.get(d.prescriptionId)!;
      return { ...d, drug: { genericName: rx.drug.genericName, brandName: rx.drug.brandName, strengthMg: rx.drug.strengthMg, strengthUnit: rx.drug.strengthUnit }, dosePerAdministration: rx.dosePerAdministration };
    })
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.id.localeCompare(b.id));
}

const DOSE_WORDS = ['upcoming', 'taken_on_time', 'taken_late', 'missed'];

/** The VEVENT text block for one UID (unfolded). */
function eventBlock(ics: string, uid: string): string {
  const unfolded = ics.replace(/\r\n /g, '');
  const start = unfolded.indexOf(`UID:${uid}\r\n`);
  expect(start).toBeGreaterThan(-1);
  const begin = unfolded.lastIndexOf('BEGIN:VEVENT', start);
  const end = unfolded.indexOf('END:VEVENT', start);
  return unfolded.slice(begin, end);
}

describe('buildIcs — RFC 5545 structure (strict parse)', () => {
  const sara = feedFor('pt-03');
  const ics = buildIcs(sara, REFERENCE_NOW);
  const cal = new ICAL.Component(ICAL.parse(ics));

  it('parses as one VCALENDAR with VERSION 2.0, the PRODID, METHOD:PUBLISH and the Kuwait VTIMEZONE', () => {
    expect(cal.name).toBe('vcalendar');
    expect(cal.getFirstPropertyValue('version')).toBe('2.0');
    expect(cal.getFirstPropertyValue('prodid')).toBe(ICS_PRODID);
    expect(cal.getFirstPropertyValue('method')).toBe('PUBLISH');
    const tz = cal.getFirstSubcomponent('vtimezone');
    expect(tz?.getFirstPropertyValue('tzid')).toBe('Asia/Kuwait');
  });

  it('one VEVENT per dose, UID = the dose id, in order', () => {
    const events = cal.getAllSubcomponents('vevent');
    expect(sara.length).toBeGreaterThan(0);
    expect(events.map((e) => e.getFirstPropertyValue('uid'))).toEqual(sara.map((d) => d.id));
  });

  it('DTSTART is the Kuwait wall-clock time with TZID=Asia/Kuwait; DTSTAMP is REFERENCE_NOW in UTC', () => {
    const events = cal.getAllSubcomponents('vevent');
    events.forEach((e, i) => {
      const prop = e.getFirstProperty('dtstart')!;
      expect(prop.getParameter('tzid')).toBe('Asia/Kuwait');
      const t = prop.getFirstValue() as ICAL.Time;
      const iso = sara[i]!.scheduledAt; // YYYY-MM-DDTHH:mm:ss+03:00
      expect(t.toString()).toBe(iso.slice(0, 19));
      expect((e.getFirstPropertyValue('dtstamp') as ICAL.Time).toString()).toBe('2026-09-21T06:15:00Z');
    });
  });

  it('SUMMARY = drug + strength in its own unit (never converted) + dose per administration', () => {
    const levo = sara.find((d) => d.prescriptionId === 'rx-008')!;
    expect(doseSummary(levo)).toBe('Levothyroxine (Eltroxin) 50 mcg × 1');
    const ev = cal.getAllSubcomponents('vevent').find((e) => e.getFirstPropertyValue('uid') === levo.id)!;
    expect(ev.getFirstPropertyValue('summary')).toBe('Levothyroxine (Eltroxin) 50 mcg × 1');
  });

  it('CRLF line endings only, and no physical line longer than 75 octets', () => {
    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
    const enc = new TextEncoder();
    for (const line of ics.split('\r\n')) expect(enc.encode(line).length).toBeLessThanOrEqual(75);
  });

  it('folding splits by octets, never inside a code point, and unfolds to the original', () => {
    const long = 'SUMMARY:' + 'جرعة دواء '.repeat(20);
    const folded = foldLine(long);
    const enc = new TextEncoder();
    for (const l of folded.split('\r\n')) expect(enc.encode(l).length).toBeLessThanOrEqual(75);
    expect(folded.replace(/\r\n /g, '')).toBe(long);
    expect(folded).not.toContain('�');
  });
});

describe('rule 3 — an untracked dose carries no status word (keyed off `tracked`)', () => {
  it('حمد (tracking off): every VEVENT has no status property and no dose-status word', () => {
    const hamad = feedFor('pt-01');
    expect(hamad.length).toBeGreaterThan(0);
    expect(hamad.every((d) => d.tracked === false)).toBe(true);
    const ics = buildIcs(hamad, REFERENCE_NOW);
    expect(ics).not.toContain('X-JURAH-DOSE-STATUS');
    for (const w of DOSE_WORDS) expect(ics).not.toContain(w);
  });

  it('the decision keys off tracked, NOT the word: an untracked dose reading taken_on_time still has none, a tracked upcoming one has it', () => {
    const [base] = feedFor('pt-03');
    const untrackedButWorded: DoseWithPrescription = { ...base!, id: 'probe-untracked', tracked: false, status: 'taken_on_time' };
    const trackedUpcoming: DoseWithPrescription = { ...base!, id: 'probe-tracked', tracked: true, status: 'upcoming' };
    const ics = buildIcs([untrackedButWorded, trackedUpcoming], REFERENCE_NOW);
    const u = eventBlock(ics, 'probe-untracked');
    for (const w of DOSE_WORDS) expect(u).not.toContain(w);
    expect(u).not.toContain('X-JURAH-DOSE-STATUS');
    expect(eventBlock(ics, 'probe-tracked')).toContain('X-JURAH-DOSE-STATUS:upcoming');
  });

  it('سارة (tracked): her recorded statuses appear only as the machine property', () => {
    const sara = feedFor('pt-03');
    const recorded = sara.find((d) => d.status === 'taken_late')!;
    expect(recorded).toBeDefined();
    const ics = buildIcs(sara, REFERENCE_NOW);
    expect(eventBlock(ics, recorded.id)).toContain('X-JURAH-DOSE-STATUS:taken_late');
    expect(new ICAL.Component(ICAL.parse(ics)).getAllSubcomponents('vevent').length).toBe(sara.length);
  });
});

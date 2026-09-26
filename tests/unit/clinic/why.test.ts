/**
 * CR-113 — `alertWhy`, the pure pick of an alert pair's why-entry. Keys are the interaction index's
 * (lowercase, sorted, "|"); combination generic names pair every ingredient; the most severe entry
 * wins; anything malformed reads as none (the screen keeps today's Source card).
 */
import { describe, expect, it } from 'vitest';
import { alertWhy, ingredientsOf, type WhyData } from '@/lib/data/shapes/why';
import type { Prescription } from '@/types/contracts';

const rx = (id: string, genericName: string) => ({ id, drug: { genericName } }) as unknown as Prescription;
const entry = (level: string, extra: Record<string, unknown> = {}) => ({
  level,
  url: 'https://ddinter.scbdd.com/ddinter/interact/1/',
  mechanism: 'Source mechanism text.',
  management: 'Source management text.',
  summary: { en: 'English draft.', ar: 'مسودة عربية.' },
  ...extra,
});
const data = (pairs: Record<string, unknown>): WhyData => ({ meta: { citation: 'DDInter 2.0 citation' }, pairs: pairs as WhyData['pairs'] });

describe('ingredientsOf', () => {
  it('splits a combination and lowercases it', () => {
    expect(ingredientsOf('Calcium carbonate + vitamin D3')).toEqual(['calcium carbonate', 'vitamin d3']);
  });
  it('maps paracetamol to the index name acetaminophen', () => {
    expect(ingredientsOf('Paracetamol')).toEqual(['acetaminophen']);
  });
});

describe('alertWhy', () => {
  it('finds the pair under its sorted key and carries the citation', () => {
    const why = alertWhy([rx('rx-001', 'Warfarin'), rx('rx-002', 'Ibuprofen')], data({ 'ibuprofen|warfarin': entry('Major') }));
    expect(why).toMatchObject({ level: 'Major', drugs: ['ibuprofen', 'warfarin'], citation: 'DDInter 2.0 citation' });
    expect(why?.summary).toEqual({ en: 'English draft.', ar: 'مسودة عربية.' });
  });

  it('pairs every ingredient of a combination and keeps the most severe entry', () => {
    const why = alertWhy(
      [rx('rx-008', 'Levothyroxine'), rx('rx-009', 'Calcium carbonate + cholecalciferol')],
      data({ 'cholecalciferol|levothyroxine': entry('Minor'), 'calcium carbonate|levothyroxine': entry('Moderate') }),
    );
    expect(why?.level).toBe('Moderate');
    expect(why?.drugs).toEqual(['calcium carbonate', 'levothyroxine']);
  });

  it('returns null when no pair matches', () => {
    expect(alertWhy([rx('a', 'Metformin'), rx('b', 'Ibuprofen')], data({ 'ibuprofen|warfarin': entry('Major') }))).toBeNull();
  });

  it('keeps the entry but drops a half-written summary', () => {
    const why = alertWhy([rx('a', 'Warfarin'), rx('b', 'Ibuprofen')], data({ 'ibuprofen|warfarin': entry('Major', { summary: { en: 'Only English.' } }) }));
    expect(why?.summary).toBeNull();
    expect(why?.mechanism).toBe('Source mechanism text.');
  });

  it('fails closed on malformed data', () => {
    const involved = [rx('a', 'Warfarin'), rx('b', 'Ibuprofen')];
    expect(alertWhy(involved, null)).toBeNull();
    expect(alertWhy(involved, {} as WhyData)).toBeNull();
    expect(alertWhy(involved, data({ 'ibuprofen|warfarin': entry('Unknown') }))).toBeNull();
    expect(alertWhy(involved, data({ 'ibuprofen|warfarin': entry('Major', { mechanism: '' }) }))).toBeNull();
    expect(alertWhy(involved, data({ 'ibuprofen|warfarin': entry('Major', { url: 'https://example.com/x' }) }))).toBeNull();
    expect(alertWhy(involved, data({ 'ibuprofen|warfarin': 'not an object' }))).toBeNull();
  });

  it('needs two different medicines', () => {
    expect(alertWhy([rx('a', 'Warfarin')], data({ 'ibuprofen|warfarin': entry('Major') }))).toBeNull();
    expect(alertWhy([rx('a', 'Warfarin'), rx('b', 'Warfarin')], data({ 'warfarin|warfarin': entry('Major') }))).toBeNull();
  });
});

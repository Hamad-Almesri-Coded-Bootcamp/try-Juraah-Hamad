/**
 * i18n/format.ts — the one strength formatter and the counted-phrase helper (audit M7). Strength:
 * the number exactly as written, in the unit the record names, digits and unit word following the
 * locale — never converted (rx-008 is 50 mcg, never 0.05; guard U). Counts: Arabic picks the noun
 * form by plural category (one · two · few 3–10 · many 11–99 · other 100+), never "٧٠ أيام".
 */
import { describe, expect, it } from 'vitest';
import { formatCount, formatDaysLeft, formatStrength, formatUnit, pluralCategory } from '@/i18n/format';
import { copy } from '@/i18n';

describe('formatStrength', () => {
  it('English keeps the Latin unit and Western digits', () => {
    expect(formatStrength(400, undefined, 'en')).toBe('400 mg');
    expect(formatStrength(50, 'mcg', 'en')).toBe('50 mcg');
  });

  it('Arabic uses Arabic-Indic digits and the Arabic unit word — never a Latin abbreviation', () => {
    expect(formatStrength(400, undefined, 'ar')).toBe('٤٠٠ ملغم');
    expect(formatStrength(50, 'mcg', 'ar')).toBe('٥٠ ميكروغرام');
    expect(formatStrength(5, 'mg', 'ar')).not.toMatch(/[A-Za-z]/);
  });

  it('never converts: rx-008 is 50 mcg in both languages, never 0.05', () => {
    expect(formatStrength(50, 'mcg', 'en')).not.toMatch(/0\.05/);
    expect(formatStrength(50, 'mcg', 'ar')).toContain('٥٠');
  });

  it('has exactly one word per unit — the shared vocabulary entry', () => {
    expect(formatUnit('mg', 'ar')).toBe(copy.vocabulary.unitMg.ar);
    expect(formatUnit(undefined, 'ar')).toBe(copy.vocabulary.unitMg.ar);
    expect(formatUnit('IU', 'en')).toBe('IU');
  });
});

describe('pluralCategory / formatCount', () => {
  it('Arabic yields all six categories', () => {
    expect([0, 1, 2, 5, 11, 70, 100].map((n) => pluralCategory(n, 'ar'))).toEqual(['zero', 'one', 'two', 'few', 'many', 'many', 'other']);
  });

  it('English yields one and other only', () => {
    expect([1, 2, 70].map((n) => pluralCategory(n, 'en'))).toEqual(['one', 'other', 'other']);
  });

  it('falls back to `other` for a category the catalogue does not spell out', () => {
    expect(formatCount(5, 'ar', { other: { ar: '{count} x', en: '{count} x' } })).toBe('٥ x');
  });
});

describe('formatDaysLeft — the refill meter caption', () => {
  it('Arabic picks the grammatical noun form and Arabic-Indic digits', () => {
    expect(formatDaysLeft(1, 'ar')).toBe('يتبقى يوم واحد من الكمية');
    expect(formatDaysLeft(2, 'ar')).toBe('يتبقى يومان من الكمية');
    expect(formatDaysLeft(5, 'ar')).toBe('يتبقى ٥ أيام من الكمية');
    expect(formatDaysLeft(11, 'ar')).toBe('يتبقى ١١ يومًا من الكمية');
    expect(formatDaysLeft(70, 'ar')).toBe('يتبقى ٧٠ يومًا من الكمية'); // حمد's Warfarin on REFERENCE_NOW
    expect(formatDaysLeft(100, 'ar')).toBe('يتبقى ١٠٠ يوم من الكمية');
    expect(formatDaysLeft(0, 'ar')).toBe('يتبقى أقل من يوم من الكمية');
  });

  it('never prints the ungrammatical "70 أيام" or a Western digit in Arabic', () => {
    expect(formatDaysLeft(70, 'ar')).not.toMatch(/أيام|[0-9]/);
  });

  it('English reads as before', () => {
    expect(formatDaysLeft(70, 'en')).toBe('70 days of supply left');
    expect(formatDaysLeft(1, 'en')).toBe('1 day of supply left');
    expect(formatDaysLeft(0, 'en')).toBe('Less than a day of supply left');
  });
});

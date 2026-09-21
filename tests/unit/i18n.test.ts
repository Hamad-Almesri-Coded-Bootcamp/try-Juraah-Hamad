import { describe, expect, it } from 'vitest';
import { directionFor, withLocale, isLocale } from '@/i18n/locale';
import { copy } from '@/i18n';

describe('locale helpers', () => {
  it('maps ar → rtl and en → ltr', () => {
    expect(directionFor('ar')).toBe('rtl');
    expect(directionFor('en')).toBe('ltr');
  });
  it('swaps only the locale segment', () => {
    expect(withLocale('/ar/app/medicines', 'en')).toBe('/en/app/medicines');
    expect(withLocale('/app', 'ar')).toBe('/ar/app');
    expect(isLocale('fr')).toBe(false);
  });
  it('every shell copy entry has both languages', () => {
    for (const entry of Object.values(copy.shell)) {
      expect(entry.ar.length).toBeGreaterThan(0);
      expect(entry.en.length).toBeGreaterThan(0);
    }
  });
});

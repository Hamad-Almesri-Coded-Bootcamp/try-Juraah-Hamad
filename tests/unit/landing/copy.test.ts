/**
 * i18n/copy/landing.ts — every entry carries both languages (mirrors tests/unit/i18n.test.ts) and
 * is marked `placeholder: true` (WP4a's standing rule: the owner's bilingual copy deck has not
 * replaced L1's wording yet — guard P counts these repository-wide; this asserts the landing
 * catalogue specifically holds none it forgot to flag).
 */
import { describe, expect, it } from 'vitest';
import { copy } from '@/i18n';

describe('i18n/copy/landing.ts', () => {
  it('every entry has non-empty ar and en text', () => {
    for (const [key, entry] of Object.entries(copy.landing)) {
      expect(entry.ar.length, key).toBeGreaterThan(0);
      expect(entry.en.length, key).toBeGreaterThan(0);
    }
  });

  it('every entry is marked placeholder: true (the bilingual deck has not landed yet)', () => {
    for (const [key, entry] of Object.entries(copy.landing)) {
      expect(entry.placeholder, key).toBe(true);
    }
  });

  it('carries no invented evidence — no "%", digit-led statistic, or superlative claim word (G11)', () => {
    const suspicious = /trusted by|award|certified|approved by|guarantee|\d+%|clinically proven/i;
    for (const [key, entry] of Object.entries(copy.landing)) {
      expect(suspicious.test(entry.en), key).toBe(false);
    }
  });
});

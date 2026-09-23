/**
 * F0 — how the consent screen reads (audit 2026-09-23, M4 and M5).
 *
 * M4: `Caregiver.relationship` is stored in the PATIENT's own first person — 'ابني' is "my son"
 * (docs/Seed Dataset.md; the seed is never rewritten). Asserting it in the reader's voice ("يقول إنك
 * ابني" — "he says you are my son") therefore reads wrong, so F0 QUOTES the patient instead.
 *
 * M5: the two lists consent hinges on must not look alike. Every "you will see" row carries the
 * `check` glyph, every "you will never be able to" row the `close` glyph — decorative, aria-hidden,
 * the words carry the meaning (UX Principles §11) — and the negative heading cannot be misread as a
 * permission (the old `وما راح تقدر:` can read as "and what you'll be able to").
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import icons from '@/design/icons.json';
import { InviteConsent } from '@/features/caregiving/InviteConsent';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import type { InvitationSummary } from '@/types/views';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

afterEach(cleanup);

const pendingInvitation: InvitationSummary = {
  id: 'cg-03',
  patientFirstName: 'حمد',
  relationship: 'ابني',
  status: 'pending',
  expiresAt: '2026-10-02T00:00:00+03:00',
};

function renderConsent(locale: Locale) {
  return render(<InviteConsent invitation={pendingInvitation} locale={locale} homeHref={`/${locale}`} />);
}

function glyphOf(row: Element): 'check' | 'close' | 'other' | null {
  const svg = row.querySelector('svg');
  if (!svg) return null;
  const d = svg.querySelector('path')?.getAttribute('d');
  if (d === icons.paths.check) return 'check';
  if (d === icons.paths.close) return 'close';
  return 'other';
}

const SEE_KEYS = ['f0CanSee1', 'f0CanSee2', 'f0CanSee3', 'f0CanSee4'] as const;
const NEVER_KEYS = ['f0Cannot1', 'f0Cannot2', 'f0Cannot3', 'f0Cannot4'] as const;

describe('F0 — the relationship is quoted, never asserted in the reader’s voice (M4)', () => {
  it('ar: صلة القرابة في الطلب: «ابني». — and no "يقول إنك ابني"', () => {
    const { baseElement } = renderConsent('ar');
    expect(screen.getByText('صلة القرابة في الطلب: «ابني».')).toBeInTheDocument();
    expect(baseElement.textContent).not.toContain('يقول إنك');
  });

  it('en: Described you as “ابني”. — and no "Says you are their"', () => {
    const { baseElement } = renderConsent('en');
    expect(screen.getByText('Described you as “ابني”.')).toBeInTheDocument();
    expect(baseElement.textContent).not.toContain('Says you are their');
  });
});

describe('F0 — "you will see" and "you will never be able to" cannot be mistaken for each other (M5)', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale}: each list is a real list named by its heading; see rows carry check, never rows carry close`, () => {
      renderConsent(locale);

      const seeList = screen.getByRole('list', { name: t(copy.caregiving.f0CanSeeTitle, locale) });
      const neverList = screen.getByRole('list', { name: t(copy.caregiving.f0CannotTitle, locale) });

      const seeRows = within(seeList).getAllByRole('listitem');
      const neverRows = within(neverList).getAllByRole('listitem');
      expect(seeRows).toHaveLength(SEE_KEYS.length);
      expect(neverRows).toHaveLength(NEVER_KEYS.length);

      SEE_KEYS.forEach((key, i) => {
        expect(seeRows[i]).toHaveTextContent(t(copy.caregiving[key], locale));
        expect(glyphOf(seeRows[i]!)).toBe('check');
      });
      NEVER_KEYS.forEach((key, i) => {
        expect(neverRows[i]).toHaveTextContent(t(copy.caregiving[key], locale));
        expect(glyphOf(neverRows[i]!)).toBe('close');
      });

      // Decorative only — the words carry the meaning.
      for (const row of [...seeRows, ...neverRows]) {
        expect(row.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
      }
    });
  }

  it('the negative heading is unambiguous in both languages', () => {
    expect(t(copy.caregiving.f0CannotTitle, 'ar')).toBe('هذي أشياء ما تقدر تسويها أبدًا:');
    expect(t(copy.caregiving.f0CannotTitle, 'en')).toBe('You will never be able to:');
  });
});

/**
 * L1 rendered (CR-071, the Daylight landing): the structure the spec and the owner's rules fix,
 * asserted on the real composition rather than on a screenshot. The e2e suite covers the same page
 * in a browser; this runs without one.
 *
 * - one h1 and eight h2 section headings, in the spec's ten sections;
 * - exactly one primary button on the page (the hero's sign-in), with sign-in reachable from the
 *   header, the hero and the closing section;
 * - one language per locale: no Latin script in Arabic, no Arabic script in English, except each
 *   language's own name on the language switch and the programme's name in the footer;
 * - no em dash on screen; the clinic route never linked or named; no image of the old screenshot.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { copy, t } from '@/i18n';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/ar',
  useSearchParams: () => new URLSearchParams(''),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

const { LandingPage } = await import('@/features/landing/LandingPage');

afterEach(() => cleanup());

const signedOut = { href: '/ar/signin', signedIn: false } as const;

for (const locale of ['ar', 'en'] as const) {
  describe(`L1 (${locale})`, () => {
    it('one h1 and eight h2 section headings', () => {
      render(<LandingPage locale={locale} cta={{ ...signedOut, href: `/${locale}/signin` }} />);
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(8);
    });

    it('exactly one primary button, and sign-in in the header, the hero and the closing section', () => {
      const { container } = render(<LandingPage locale={locale} cta={{ ...signedOut, href: `/${locale}/signin` }} />);
      expect(container.querySelectorAll('.wsf-btn--primary')).toHaveLength(1);
      const primary = container.querySelector('.wsf-btn--primary');
      expect(primary?.textContent).toBe(t(copy.landing.ctaSignIn, locale));
      // The header (its icon-only form at phone width, its labelled form from 600px; CSS shows one),
      // the hero and the closing section each carry the sign-in action.
      const name = t(copy.landing.ctaSignIn, locale);
      const header = container.querySelector('header');
      expect(within(header as HTMLElement).getAllByRole('button', { name }).length).toBeGreaterThan(0);
      const closing = screen.getByRole('heading', { level: 2, name: t(copy.landing.closingHeading, locale) }).closest('section');
      expect(within(closing as HTMLElement).getByRole('button', { name })).toBeInTheDocument();
      expect(primary?.closest('header')).toBeNull();
    });

    it('signed in: every sign-in action reads the continue copy instead', () => {
      render(<LandingPage locale={locale} cta={{ href: `/${locale}/app`, signedIn: true }} />);
      expect(screen.queryAllByRole('button', { name: t(copy.landing.ctaSignIn, locale) })).toHaveLength(0);
      // header (two forms, one shown), hero, closing
      expect(screen.getAllByRole('button', { name: t(copy.landing.ctaContinue, locale) }).length).toBeGreaterThanOrEqual(3);
    });

    it('shows only its own language, with no em dash', () => {
      const { container } = render(<LandingPage locale={locale} cta={{ ...signedOut, href: `/${locale}/signin` }} />);
      // Allowed on purpose, as tests/e2e/language-purity.spec.ts allows them: the language switch,
      // which names the other language in its own script, and the programme's name in the footer.
      const text = (container.textContent ?? '').replace(t(copy.shell.languageSwitch, locale), '').replace(/\bSACGC AI for Coding\b/g, '');
      if (locale === 'ar') expect(text).not.toMatch(/[A-Za-z]/);
      else expect(text).not.toMatch(/[؀-ۿ]/);
      expect(text).not.toMatch(/[—–]/);
      for (const el of container.querySelectorAll('[aria-label]')) {
        const label = el.getAttribute('aria-label') ?? '';
        if (locale === 'ar') expect(label).not.toMatch(/[A-Za-z]/);
        else expect(label).not.toMatch(/[؀-ۿ]/);
      }
    });

    it('never links or names the clinic route, and no longer shows the old screenshot', () => {
      const { container } = render(<LandingPage locale={locale} cta={{ ...signedOut, href: `/${locale}/signin` }} />);
      expect(container.innerHTML).not.toContain('/clinic');
      expect(container.querySelector('img[src*="today-preview"]')).toBeNull();
    });

    it('the hero picture is the day dial, described in words for assistive technology', () => {
      const { container } = render(<LandingPage locale={locale} cta={{ ...signedOut, href: `/${locale}/signin` }} />);
      expect(container.querySelectorAll('.jr-dial').length).toBeGreaterThan(0);
      const picture = container.querySelector('[role="img"]');
      expect(picture?.getAttribute('aria-label')?.length ?? 0).toBeGreaterThan(20);
      // Tracking is off in the seed state it draws, so no dot carries a status colour (rule 3).
      expect(container.querySelectorAll('.jr-dial__dose--taken_on_time, .jr-dial__dose--taken_late, .jr-dial__dose--missed')).toHaveLength(0);
    });
  });
}

/**
 * The caregiver shell's app bars (audit 2026-09-23, C7 and M10).
 *
 * C7: F2 Today (`/[locale]/care`) and F2 Medicines (`/[locale]/care/medicines`) rendered no AppBar —
 * no title, no h1, no language switch — against UX Principles §1 ("every screen carries a title in
 * the app bar") and §12 (the language switch reachable on every screen). They now carry one exactly
 * as F3 does: the caregiver tab's own label as the h1, the LanguageSwitch in the action slot.
 *
 * M10: F3's prescription detail was titled with the PATIENT's tab label, "أدويتي / My Medicines". A
 * caregiver's view is titled with the caregiver tab's label, "الأدوية / Medicines".
 *
 * The page files are rendered for real (their `requireRole` gate runs against the script session);
 * only their async screen bodies are stubbed, because a client-side `render` cannot await an async
 * server component nested inside the page's tree. Those bodies have their own tests.
 *
 * Daylight (CR-071): F2 Today is the patient's Today composition, so its h1 lives in the sky that
 * `CaregiverToday` draws (a `<header>`), with the bar's actions the page hands it. That case renders
 * the page (for the wiring) and the real screen body (for the header), awaited separately.
 *
 * The app bar now also carries the assistant (CR-069(k)): a `<button data-assistant-trigger>` that
 * only opens the assistant's panel. It is the one button allowed; any other is a failure (rule 8).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { copy, t } from '@/i18n';
import type { Locale } from '@/i18n/locale';
import { reset } from '@/lib/data/mock/store';
import { setScriptSession } from '@/lib/session/cookie';

const nav = vi.hoisted(() => ({ pathname: '/en/care' }));
vi.mock('next/navigation', () => ({
  usePathname: () => nav.pathname,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  notFound: () => {
    throw new Error('notFound()');
  },
  redirect: (to: string) => {
    throw new Error(`redirect(${to})`);
  },
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock('@/features/caregiving/CaregiverToday', () => ({
  CaregiverToday: ({ actions }: { actions?: React.ReactNode }) => <div data-testid="f2-today-body">{actions}</div>,
}));
vi.mock('@/features/caregiving/CaregiverMedicines', () => ({ CaregiverMedicines: () => <div data-testid="f2-medicines-body" /> }));
vi.mock('@/features/caregiving/CaregiverPrescriptionDetail', () => ({
  CaregiverPrescriptionDetail: () => <div data-testid="f3-rx-body" />,
}));

const { default: CaregiverTodayPage } = await import('@/app/[locale]/care/page');
const { default: CaregiverMedicinesPage } = await import('@/app/[locale]/care/medicines/page');
const { default: CaregiverPrescriptionDetailPage } = await import('@/app/[locale]/care/medicines/[prescriptionId]/page');
const { CaregiverToday: RealCaregiverToday } = await vi.importActual<typeof import('@/features/caregiving/CaregiverToday')>(
  '@/features/caregiving/CaregiverToday',
);
const { LanguageSwitch } = await import('@/features/shell/LanguageSwitch');

/** Every button except the app bar's assistant trigger: must be none (rule 8, no write control). */
function nonAssistantButtons(root: ParentNode) {
  return root.querySelectorAll('button:not([data-assistant-trigger])');
}

beforeEach(() => {
  reset();
  setScriptSession({ subjectId: 'cg-01', role: 'caregiver', linkedPatientId: 'pt-01' });
});
afterEach(() => {
  cleanup();
  setScriptSession(null);
});

function expectAppBar(title: string, locale: Locale) {
  const heading = screen.getByRole('heading', { level: 1 });
  expect(heading).toHaveTextContent(title);
  expect(heading.closest('header')).not.toBeNull();
  const header = heading.closest('header')!;
  // The language switch sits in the same app bar, as a link to the other locale.
  const other = locale === 'ar' ? 'en' : 'ar';
  const switchLink = screen.getByRole('link', { name: t(copy.shell.languageSwitchLabel, locale) });
  expect(header.contains(switchLink)).toBe(true);
  expect(switchLink.getAttribute('href')).toMatch(new RegExp(`^/${other}/care`));
}

describe('F2 Today — a header with the caregiver tab title and the language switch (C7)', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale}: h1 is the caregiver "Today" tab label; no button is added to the screen`, async () => {
      nav.pathname = `/${locale}/care`;
      // The page: gated, it renders the screen body and hands it the bar's actions.
      const page = render(await CaregiverTodayPage({ params: Promise.resolve({ locale }), searchParams: Promise.resolve({}) }));
      const body = screen.getByTestId('f2-today-body');
      expect(body.querySelector('a.jr-bar-pill')?.getAttribute('href')).toMatch(new RegExp(`^/${locale === 'ar' ? 'en' : 'ar'}/care`));
      page.unmount();

      // The screen body with those actions: one h1 in the sky's header, the switch beside it.
      const actions = <LanguageSwitch locale={locale} role="caregiver" subjectId="cg-01" />;
      const { container } = render(await RealCaregiverToday({ caregiverId: 'cg-01', locale, actions }));
      expectAppBar(t(copy.shell.careTabToday, locale), locale);
      expect(container.querySelectorAll('h1')).toHaveLength(1);
      // Zero write controls (rule 8): the header adds links and the assistant trigger, nothing else.
      expect(container.querySelectorAll('button[data-assistant-trigger]')).toHaveLength(1);
      expect(nonAssistantButtons(container)).toHaveLength(0);
    }, 20_000); // the first render transforms the whole Today tree; slow under a parallel run
  }
});

describe('F2 Medicines — an app bar with the caregiver tab title and the language switch (C7)', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale}: h1 is the caregiver "Medicines" tab label`, async () => {
      nav.pathname = `/${locale}/care/medicines`;
      const { container } = render(await CaregiverMedicinesPage({ params: Promise.resolve({ locale }) }));
      expectAppBar(t(copy.shell.careTabMedicines, locale), locale);
      expect(screen.getByTestId('f2-medicines-body')).toBeInTheDocument();
      expect(nonAssistantButtons(container)).toHaveLength(0);
    });
  }
});

describe('F3 prescription detail — titled for the caregiver, never "My Medicines" (M10)', () => {
  for (const locale of ['ar', 'en'] as const) {
    it(`${locale}: h1 is the caregiver "Medicines" tab label, not the patient's`, async () => {
      nav.pathname = `/${locale}/care/medicines/rx-001`;
      render(await CaregiverPrescriptionDetailPage({ params: Promise.resolve({ locale, prescriptionId: 'rx-001' }) }));
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toHaveTextContent(t(copy.shell.careTabMedicines, locale));
      expect(heading).not.toHaveTextContent(t(copy.shell.tabMedicines, locale));
    });
  }
});

/**
 * Gate 3 shell checks (WP3 ACCEPTANCE, from PLAN): each shell at 390/834/1440 × ar/en — a bottom tab
 * bar at 390, a side rail at 834, content capped near 880px at 1440 (`--content-max`), the caregiver
 * banner on every caregiver route, the simulated banner on every clinic route, no horizontal
 * overflow, axe clean. Runs under the three viewport projects `playwright.config.ts` already
 * defines; each test reads its own `page.viewportSize()` to apply the right breakpoint assertion,
 * so one file covers all three sizes rather than hard-coding a project name.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';

const LOCALES = [
  ['ar', 'rtl'],
  ['en', 'ltr'],
] as const;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

const SHELLS = [
  { name: 'patient', who: 'hamad', path: '/app' },
  { name: 'caregiver', who: 'abdullah', path: '/care' },
  { name: 'clinic (reviewer)', who: 'khalid_reviewer', path: '/clinic/review' },
] as const satisfies ReadonlyArray<{ name: string; who: keyof typeof TEST_SESSIONS; path: string }>;

for (const [locale, dir] of LOCALES) {
  for (const shell of SHELLS) {
    test(`${shell.name} shell (${locale}) — breakpoint chrome, no overflow, axe clean`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, shell.who);
      await page.goto(`/${locale}${shell.path}`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);

      const width = page.viewportSize()?.width ?? 390;
      const nav = page.getByRole('navigation', { name: /التنقل الرئيسي|Main navigation/ });
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      const viewportHeight = page.viewportSize()?.height ?? 844;

      if (width < 834) {
        // Bottom bar: its top edge sits in the lower part of the viewport.
        expect(box && box.y).toBeGreaterThan(viewportHeight * 0.6);
      } else {
        // Side rail: a column, taller than it is wide.
        expect(box && box.height).toBeGreaterThan(box?.width ?? 0);
      }

      if (width >= 1440) {
        const capped = await page.evaluate(() => {
          const el = document.querySelector('[class*="max-w-content"]');
          return el ? el.getBoundingClientRect().width : null;
        });
        expect(capped, 'desktop content cap (~880px, --content-max)').not.toBeNull();
        expect(capped as number).toBeLessThanOrEqual(900);
      }

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);

      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
}

const CAREGIVER_ROUTES = ['/care', '/care/medicines', '/care/more', '/care/more/activity', '/care/more/profile', '/care/more/help'];

test.describe('the caregiver banner is present on every caregiver route', () => {
  for (const route of CAREGIVER_ROUTES) {
    test(`banner on ${route}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'abdullah');
      await page.goto(`/ar${route}`);
      await expect(page.getByText('حمد', { exact: false }).first()).toBeVisible();
    });
  }
});

const CLINIC_ROUTES = [
  { who: 'khalid_reviewer', route: '/clinic/review' },
  { who: 'khalid_admin', route: '/clinic/audit' },
] as const satisfies ReadonlyArray<{ who: keyof typeof TEST_SESSIONS; route: string }>;

test.describe('the simulated-role banner is present on every clinic route', () => {
  for (const { who, route } of CLINIC_ROUTES) {
    test(`simulated banner on ${route}`, async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, who);
      await page.goto(`/ar${route}`);
      // ClinicNav renders the banner twice (once per breakpoint's own layout, CSS-toggled) — select
      // the one CSS currently shows, the same technique roles.spec.ts uses for the sign-out button.
      await expect(page.locator('p:visible', { hasText: 'دور تجريبي' }).first()).toBeVisible();
    });
  }
});

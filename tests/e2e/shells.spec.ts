/**
 * Gate 3 shell checks (WP3 ACCEPTANCE, from PLAN): each shell at 390/834/1440 × ar/en — a bottom tab
 * bar at 390, a side rail at 834, content capped near 880px at 1440 (`--content-max`; the clinic's
 * column is 1.5× that, D-011), the caregiver
 * banner on every caregiver route, the simulated banner on every clinic route, no horizontal
 * overflow, axe clean. Runs under the three viewport projects `playwright.config.ts` already
 * defines; each test reads its own `page.viewportSize()` to apply the right breakpoint assertion,
 * so one file covers all three sizes rather than hard-coding a project name.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy } from '@/i18n';

const LOCALES = [
  ['ar', 'rtl'],
  ['en', 'ltr'],
] as const;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

const READING_CAP = 900; // ~880px, --content-max, with a little tolerance
const CLINIC_CAP = 1340; // 1.5 × the reading cap (--spacing-content-wide, D-011)

const SHELLS = [
  { name: 'patient', who: 'hamad', path: '/app', cap: READING_CAP },
  { name: 'caregiver', who: 'abdullah', path: '/care', cap: READING_CAP },
  { name: 'clinic (reviewer)', who: 'khalid_reviewer', path: '/clinic/review', cap: CLINIC_CAP },
] as const satisfies ReadonlyArray<{ name: string; who: keyof typeof TEST_SESSIONS; path: string; cap: number }>;

/** The width of the shell's capped content column — the first `max-w-content*` wrapper in DOM order. */
async function cappedWidth(page: Page) {
  return page.evaluate(() => {
    const el = document.querySelector('[class*="max-w-content"]');
    return el ? el.getBoundingClientRect().width : null;
  });
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

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
        const capped = await cappedWidth(page);
        expect(capped, 'desktop content cap (--content-max, or the clinic\'s wider column)').not.toBeNull();
        expect(capped as number).toBeLessThanOrEqual(shell.cap);
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
      await expect(page.locator('p:visible', { hasText: 'دور محاكاة' }).first()).toBeVisible();
    });
  }
});

// ---------------------------------------------------------------------------
// The responsive pass (DECISIONS D-009 … D-013). These set their own viewport rather than adding a
// fourth Playwright project: `identity.spec.ts` keys its Civil IDs by project name and several
// store-mutating tests are gated to `desktop-1440`, so a new project would break them.
// ---------------------------------------------------------------------------
test.describe('D-009 — 1280 renders the wide boards: rail present, content capped', () => {
  for (const shell of SHELLS) {
    test(`${shell.name} at 1280`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width: 1280, height: 900 });
      await addSession(context, baseURL, shell.who);
      await page.goto(`/ar${shell.path}`);
      const nav = page.getByRole('navigation', { name: /التنقل الرئيسي|Main navigation/ });
      await expect(nav).toBeVisible();
      const box = await nav.boundingBox();
      expect(box && box.height).toBeGreaterThan(box?.width ?? 0);
      const capped = await cappedWidth(page);
      expect(capped).not.toBeNull();
      expect(capped as number).toBeLessThanOrEqual(shell.cap);
      await noHorizontalOverflow(page);
    });
  }

  test('B2 at 1280: two cards side by side (MedicinesDesktop.dc.html); at 390 one column', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/ar/app/medicines');
    const cards = page.locator('.wsf-card');
    const [a, b] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
    expect(a && b && Math.abs(a.y - b.y) < 2, 'first two active cards share a row').toBeTruthy();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/ar/app/medicines');
    const [c, d] = await Promise.all([cards.nth(0).boundingBox(), cards.nth(1).boundingBox()]);
    expect(c && d && d.y > c.y + c.height - 1, 'stacked at phone width').toBeTruthy();
  });

  // G2s's wide layout is asserted in clinic.spec.ts, before that file's store-mutating commit test
  // empties the queue for the rest of the run.
  test('X1 at 1280: the table layout, filters in one row (AuditLog1440.dc.html)', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_admin');
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/ar/clinic/audit');
    await expect(page.locator('table:visible')).toHaveCount(1);
    const selects = page.locator('select');
    const [s1, s2, s3] = await Promise.all([selects.nth(0).boundingBox(), selects.nth(1).boundingBox(), selects.nth(2).boundingBox()]);
    expect(s1 && s2 && s3 && Math.abs(s1.y - s2.y) < 2 && Math.abs(s2.y - s3.y) < 2, 'three filters on one row').toBeTruthy();
  });

});

test.describe('D-010 — a pushed patient screen keeps the rail from 834, and has no bar below it', () => {
  for (const width of [390, 834, 1440]) {
    test(`B3 at ${width}`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width, height: width < 834 ? 844 : 900 });
      await addSession(context, baseURL, 'hamad');
      await page.goto('/ar/app/medicines/rx-001');
      const nav = page.getByRole('navigation', { name: /التنقل الرئيسي|Main navigation/ });
      if (width < 834) {
        await expect(nav).toHaveCount(0);
      } else {
        await expect(nav).toBeVisible();
        // The rail marks the tab the screen was pushed from.
        await expect(nav.locator('[aria-current="page"]')).toHaveText(/أدويتي|My Medicines/);
        const capped = await cappedWidth(page);
        expect(capped as number).toBeLessThanOrEqual(READING_CAP);
      }
      await noHorizontalOverflow(page);
    });
  }
});

test.describe('D-012 — one rail column: the clinic sign-out sits inside the rail from 834', () => {
  for (const width of [834, 1440]) {
    test(`clinic rail at ${width}`, async ({ page, context, baseURL }) => {
      await page.setViewportSize({ width, height: 900 });
      await addSession(context, baseURL, 'khalid_reviewer');
      await page.goto('/ar/clinic/review');
      const nav = page.getByRole('navigation', { name: /التنقل الرئيسي|Main navigation/ });
      const signOut = page.getByRole('button', { name: /تسجيل الخروج|Sign out/ }).locator('visible=true').first();
      const [n, s] = await Promise.all([nav.boundingBox(), signOut.boundingBox()]);
      expect(n && s).toBeTruthy();
      // Same column: the sign-out's horizontal extent lies within the rail's.
      expect(s!.x).toBeGreaterThanOrEqual(n!.x - 1);
      expect(s!.x + s!.width).toBeLessThanOrEqual(n!.x + n!.width + 1);
      // Below the tabs, at the bottom of the rail.
      expect(s!.y).toBeGreaterThan(n!.y + n!.height - 1);
    });
  }
});

test('D-013 — an unknown URL renders H1 in the locale layout, never Next\'s default page', async ({ page }) => {
  await page.goto('/ar/this-route-does-not-exist');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.getByText(copy.shell.notFoundTitle.ar)).toBeVisible();
  await expect(page.getByText('This page could not be found')).toHaveCount(0);
  // No session: the one way back is the landing page.
  await expect(page.getByRole('button', { name: copy.shell.backHome.ar })).toBeVisible();
});

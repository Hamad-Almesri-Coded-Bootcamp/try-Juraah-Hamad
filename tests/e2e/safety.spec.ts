/**
 * WP4 bundle e — C1 (Safety alerts list) and C2 (Interaction alert detail), every state named in
 * `docs/Acceptance Criteria and Test Plan.md` / `docs/SCREENS.md`'s C1/C2 rows, at 390/834/1440 ×
 * ar/en (the three Playwright projects give the viewport axis; this file walks locale × scenario —
 * see `tests/e2e/day.spec.ts` for the same convention).
 *
 * Each real seed patient carries exactly one alert (`docs/Seed Dataset.md`: ia-001 → حمد, ia-002 →
 * سارة, ia-003 → فاطمة), so C1's "most severe first" ordering across several alerts at once is
 * exercised at the component level (tests/unit/safety/SafetyList.test.tsx), matching CR-014's own
 * precedent for B2's unreachable-from-one-patient "multiple alerts" state.
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

async function noOverflowAndAxeClean(page: import('@playwright/test').Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
}

for (const [locale, dir] of LOCALES) {
  test.describe(`C1 — Safety alerts list (${locale})`, () => {
    test('has alerts: the one danger, pending row (حمد → ia-001)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      const rows = page.locator('.jr-alert-row');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toHaveClass(/jr-alert-row--danger/);
      await noOverflowAndAxeClean(page);
    });

    test('reviewed/auto_cleared history renders too, visually quieter but present (سارة → ia-002)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/safety`);
      const rows = page.locator('.jr-alert-row');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toHaveClass(/jr-alert-row--warning/);
      await expect(page.getByText(/تحقق منه مراجع طبي|Checked by a medical reviewer/)).toBeVisible();
    });

    test('an auto_cleared finding is present, never alarming (فاطمة → ia-003)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/safety`);
      const rows = page.locator('.jr-alert-row');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toHaveClass(/jr-alert-row--info/);
    });

    test('none → a reassuring EmptyState, not alarming (بدر has no alerts)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app/safety`);
      await expect(page.locator('.jr-alert-row')).toHaveCount(0);
      await expect(page.getByText(/ما فيه تنبيهات سلامة|No safety alerts right now/)).toBeVisible();
      await expect(page.getByRole('button', { name: /فحص دواء بالصورة|Check a drug by photo/ })).toBeVisible();
    });

    test('the C3 entry is present even with an alert showing', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety`);
      await expect(page.getByRole('button', { name: /فحص دواء بالصورة|Check a drug by photo/ })).toBeVisible();
    });

    test('a row opens the alert detail and nothing else', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety`);
      const row = page.locator('.jr-alert-row').first();
      const href = await row.getAttribute('href');
      expect(href).toBe(`/${locale}/app/safety/ia-001`);
      await row.click();
      await expect(page).toHaveURL(href!);
    });

    test('loading state', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety?view=loading`);
      await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    });

    test('error state, with a retry', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety?view=error`);
      await expect(page.locator('.wsf-state--error')).toBeVisible();
      await page.getByRole('button', { name: /إعادة المحاولة|Try again/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety$`));
    });

    test('failed-refresh (LastKnown) — never an empty screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
      await expect(page.locator('.jr-alert-row')).toHaveCount(1);
    });
  });

  test.describe(`C2 — Interaction alert detail (${locale})`, () => {
    test('pending_medical_review, danger (ia-001): the three-part shape, no OK/dismiss control', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.locator('.wsf-alert--danger')).toBeVisible();
      await expect(page.getByText(/شنو تسوي الآن|What to do right now/)).toBeVisible();
      await expect(page.getByText(/لا يزال مراجع طبي يتحقق|medical reviewer is still checking/)).toBeVisible();
      // No dismiss/OK/resolve control anywhere on the screen (G1 — reading changes nothing).
      const suspectButtons = page.getByRole('button', { name: /تم$|فهمت|OK|Dismiss|Resolve|Acknowledge/i });
      await expect(suspectButtons).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('citation honesty: an unresolved sourceCitation renders the explicit unverified line, never invented text (ia-001)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.getByText(/ما توفر مصدر طبي مؤكد|No verified medical source is available/)).toBeVisible();
      await expect(page.getByText('[TO BE SUPPLIED]')).toHaveCount(0);
    });

    test('reviewed (ia-002): the decision, the reviewer note, and who — never a raw id', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/safety/ia-002`);
      await expect(page.getByText(/الخطر مؤكد|Risk confirmed/)).toBeVisible();
      await expect(page.getByText(/تُؤخذ اللِفوثيروكسين على معدة فارغة|Take on an empty stomach/)).toBeVisible();
      await expect(page.getByText('acc-10')).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('auto_cleared (ia-003): says what that means', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/safety/ia-003`);
      await expect(page.getByText(/انفحص تلقائياً|Screened automatically/)).toBeVisible();
    });

    test('involved prescriptions render read-only and link to their detail', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.locator('.wsf-rx').filter({ hasText: 'Warfarin' })).toBeVisible();
      await expect(page.locator('.wsf-rx').filter({ hasText: 'Ibuprofen' })).toBeVisible();
      await page.locator('.wsf-rx').first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines/rx-`));
    });

    test('opening the alert twice never changes its state', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.getByText(/لا يزال مراجع طبي يتحقق|medical reviewer is still checking/)).toBeVisible();
      await page.reload();
      await expect(page.locator('.wsf-alert--danger')).toBeVisible();
      await expect(page.getByText(/لا يزال مراجع طبي يتحقق|medical reviewer is still checking/)).toBeVisible();
    });

    test('back returns to the safety list, with no tab bar on the pushed detail', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.getByRole('navigation', { name: /التنقل الرئيسي|Main navigation/ })).toHaveCount(0);
      await page.getByRole('link', { name: /رجوع للسلامة|Back to Safety/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety$`));
    });

    test('loading state', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001?view=loading`);
      await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    });

    test('error state, with a retry', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001?view=error`);
      await expect(page.locator('.wsf-state--error')).toBeVisible();
      await page.getByRole('button', { name: /إعادة المحاولة|Try again/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety/ia-001$`));
    });

    test('failed-refresh (LastKnown) — never an empty screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
      await expect(page.locator('.wsf-alert--danger')).toBeVisible();
    });
  });
}

/**
 * WP4 bundle c — B1 (Dose Schedule "Today") and B2 (My Medicines), every state named in
 * `docs/Acceptance Criteria and Test Plan.md` / `docs/SCREENS.md`'s B1/B2 rows, at 390/834/1440 ×
 * ar/en (the three Playwright projects give the viewport axis; this file walks locale × scenario).
 * `TodayLTR.dc.html`'s claim — chevrons mirror, capsules/clocks/numerals never do — is exercised by
 * running every scenario in both `ar`/rtl and `en`/ltr, not by a separate LTR-only test.
 *
 * Tracked/missed/late states render from سارة (per CR-014: several boards carry these states on
 * حمد's cast, but the seed only has them on سارة — the seed wins). The empty day is فاطمة's.
 * The "multiple alerts" state (B2) has no seed patient with two simultaneous alerts — inventing a
 * second one for a real patient would be an invented seed value (CLAUDE.md, never); it is exercised
 * instead in `tests/unit/day/MedicinesList.test.tsx`, logged in `docs/backend-notes/wp4c.md` §7.
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
  test.describe(`B1 — Today (${locale})`, () => {
    test('tracking off (حمد, the default): six rows, no pills, one plain line to turn tracking on', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);

      const list = page.getByTestId('dose-list');
      await expect(list.getByTestId('dose-row')).toHaveCount(6);
      await expect(list.getByTestId('status-pill')).toHaveCount(0);
      await expect(page.getByText(/شغّلها|Turn it on/)).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('a tracked day with mixed statuses, including a missed dose (سارة, 19 Sept)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app?day=2026-09-19`);
      const pill = page.getByTestId('status-pill').filter({ hasText: /فائتة|Missed/ });
      await expect(pill).toBeVisible();
    });

    test('a tracked day with an on-time and a late dose (سارة, 20 Sept)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app?day=2026-09-20`);
      await expect(page.getByTestId('status-pill').filter({ hasText: /أُخذت في وقتها|Taken on time/ }).first()).toBeVisible();
      await expect(page.getByTestId('status-pill').filter({ hasText: /أُخذت متأخرة|Taken late/ })).toBeVisible();
    });

    test('an empty day (فاطمة, 21 Sept — her alternate-day cadence skips it)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app`);
      await expect(page.getByTestId('dose-list').getByTestId('dose-row')).toHaveCount(0);
      await expect(page.getByText(/ما فيه جرعات مجدولة|No doses scheduled/)).toBeVisible();
    });

    test('a patient with no active prescription at all yet gets a distinct empty message (بدر)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app`);
      await expect(page.getByTestId('dose-list').getByTestId('dose-row')).toHaveCount(0);
      await expect(page.getByText(/ما عندك وصفات نشطة بعد|No active prescriptions yet/)).toBeVisible();
    });

    test('a future day one tap forward shows the duration boundary (rx-002 ends 25 Sept)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app?day=2026-09-26`);
      const list = page.getByTestId('dose-list');
      await expect(list.getByTestId('dose-row')).toHaveCount(3); // Metformin×2, Warfarin×1 — Ibuprofen (rx-002) has ended
      await expect(list.getByText('Ibuprofen')).toHaveCount(0);
    });

    test('day navigation both ways, and an always-available return to today', async ({ page, context, baseURL }) => {
      // Generous timeouts here: "Next day"/"Previous day" are real <a> links (a full document
      // navigation and re-hydration), and "Return to today" is a client-side router.push clicked
      // right after — under a loaded shared dev server (several bundles' e2e suites hitting the
      // same `next dev` process, docs/briefs/WP4c.md) hydration can lag past the default 5s.
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app`);
      await page.getByRole('link', { name: /اليوم التالي|Next day/ }).click();
      await expect(page).toHaveURL(/day=2026-09-22/, { timeout: 15000 });
      // "Return to today" is a client-side `router.push` button: a click that lands before the new
      // document has hydrated is dropped (React replays nothing outside a Suspense boundary), and
      // `toHaveURL` above resolves the moment the URL changes — long before hydration. Wait for the
      // network to settle (client chunks loaded) so the click reaches a live handler. This raced
      // before the responsive pass too: it failed identically against the untouched HEAD tree on a
      // freshly started dev server (docs/VERIFICATION.md, "Responsive pass — results").
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: /ارجع لليوم|Return to today/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app$`), { timeout: 15000 });
      await page.getByRole('link', { name: /اليوم السابق|Previous day/ }).click();
      await expect(page).toHaveURL(/day=2026-09-20/, { timeout: 15000 });
    });

    test('a pending caregiver invitation addressed to this user — a quiet line, never a modal (سارة ← فاطمة)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app`);
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      const link = page.getByRole('button', { name: /مراجعة الطلب|Review the request/ });
      // فاطمة's invitation to سارة (cg-08) is a `pending` row in the shared, mutable mock store
      // (D-002: "mutations survive for the life of the dev server process"). A longer timeout here
      // guards against the same shared-dev-server contention noted above; it does not paper over a
      // stale `cg-08` — if another suite has genuinely mutated it, this still fails, correctly.
      await expect(link).toBeVisible({ timeout: 15000 });
      await link.click();
      await expect(page).toHaveURL(/\/invitation\?id=/);
    });

    test('row tap opens the prescription detail and nothing else', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app`);
      const firstRow = page.getByTestId('dose-list').getByTestId('dose-row').first();
      const href = await firstRow.getAttribute('href');
      expect(href).toMatch(new RegExp(`^/${locale}/app/medicines/rx-`));
      await firstRow.click();
      await expect(page).toHaveURL(href!);
    });

    test('loading state', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app?view=loading`);
      await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    });

    test('error state, with a retry', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app?view=error`);
      // `.wsf-state--error`, not the bare `role="alert"` — Next's own route announcer also carries
      // that role (`#__next-route-announcer__`), which makes a plain role query ambiguous.
      await expect(page.locator('.wsf-state--error')).toBeVisible();
      await page.getByRole('button', { name: /إعادة المحاولة|Try again/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app$`));
    });

    test('failed-refresh (LastKnown) — never an empty screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
      await expect(page.getByTestId('dose-list').getByTestId('dose-row')).toHaveCount(6);
    });
  });

  test.describe(`B2 — My Medicines (${locale})`, () => {
    test('normal: the danger alert on top, most prominent, tracking-off cards with no pill (حمد)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      await expect(page.locator('.wsf-alert--danger')).toBeVisible();
      await expect(page.getByTestId('status-pill')).toHaveCount(0);
      await expect(page.locator('.wsf-rx')).toHaveCount(3); // rx-001, rx-002, rx-003 — three active
      await noOverflowAndAxeClean(page);
    });

    test('past grouping: completed/discontinued, reason and date, no refill action (حمد → rx-004)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      await expect(page.getByText(/آلام العضلات|muscle pain/)).toBeVisible();
      await expect(page.getByRole('button', { name: /تجديد|refill/i })).toHaveCount(0);
    });

    test('empty state offers add/scan (بدر has no prescriptions at all)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app/medicines`);
      await expect(page.getByRole('button', { name: /أضف وصفة بالصورة|Add a prescription by photo/ })).toBeVisible();
    });

    test('card tap opens the prescription detail', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      await page.locator('.wsf-rx').first().click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines/rx-`));
    });

    test('loading state', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines?view=loading`);
      await expect(page.locator('[aria-busy="true"]').first()).toBeVisible();
    });

    test('error state, with a retry', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines?view=error`);
      await expect(page.locator('.wsf-state--error')).toBeVisible();
      await page.getByRole('button', { name: /إعادة المحاولة|Try again/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`));
    });
  });
}

test.describe('B1 at 834 (two-pane-capable layout, per Today834.dc.html)', () => {
  test('day heading and rows still render correctly, no overflow', async ({ page, context, baseURL }) => {
    test.skip(page.viewportSize()?.width !== 834, '834-only assertion');
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app');
    await expect(page.getByTestId('dose-list').getByTestId('dose-row')).toHaveCount(6);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('B2 at 834 (two-pane), the alert stays full width', () => {
  test('the InteractionAlert spans the same width as the cards below it', async ({ page, context, baseURL }) => {
    test.skip(page.viewportSize()?.width !== 834, '834-only assertion');
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/medicines');
    const alertBox = await page.locator('.wsf-alert--danger').boundingBox();
    const cardBox = await page.locator('.wsf-rx').first().boundingBox();
    expect(alertBox?.width).toBeCloseTo(cardBox?.width ?? 0, 0);
  });
});

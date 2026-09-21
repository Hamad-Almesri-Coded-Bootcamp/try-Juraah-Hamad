/**
 * WP4 bundle d — B3 (prescription detail) and B4 (add/scan prescription), every state named in
 * `docs/Acceptance Criteria and Test Plan.md` / `docs/SCREENS.md`'s B3/B4 rows, at 390/834/1440 ×
 * ar/en (the three Playwright projects give the viewport axis; this file walks locale × scenario, the
 * same shape `tests/e2e/day.spec.ts` — bundle c — already uses).
 *
 * Run as `npx playwright test tests/e2e/prescription.spec.ts --workers=1` (the brief's own
 * instruction) so the viewport projects never race each other against the shared dev-server store
 * (D-002: the mock store is a module-level singleton that survives for the life of the process).
 * B4's confirming tests each create one real `Prescription` row for حمد (pt-01) in that shared store,
 * so every assertion about the medicines list compares counts *before* and *after* a run rather than
 * an absolute number — safe under a re-run or a stray parallel worker, exactly like
 * `tests/e2e/caregiving.spec.ts`'s own idempotency note.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';

const LOCALES = [
  ['ar', 'rtl'],
  ['en', 'ltr'],
] as const;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

async function noOverflowAndAxeClean(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
}

async function choosePhoto(page: Page, bytes: number) {
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({ name: 'prescription.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(bytes) });
}

for (const [locale, dir] of LOCALES) {
  test.describe(`B3 — Prescription detail (${locale})`, () => {
    test('every contract field including dispensing, a depletion meter, and a tracking-off dose history (rx-001, حمد)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      // .first(): the drug name appears in the header and again in the generic-name DetailRow.
      await expect(page.getByText('Warfarin').first()).toBeVisible();
      await expect(page.getByRole('progressbar')).toBeVisible(); // rx-001 is dispensed
      await expect(page.getByTestId('status-pill')).toHaveCount(0); // حمد is untracked
      await expect(page.getByText(/ما نتابع التزامك|not tracking your doses/)).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('rx-006 (فاطمة, core-fields-only, needsReview) renders no "undefined"/missing-value artifact', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/medicines/rx-006`);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/undefined/i);
      await expect(page.getByText(/تنتظر تأكيد المراجع|waiting on a medical reviewer/)).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('rx-008 (سارة, Levothyroxine) shows "50 mcg" exactly as seeded, no conversion', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/medicines/rx-008`);
      // The value renders in the locale's numerals and unit word (ar: '٥٠ ميكروغرام'), in the
      // header and again in the strength DetailRow — .first() for the duplicate; and never a
      // converted 0.05 in either numeral system.
      await expect(page.getByText(locale === 'ar' ? '٥٠ ميكروغرام' : '50 mcg').first()).toBeVisible();
      await expect(page.getByText(/0\.05|٠٫٠٥|٠\.٠٥/)).toHaveCount(0);
    });

    test('a no-dispensing prescription (rx-005, فاطمة) shows no depletion estimate', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/medicines/rx-005`);
      await expect(page.getByRole('progressbar')).toHaveCount(0);
      await expect(page.getByText(/أيام باقية|days of supply left/)).toHaveCount(0);
    });

    test('the dose-history timeline carries pills for a tracked patient (سارة, rx-008)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/medicines/rx-008`);
      await expect(page.getByTestId('status-pill').first()).toBeVisible();
    });

    test('a discontinued prescription (rx-004, حمد) shows the reason and date, and no refill action', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-004`);
      await expect(page.getByText(/موقوفة|Discontinued/)).toBeVisible();
      await expect(page.getByRole('button', { name: /اطلب تجديد الوصفة|Request a refill/ })).toHaveCount(0);
    });

    test('the refill Button links to D1 with this rx in context', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001`);
      await page.getByRole('button', { name: /اطلب تجديد الوصفة|Request a refill/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/more/refill\\?rx=rx-001`));
    });

    test('back via AppBar returns to My Medicines', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001`);
      await page.getByRole('link', { name: /رجوع|Back/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`));
    });

    test('a prescription id that does not exist (or is not this session\'s) shows the empty state with a way back, never a blank screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-does-not-exist`);
      await expect(page.getByText(/ما لقينا هذي الوصفة|We could not find this prescription/)).toBeVisible();
      await expect(page.getByRole('button', { name: /رجوع لأدويتي|Back to My Medicines/ })).toBeVisible();
    });

    test('G7 — loading state (dev-only ?view= flag)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001?view=loading`);
      await expect(page.getByRole('status')).toBeVisible();
    });

    test('G7 — error state (dev-only ?view= flag), with retry', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001?view=error`);
      // .first(): Next.js's own route announcer also carries role="alert" (id="__next-route-announcer__").
      await expect(page.getByRole('alert').first()).toBeVisible();
      // The retry label is shell.retry: ar 'إعادة المحاولة' / en 'Try again'.
      await expect(page.getByRole('button', { name: /إعادة المحاولة|Try again/ })).toBeVisible();
    });
  });

  test.describe(`B4 — Add / scan prescription (${locale})`, () => {
    test('idle state: PhotoInput and the prescriber-owned-fields note', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/add`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      // .first(): the AR note sentence also contains the words 'صورة الوصفة'.
      await expect(page.getByText(/صورة الوصفة|Prescription photo/).first()).toBeVisible();
      await expect(page.getByText(/ما تُكتب باليد|never typed by hand/)).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('confident outcome: read-only review-and-confirm, confirming saves the record and returns to My Medicines with it listed', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      const before = await page.locator('.wsf-rx').count();

      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 150);
      await expect(page.getByText(/راجع قبل الحفظ|Review before saving/)).toBeVisible();
      await expect(page.getByText('Ibuprofen')).toBeVisible();
      // Read-only confirmation only — never a text field for a clinical value.
      await expect(page.locator('input[type="text"], textarea')).toHaveCount(0);
      await noOverflowAndAxeClean(page);

      await page.getByRole('button', { name: /تأكيد وحفظ|Confirm and save/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`), { timeout: 15000 });
      await expect(page.locator('.wsf-rx')).toHaveCount(before + 1, { timeout: 15000 });
    });

    test('needs_review outcome: uncertain fields visibly marked, same confirm path', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 50);
      await expect(page.getByText(/بعض الحقول تحتاج تأكيد|Some fields need confirmation/)).toBeVisible();
      await expect(page.getByText(/غير واضح|Unclear/).first()).toBeVisible();
      await expect(page.getByRole('button', { name: /تأكيد وحفظ|Confirm and save/ })).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('unreadable outcome: explicit could-not-read state, retry and a way back, and the medicines list is unchanged', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      const before = await page.locator('.wsf-rx').count();

      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 0);
      // .first(): Next.js's own route announcer also carries role="alert".
      await expect(page.getByRole('alert').first()).toBeVisible();
      await expect(page.getByText(/ما قدرنا نقرأ هذي الصورة|We could not read this photo/)).toBeVisible();
      await expect(page.getByRole('button', { name: /حاول بصورة ثانية|Try another photo/ })).toBeVisible();
      await expect(page.getByRole('button', { name: /رجوع لأدويتي|Back to My Medicines/ })).toBeVisible();
      await noOverflowAndAxeClean(page);

      await page.goto(`/${locale}/app/medicines`);
      await expect(page.locator('.wsf-rx')).toHaveCount(before);
    });

    test('back via AppBar returns to My Medicines', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/add`);
      await page.getByRole('link', { name: /رجوع|Back/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`));
    });
  });
}

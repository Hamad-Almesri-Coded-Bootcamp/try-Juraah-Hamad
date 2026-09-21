/**
 * WP4 bundle f — C3 (travel / photo drug check) and D1 (refill request), every state named in
 * `docs/Acceptance Criteria and Test Plan.md` / `docs/SCREENS.md`'s C3/D1 rows, at 390/834/1440 ×
 * ar/en (the three Playwright projects give the viewport axis; this file walks locale × scenario,
 * the same shape `tests/e2e/prescription.spec.ts` — bundle d — already uses).
 *
 * Run as `npx playwright test tests/e2e/supply.spec.ts --workers=1` (the brief's own instruction) so
 * the viewport projects never race each other against the shared dev-server store (D-002).
 *
 * `checkDrugPhoto` (C3) never writes anything, in every branch — every C3 test here is safe to run
 * on all three projects. `requestRefill` (D1) does mutate the shared store, so the one test that
 * actually submits a fresh request is guarded to a single project (`test.skip`, mirroring
 * `tests/e2e/identity.spec.ts`'s own `completeOnboarding` guard) and asserts a before/after delta
 * rather than an absolute count, exactly like `tests/e2e/prescription.spec.ts`'s B4 tests.
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
  await input.setInputFiles({ name: 'packet.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(bytes) });
}

for (const [locale, dir] of LOCALES) {
  test.describe(`C3 — Travel / photo drug check (${locale})`, () => {
    test('idle state: PhotoInput and a way back to Safety', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/check`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.getByText(/صورة العلبة|Photo of the packet/)).toBeVisible();
      await expect(page.getByRole('link', { name: /رجوع للسلامة|Back to Safety/ })).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('identified with an interaction (حمد, Warfarin): screened against the profile, hands off to C2, never re-implements it', async ({
      page,
      context,
      baseURL,
    }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/check`);
      await choosePhoto(page, 200);

      // .first(): "Warfarin" names the DetailRow value and the InteractionAlert's own title.
      await expect(page.getByText('Warfarin').first()).toBeVisible();
      await expect(page.getByText(/تعارض خطير|Serious interaction/)).toBeVisible();
      // Nothing here fabricates a citation, a reviewer note or a decision — that is C2's job alone.
      await expect(page.getByText(/مؤكد|مراجع|Reviewed by|Risk confirmed/)).toHaveCount(0);
      await noOverflowAndAxeClean(page);

      await page.getByRole('button', { name: /افتح تفاصيل التعارض|Open interaction details/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety/ia-001$`));
    });

    test('identified, no interaction (سارة, Levothyroxine): reassures, no InteractionAlert', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/safety/check`);
      await choosePhoto(page, 200);

      await expect(page.getByText(/ما فيه تعارض|No interaction found/)).toBeVisible();
      await expect(page.getByRole('region')).toHaveCount(0); // InteractionAlert's own role
    });

    test('could-not-identify (0-byte photo): an explicit honest state, retry and a way back', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/check`);
      await choosePhoto(page, 0);

      // .first(): Next.js's own route announcer also carries role="alert".
      await expect(page.getByRole('alert').first()).toBeVisible();
      await expect(page.getByText(/ما قدرنا نتعرف على هذا الدواء|We could not identify this medication/)).toBeVisible();
      await expect(page.getByRole('button', { name: /حاول بصورة ثانية|Try another photo/ })).toBeVisible();
      await expect(page.getByRole('link', { name: /رجوع للسلامة|Back to Safety/ })).toBeVisible();
      await noOverflowAndAxeClean(page);

      await page.getByRole('button', { name: /حاول بصورة ثانية|Try another photo/ }).click();
      await expect(page.getByText(/صورة العلبة|Photo of the packet/)).toBeVisible();
    });
  });

  test.describe(`D1 — Refill request (${locale})`, () => {
    test('حمد: the seeded pending request (rx-003) renders as requested from first load; rx-001/rx-002 still offer one', async ({
      page,
      context,
      baseURL,
    }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);

      await expect(page.getByRole('button', { name: /طلب تجديد|Request a refill/ })).toHaveCount(2);
      await expect(page.getByText(/تم طلب التجديد|Refill requested/)).toBeVisible();
      await expect(page.getByText(/الصيدلية الحكومية|public pharmacy/).first()).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('my requests: both seeded RefillRequest rows, by status', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill`);
      const list = page.getByTestId('refill-requests');
      await expect(list.getByText(/قيد الموافقة|Pending approval/)).toBeVisible();
      await expect(list.getByText(/تمت الموافقة|Approved/)).toBeVisible();
    });

    test('no dispensing data (سارة, rx-009) means no depletion estimate — never a fabricated number', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/refill`);
      await expect(page.getByRole('progressbar')).toHaveCount(1); // only rx-008 is dispensed
    });

    test('the confirm Sheet names the destination for a public rx (rx-008) and a private rx (rx-009)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/refill`);

      const buttons = page.getByRole('button', { name: /طلب تجديد|Request a refill/ });
      await expect(buttons).toHaveCount(2);

      await buttons.first().click();
      await expect(page.getByText(/الصيدلية الحكومية|the public pharmacy/)).toBeVisible();
      await noOverflowAndAxeClean(page);
      await page.getByRole('button', { name: /إلغاء|Cancel/ }).click();

      await buttons.nth(1).click();
      await expect(page.getByText(/صيدلية القطاع الخاص|the private pharmacy/)).toBeVisible();
      await page.getByRole('button', { name: /إلغاء|Cancel/ }).click();
    });

    test('?rx= from B3 highlights that line', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill?rx=rx-002`);
      await expect(page.locator('.bg-navy-tint').getByText('Ibuprofen')).toBeVisible();
    });

    test('G7 — empty state: a patient with no active prescriptions (بدر)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app/more/refill`);
      await expect(page.getByText(/ما فيه وصفات نشطة للتجديد|No active prescriptions to refill/)).toBeVisible();
      await expect(page.getByRole('button', { name: /طلب تجديد|Request a refill/ })).toHaveCount(0);
    });

    test('G7 — loading state (dev-only ?view= flag)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill?view=loading`);
      await expect(page.getByRole('status')).toBeVisible();
    });

    test('G7 — error state (dev-only ?view= flag), with retry', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill?view=error`);
      // .first(): Next.js's own route announcer also carries role="alert".
      await expect(page.getByRole('alert').first()).toBeVisible();
      await expect(page.getByRole('button', { name: /إعادة المحاولة|Try again/ })).toBeVisible();
    });

    test('back via AppBar returns to More', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill`);
      await page.getByRole('link', { name: /رجوع|Back/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/more$`));
    });

    test('requesting a refill: the line switches to "requested" + destination, and My requests gains the row (desktop-1440 only — mutates the shared store)', async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      // Runs once only, in the last locale pass of the last project (desktop-1440/en) — the whole
      // file shares one dev-server store (D-002); guarding by project alone still let this fire
      // once per locale (ar, then en), and the ar-locale run's mutation of rx-002 then broke the
      // en-locale pristine-state assertions declared earlier in this same describe block.
      test.skip(
        testInfo.project.name !== 'desktop-1440' || locale !== 'en',
        'runs once only — requestRefill is irreversible against the shared mock store (D-002), and every project/locale pass reuses the same dev server',
      );
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill`);

      const requestsBefore = await page.getByTestId('refill-requests').locator('.jr-menu-row').count();

      // rx-002 (Ibuprofen, private) carries no prior request — the one line safe to mutate here.
      const ibuprofenCard = page.getByTestId('refill-line').filter({ hasText: 'Ibuprofen' });
      await ibuprofenCard.getByRole('button', { name: /طلب تجديد|Request a refill/ }).click();
      await expect(page.getByText(/تأكيد طلب التجديد|Confirm the refill request/)).toBeVisible();
      await expect(page.getByText(/صيدلية القطاع الخاص|the private pharmacy/)).toBeVisible();

      await page.getByRole('button', { name: /إرسال الطلب|Send the request/ }).click();
      await expect(page.getByText(/تأكيد طلب التجديد|Confirm the refill request/)).toHaveCount(0);
      await expect(ibuprofenCard.getByRole('button', { name: /طلب تجديد|Request a refill/ })).toHaveCount(0);
      await expect(ibuprofenCard.getByText(/تم طلب التجديد|Refill requested/)).toBeVisible();

      await expect(page.getByTestId('refill-requests').locator('.jr-menu-row')).toHaveCount(requestsBefore + 1);
    });
  });
}

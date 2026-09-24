/**
 * WP4 bundle d — B3 (prescription detail) and B4 (add/scan prescription), every state named in
 * `docs/Acceptance Criteria and Test Plan.md` / `docs/SCREENS.md`'s B3/B4 rows, at 390/834/1440 ×
 * ar/en (the three Playwright projects give the viewport axis; this file walks locale × scenario, the
 * same shape `tests/e2e/day.spec.ts` — bundle c — already uses).
 *
 * Run as `npx playwright test tests/e2e/prescription.spec.ts --workers=1` (the brief's own
 * instruction) so the viewport projects never race each other against the shared dev-server store
 * (D-002: the mock store is a module-level singleton that survives for the life of the process).
 * B4's confirming test creates one real `Prescription` row for حمد (pt-01) in that shared store, so
 * it runs once only (desktop-1440/en, the last pass) and every assertion about the medicines list
 * compares counts *before* and *after* rather than an absolute number — safe under a re-run or a
 * stray parallel worker, exactly like `tests/e2e/caregiving.spec.ts`'s own idempotency note.
 */
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy, t } from '@/i18n';
import { localizeDrugName } from '@/i18n/localize';

// Every run shares one `next dev` process with the other spec files (and, on the owner's machine,
// other worktrees' servers): a first visit compiles its route, and a photo read, an axe pass and a
// second navigation can together outlast the 30s default. The per-assertion timeouts are unchanged.
test.describe.configure({ timeout: 90_000 });

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

/**
 * Resolves once React has hydrated this element (it then carries React's `__reactProps$…` key, the
 * same key `g1-today-tracking-off.spec.ts` reads). A click or a file chosen before that lands on
 * server HTML with no handler and is silently dropped; under a loaded dev server hydration can lag
 * well past the default timeout. Waiting here never weakens what is asserted after it.
 */
async function hydrated(locator: Locator): Promise<Locator> {
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps$'))), { timeout: 20000 })
    .toBe(true);
  return locator;
}

async function choosePhoto(page: Page, bytes: number) {
  const input = await hydrated(page.locator('input[type="file"]').first());
  await input.setInputFiles({ name: 'prescription.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(bytes) });
}

for (const [locale, dir] of LOCALES) {
  test.describe(`B3 — Prescription detail (${locale})`, () => {
    test('every contract field including dispensing, a depletion meter, and a tracking-off dose history (rx-001, حمد)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      // .first(): the drug name (in the reader's language, CR-071) appears under the header and again
      // in the generic-name detail cell. Brand first, then the generic (CR-069(l)).
      await expect(page.getByRole('heading', { level: 2, name: new RegExp(`^${localizeDrugName('Marevan', locale)}`) })).toBeVisible();
      await expect(page.getByText(localizeDrugName('Warfarin', locale)).first()).toBeVisible();
      await expect(page.getByRole('progressbar')).toBeVisible(); // rx-001 is dispensed: the supply ring
      await expect(page.getByTestId('status-pill')).toHaveCount(0); // حمد is untracked
      await expect(page.getByText(t(copy.prescription.doseHistoryTrackingOffNote, locale), { exact: true })).toBeVisible();
      // Every contract field is named: the dispensing block's fields hold values, and the fields with
      // no value are named once in the one closing "not recorded" line — none dropped.
      for (const label of [copy.prescription.rxUnitsPerPackageLabel, copy.prescription.rxTotalDispensedLabel, copy.prescription.rxDispenseDateLabel]) {
        await expect(page.getByText(t(label, locale), { exact: true })).toBeVisible();
      }
      const notRecordedPrefix = t(copy.prescription.b3NotRecordedTemplate, locale).split('{fields}')[0]!;
      const notRecorded = page.getByText(notRecordedPrefix);
      await expect(notRecorded).toHaveCount(1);
      await expect(notRecorded).toContainText(t(copy.prescription.rxPrescriberLabel, locale));
      await noOverflowAndAxeClean(page);
    });

    test('rx-006 (فاطمة, core-fields-only, needsReview) renders no "undefined"/missing-value artifact', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/medicines/rx-006`);
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/undefined/i);
      await expect(page.getByText(t(copy.prescription.rxNeedsReviewNote, locale), { exact: true })).toBeVisible();
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
      // …and says so in plain words instead (never an invented number): proves the supply card rendered.
      await expect(page.getByText(t(copy.supply.supplyNoEstimate, locale), { exact: true })).toBeVisible();
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
      await expect(page.getByRole('button', { name: t(copy.prescription.refillButtonLabel, locale) })).toHaveCount(0);
    });

    test('the refill Button links to D1 with this rx in context', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001`);
      await (await hydrated(page.getByRole('button', { name: t(copy.prescription.refillButtonLabel, locale), exact: true }))).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/more/refill\\?rx=rx-001`), { timeout: 15000 });
    });

    test('back via AppBar returns to My Medicines', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-001`);
      await page.getByRole('link', { name: /رجوع|Back/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`), { timeout: 15000 });
    });

    test('a prescription id that does not exist (or is not this session\'s) shows the empty state with a way back, never a blank screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/rx-does-not-exist`);
      await expect(page.getByText(t(copy.prescription.b3EmptyTitle, locale), { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t(copy.prescription.b3EmptyAction, locale), exact: true })).toBeVisible();
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
      await expect(page.locator('input[type="file"]').first()).toBeAttached(); // PhotoInput's real file input
      await expect(page.getByText(t(copy.prescription.b4PhotoLabel, locale), { exact: true }).first()).toBeVisible();
      // CR-071: the note now says the details are read from the photo for the patient and a medical
      // reviewer checks anything unclear — still no field is ever typed by hand (no text input at all).
      await expect(page.getByText(t(copy.prescription.b4PrescriberFieldsNote, locale), { exact: true })).toBeVisible();
      await expect(page.locator('input[type="text"], textarea')).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('confident outcome: read-only review-and-confirm, and nothing is saved before the confirm', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      const before = await page.locator('.wsf-rx').count();

      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 150);
      await expect(page.getByText(t(copy.prescription.b4ReviewHeading, locale), { exact: true })).toBeVisible({ timeout: 20000 });
      // The generic name, in the reader's language (CR-071), in its own detail cell.
      await expect(page.getByText(localizeDrugName('Ibuprofen', locale), { exact: true })).toBeVisible();
      // Read-only confirmation only — never a text field for a clinical value.
      await expect(page.locator('input[type="text"], textarea')).toHaveCount(0);
      await expect(page.getByRole('button', { name: t(copy.prescription.b4ConfirmButton, locale), exact: true })).toBeVisible();
      await noOverflowAndAxeClean(page);

      // Reading the photo wrote nothing: the draft becomes a prescription only on the confirm.
      await page.goto(`/${locale}/app/medicines`);
      await expect(page.locator('.wsf-rx')).toHaveCount(before);
    });

    test('confirming saves the record and returns to My Medicines with it listed (desktop-1440/en only — mutates the shared store)', async ({
      page,
      context,
      baseURL,
    }, testInfo) => {
      // Runs once only, in the last locale pass of the last project, like supply.spec.ts's refill
      // request: every run shares one in-memory store, and each save adds a daily Brufen course for
      // حمد starting today (three more rows on B1, one more card on B2). Run on every project, the
      // first project's saves broke the later projects' seed-exact B1/B2 counts in day.spec.ts (six
      // rows, three cards) and g1-today-tracking-off.spec.ts. The read-only review above still runs
      // everywhere; only the one irreversible write is confined.
      test.skip(
        testInfo.project.name !== 'desktop-1440' || locale !== 'en',
        'runs once only — savePrescriptionDraft is irreversible against the shared mock store (D-002)',
      );
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      const before = await page.locator('.wsf-rx').count();

      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 150);
      await expect(page.getByText(t(copy.prescription.b4ReviewHeading, locale), { exact: true })).toBeVisible({ timeout: 20000 });
      await (await hydrated(page.getByRole('button', { name: t(copy.prescription.b4ConfirmButton, locale), exact: true }))).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`), { timeout: 15000 });
      await expect(page.locator('.wsf-rx')).toHaveCount(before + 1, { timeout: 15000 });
    });

    test('needs_review outcome: uncertain fields visibly marked, same confirm path', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 50);
      await expect(page.getByText(t(copy.prescription.b4NeedsReviewNoticeTitle, locale), { exact: true })).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(t(copy.prescription.unclearFieldLabel, locale), { exact: true }).first()).toBeVisible();
      await expect(page.locator('input[type="text"], textarea')).toHaveCount(0);
      await expect(page.getByRole('button', { name: t(copy.prescription.b4ConfirmButton, locale), exact: true })).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('unreadable outcome: explicit could-not-read state, retry and a way back, and the medicines list is unchanged', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines`);
      const before = await page.locator('.wsf-rx').count();

      await page.goto(`/${locale}/app/medicines/add`);
      await choosePhoto(page, 0);
      await expect(page.getByText(t(copy.prescription.b4UnreadableTitle, locale), { exact: true })).toBeVisible({ timeout: 20000 });
      // .first(): Next.js's own route announcer also carries role="alert".
      await expect(page.getByRole('alert').first()).toBeVisible();
      await expect(page.getByRole('button', { name: t(copy.prescription.b4RetryLabel, locale), exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t(copy.prescription.b4BackToMedicinesLabel, locale), exact: true })).toBeVisible();
      await noOverflowAndAxeClean(page);

      await page.goto(`/${locale}/app/medicines`);
      await expect(page.locator('.wsf-rx')).toHaveCount(before);
    });

    test('back via AppBar returns to My Medicines', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/medicines/add`);
      await page.getByRole('link', { name: /رجوع|Back/ }).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines$`), { timeout: 15000 });
    });
  });
}

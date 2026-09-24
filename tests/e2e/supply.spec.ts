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
import { test, expect, type BrowserContext, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy, t } from '@/i18n';
import { localizeDrugName, localizeFacility } from '@/i18n/localize';

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
  await input.setInputFiles({ name: 'packet.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(bytes) });
}

for (const [locale, dir] of LOCALES) {
  test.describe(`C3 — Travel / photo drug check (${locale})`, () => {
    test('idle state: PhotoInput and a way back to Safety', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/check`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.getByText(t(copy.supply.c3PhotoLabel, locale), { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('link', { name: t(copy.safety.c1BackLabel, locale), exact: true })).toBeVisible();
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

      // .first(): the drug name (in the reader's language, CR-071) names the result card and the
      // InteractionAlert's own title.
      await expect(page.getByText(localizeDrugName('Warfarin', locale), { exact: true }).first()).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(t(copy.vocabulary.severityDanger, locale), { exact: true })).toBeVisible();
      // CR-071 (as built): the summary now says who is checking the finding — the linked alert's own
      // review state in the fixed vocabulary (ia-001 is pending). What stays C2's alone is never
      // fabricated here: no citation, no reviewer, no reviewer's note, no decision.
      await expect(page.getByText(t(copy.vocabulary.pending_medical_review, locale), { exact: true })).toBeVisible();
      for (const c2Only of [
        copy.safety.c2ReviewHeading,
        copy.safety.c2DecisionLabel,
        copy.safety.c2DecisionConfirmed,
        copy.safety.c2DecisionCleared,
        copy.safety.c2ReviewerLabel,
        copy.safety.c2NoteLabel,
        copy.safety.c2SourceHeading,
        copy.safety.c2SourceUnverified,
      ]) {
        await expect(page.getByText(t(c2Only, locale), { exact: true })).toHaveCount(0);
      }
      await expect(page.getByText('[TO BE SUPPLIED]')).toHaveCount(0);
      await noOverflowAndAxeClean(page);

      await (await hydrated(page.getByRole('button', { name: t(copy.supply.c3OpenInteractionButton, locale), exact: true }))).click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety/ia-001$`), { timeout: 15000 });
    });

    test('identified, no interaction (سارة, Levothyroxine): reassures, no InteractionAlert', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/safety/check`);
      await choosePhoto(page, 200);

      await expect(page.getByText(t(copy.supply.c3NoInteractionTitle, locale), { exact: true })).toBeVisible({ timeout: 20000 });
      await expect(page.getByText(localizeDrugName('Levothyroxine', locale), { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('region')).toHaveCount(0); // InteractionAlert's own role
      await expect(page.locator('.wsf-alert')).toHaveCount(0); // …and its class, named or not
    });

    test('could-not-identify (0-byte photo): an explicit honest state, retry and a way back', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/check`);
      await choosePhoto(page, 0);

      await expect(page.getByText(t(copy.supply.c3CouldNotIdentifyTitle, locale), { exact: true })).toBeVisible({ timeout: 20000 });
      // .first(): Next.js's own route announcer also carries role="alert".
      await expect(page.getByRole('alert').first()).toBeVisible();
      const retry = page.getByRole('button', { name: t(copy.supply.c3CouldNotIdentifyRetryLabel, locale), exact: true });
      await expect(retry).toBeVisible();
      // Two ways back to Safety: the AppBar's back link and the quiet button under the error.
      await expect(page.getByRole('link', { name: t(copy.safety.c1BackLabel, locale), exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t(copy.safety.c1BackLabel, locale), exact: true })).toBeVisible();
      await noOverflowAndAxeClean(page);

      await (await hydrated(retry)).click();
      await expect(page.getByText(t(copy.supply.c3PhotoLabel, locale), { exact: true }).first()).toBeVisible();
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

      // Each seeded line by its own card (brand + facility), so the check holds even after
      // prescription.spec.ts's one B4 save (desktop-1440/en) has added a facility-less Brufen line for
      // حمد earlier in the same run. Seed: rx-001 Marevan and rx-002 Brufen (Al-Nukhba) offer a
      // request; rx-003 Glucophage carries the seeded pending one (public, so the public pharmacy).
      const requestButton = { name: t(copy.supply.d1RequestButtonLabel, locale), exact: true } as const;
      const lines = page.getByTestId('refill-line');
      const marevan = lines.filter({ hasText: localizeDrugName('Marevan', locale) });
      const brufen = lines.filter({ hasText: localizeDrugName('Brufen', locale) }).filter({ hasText: localizeFacility('عيادة النخبة الطبية', locale) });
      const glucophage = lines.filter({ hasText: localizeDrugName('Glucophage', locale) });
      await expect(marevan.getByRole('button', requestButton)).toHaveCount(1);
      await expect(brufen.getByRole('button', requestButton)).toHaveCount(1);
      await expect(glucophage.getByText(t(copy.supply.d1AlreadyRequestedTitle, locale), { exact: true })).toBeVisible();
      await expect(glucophage.getByText(t(copy.supply.d1DestinationPublic, locale))).toBeVisible();
      await expect(glucophage.getByRole('button', requestButton)).toHaveCount(0);
      // Only the one requested line lacks the action: every other active line still offers it.
      await expect(page.getByRole('button', requestButton)).toHaveCount((await lines.count()) - 1);
      await noOverflowAndAxeClean(page);
    });

    test('my requests: both seeded RefillRequest rows, by status', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill`);
      const list = page.getByTestId('refill-requests');
      await expect(list.getByText(t(copy.supply.d1StatusRequested, locale), { exact: true })).toBeVisible();
      await expect(list.getByText(t(copy.supply.d1StatusApproved, locale), { exact: true })).toBeVisible();
    });

    test('no dispensing data (سارة, rx-009) means no depletion estimate — never a fabricated number', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/refill`);
      await expect(page.getByRole('progressbar')).toHaveCount(1); // only rx-008 is dispensed
    });

    test('the confirm Sheet names the destination for a public rx (rx-008) and a private rx (rx-009)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/refill`);

      const buttons = page.getByRole('button', { name: t(copy.supply.d1RequestButtonLabel, locale), exact: true });
      await expect(buttons).toHaveCount(2);

      await (await hydrated(buttons.first())).click();
      await expect(page.getByText(t(copy.supply.d1DestinationPublic, locale), { exact: true })).toBeVisible();
      await noOverflowAndAxeClean(page);
      await page.getByRole('button', { name: t(copy.supply.d1ConfirmCancelButton, locale), exact: true }).click();

      await buttons.nth(1).click();
      await expect(page.getByText(t(copy.supply.d1DestinationPrivate, locale), { exact: true })).toBeVisible();
      await page.getByRole('button', { name: t(copy.supply.d1ConfirmCancelButton, locale), exact: true }).click();
    });

    test('?rx= from B3 highlights that line', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill?rx=rx-002`);
      // CR-071: the highlight is a navy ring around that line's card (was a navy-tint fill). Exactly
      // one line carries it, and it is rx-002's (Brufen · Ibuprofen, in the reader's language).
      const highlighted = page.locator('.ring-navy').getByTestId('refill-line');
      await expect(highlighted).toHaveCount(1);
      await expect(highlighted.getByText(localizeDrugName('Ibuprofen', locale), { exact: true })).toBeVisible();
    });

    test('G7 — empty state: a patient with no active prescriptions (بدر)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app/more/refill`);
      await expect(page.getByText(t(copy.supply.d1EmptyTitle, locale), { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: t(copy.supply.d1RequestButtonLabel, locale) })).toHaveCount(0);
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
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/more$`), { timeout: 15000 });
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

      // rx-002 (Ibuprofen, private) carries no prior request — the one line safe to mutate here. Found
      // by its facility too: prescription.spec.ts's one B4 save adds a second, facility-less Brufen line.
      const ibuprofenCard = page
        .getByTestId('refill-line')
        .filter({ hasText: localizeDrugName('Ibuprofen', locale) })
        .filter({ hasText: localizeFacility('عيادة النخبة الطبية', locale) });
      const requestButton = { name: t(copy.supply.d1RequestButtonLabel, locale), exact: true } as const;
      const sheetTitle = page.getByText(t(copy.supply.d1ConfirmSheetTitle, locale), { exact: true });
      await (await hydrated(ibuprofenCard.getByRole('button', requestButton))).click();
      await expect(sheetTitle).toBeVisible();
      await expect(page.getByText(t(copy.supply.d1DestinationPrivate, locale), { exact: true })).toBeVisible();

      await page.getByRole('button', { name: t(copy.supply.d1ConfirmSendButton, locale), exact: true }).click();
      await expect(sheetTitle).toHaveCount(0, { timeout: 15000 });
      await expect(ibuprofenCard.getByRole('button', requestButton)).toHaveCount(0, { timeout: 15000 });
      await expect(ibuprofenCard.getByText(t(copy.supply.d1AlreadyRequestedTitle, locale), { exact: true })).toBeVisible();

      await expect(page.getByTestId('refill-requests').locator('.jr-menu-row')).toHaveCount(requestsBefore + 1);
    });
  });
}

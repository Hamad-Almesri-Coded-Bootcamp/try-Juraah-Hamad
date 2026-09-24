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
 *
 * Daylight (CR-071): C1 leads with a navy summary card, then the findings that need attention, the
 * photo-check tile (a link to C3) and the past results. C2 is a severity band (`alert-band`), the
 * involved prescriptions side by side (`alert-bridge`, each card a link to B3), the numbered steps in
 * UX §8's order (`alert-steps`), the reviewer's decision and the source. Expected wording is read
 * from the copy catalogue and the seed, never re-typed here, so a copy edit does not break the check.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy } from '@/i18n';
import { formatNumber } from '@/i18n/format';
import { localizeDrugName, localizeText } from '@/i18n/localize';
import { buildAlerts } from '@/lib/data/mock/seed';

const LOCALES = [
  ['ar', 'rtl'],
  ['en', 'ltr'],
] as const;

const SEED_IA_002 = buildAlerts().find((a) => a.id === 'ia-002')!;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

/**
 * Every link and button here navigates client-side (next/link, router.push). A click that lands
 * before React has hydrated the element is dropped or deferred: a probe against this build measured
 * 3–15s from an immediate click to the URL change on the dev server, ~1s once hydrated. So wait until
 * React owns the element (its props are attached to the node), then click, then allow the round trip.
 * `networkidle` (day.spec.ts's pattern) was tried first and never settled here: route prefetches that
 * each trigger a dev compile keep the network busy.
 */
const NAV = { timeout: 20_000 } as const;
async function clickWhenLive(locator: import('@playwright/test').Locator) {
  test.info().setTimeout(test.info().timeout + 30_000);
  await expect(locator).toBeVisible();
  await expect
    .poll(() => locator.evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps$'))), {
      message: 'the element is hydrated',
      timeout: 30_000,
    })
    .toBe(true);
  await locator.click();
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
      // Daylight: the navy summary leads, and the pending danger finding sits under "needs attention".
      const summary = page.getByTestId('safety-summary');
      await expect(summary).toBeVisible();
      await expect(summary).toContainText(copy.safety.c1SummaryTitle[locale]);
      await expect(page.getByTestId('safety-attention-count')).toContainText(formatNumber(1, locale));
      await expect(page.getByTestId('safety-attention').locator('.jr-alert-row')).toHaveCount(1);
      await noOverflowAndAxeClean(page);
    });

    test('reviewed/auto_cleared history renders too, visually quieter but present (سارة → ia-002)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/safety`);
      const rows = page.locator('.jr-alert-row');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toHaveClass(/jr-alert-row--warning/);
      // A reviewed warning is a past result, never a "needs attention" item.
      await expect(page.getByTestId('safety-past').locator('.jr-alert-row')).toHaveCount(1);
      await expect(page.getByTestId('safety-attention')).toHaveCount(0);
      await expect(page.getByTestId('safety-attention-count')).toContainText(copy.safety.c1AttentionNone[locale]);
      await expect(page.getByText(copy.vocabulary.reviewed[locale])).toBeVisible();
    });

    test('an auto_cleared finding is present, never alarming (فاطمة → ia-003)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/safety`);
      const rows = page.locator('.jr-alert-row');
      await expect(rows).toHaveCount(1);
      await expect(rows.first()).toHaveClass(/jr-alert-row--info/);
      await expect(page.getByTestId('safety-past').locator('.jr-alert-row')).toHaveCount(1);
      await expect(page.getByTestId('safety-attention')).toHaveCount(0);
    });

    test('none → a reassuring EmptyState, not alarming (بدر has no alerts)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app/safety`);
      await expect(page.locator('.jr-alert-row')).toHaveCount(0);
      await expect(page.getByText(copy.safety.c1EmptyTitle[locale])).toBeVisible();
      // Daylight: the photo check is an action tile (a link to C3), present on the empty screen too.
      const check = page.locator('#main-content').getByRole('link', { name: copy.safety.c1CheckDrugAction[locale] });
      await expect(check).toBeVisible();
      await expect(check).toHaveAttribute('href', `/${locale}/app/safety/check`);
    });

    test('the C3 entry is present even with an alert showing', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety`);
      await expect(page.locator('.jr-alert-row')).toHaveCount(1);
      const check = page.locator('#main-content').getByRole('link', { name: copy.safety.c1CheckDrugAction[locale] });
      await expect(check).toBeVisible();
      await expect(check).toHaveAttribute('href', `/${locale}/app/safety/check`);
    });

    test('a row opens the alert detail and nothing else', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety`);
      const row = page.locator('.jr-alert-row').first();
      const href = await row.getAttribute('href');
      expect(href).toBe(`/${locale}/app/safety/ia-001`);
      await clickWhenLive(row);
      await expect(page).toHaveURL(href!, NAV);
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
      await clickWhenLive(page.getByRole('button', { name: copy.shell.retry[locale] }));
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety$`), NAV);
    });

    test('failed-refresh (LastKnown) — never an empty screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety?view=offline`);
      await expect(page.getByText(copy.vocabulary.asOf[locale])).toBeVisible();
      await expect(page.locator('.jr-alert-row')).toHaveCount(1);
    });
  });

  test.describe(`C2 — Interaction alert detail (${locale})`, () => {
    test('pending_medical_review, danger (ia-001): the three-part shape, no OK/dismiss control', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.locator('[data-testid="alert-band"][data-severity="danger"]')).toBeVisible();
      // UX Principles §8: the risk, what to do right now, who is checking it — in that order.
      const steps = page.getByTestId('alert-steps').locator('li[data-step]');
      await expect(steps).toHaveCount(3);
      expect(await steps.evaluateAll((els) => els.map((el) => el.getAttribute('data-step')))).toEqual(['risk', 'what-to-do', 'who']);
      const whatToDo = page.locator('[data-step="what-to-do"]');
      await expect(whatToDo).toContainText(copy.safety.c2WhatToDoHeading[locale]);
      await expect(whatToDo).toContainText(copy.safety.c2WhatToDoPendingBody[locale]);
      await expect(page.locator('[data-step="who"]')).toContainText(copy.vocabulary.pending_medical_review[locale]);
      // No dismiss/OK/resolve control anywhere on the screen (G1 — reading changes nothing).
      const suspectButtons = page.getByRole('button', { name: /تم$|فهمت|إخفاء|OK|Dismiss|Resolve|Acknowledge/i });
      await expect(suspectButtons).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('citation honesty: an unresolved sourceCitation renders the explicit unverified line, never invented text (ia-001)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      await expect(page.getByText(copy.safety.c2SourceUnverified[locale])).toBeVisible();
      await expect(page.getByText('[TO BE SUPPLIED]')).toHaveCount(0);
    });

    test('reviewed (ia-002): the decision, the reviewer note, and who — never a raw id', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/safety/ia-002`);
      const decision = page.getByTestId('alert-decision');
      await expect(decision).toContainText(copy.safety.c2DecisionConfirmed[locale]);
      await expect(decision).toContainText(localizeText(SEED_IA_002.reviewerNote!, locale));
      await expect(decision).toContainText(copy.safety.c2ReviewerValue[locale]);
      // A decided finding says no "what to do right now" (it is not pending).
      await expect(page.locator('[data-step="what-to-do"]')).toHaveCount(0);
      await expect(page.getByText('acc-10')).toHaveCount(0);
      // Never a Civil ID (rule 6): no twelve-digit run anywhere on the screen.
      expect(await page.locator('body').innerText()).not.toMatch(/\d{12}/);
      await noOverflowAndAxeClean(page);
    });

    test('auto_cleared (ia-003): says what that means', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/safety/ia-003`);
      await expect(page.locator('[data-testid="alert-band"][data-severity="info"]')).toBeVisible();
      await expect(page.locator('[data-step="who"]')).toContainText(copy.vocabulary.auto_cleared[locale]);
      // An info finding never manufactures alarm (§8's reverse clause): no what-to-do step.
      await expect(page.locator('[data-step="what-to-do"]')).toHaveCount(0);
    });

    test('involved prescriptions render read-only and link to their detail', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      const bridge = page.getByTestId('alert-bridge');
      const cards = bridge.getByRole('link');
      await expect(cards).toHaveCount(2);
      await expect(cards.filter({ hasText: localizeDrugName('Warfarin', locale) })).toHaveAttribute('href', `/${locale}/app/medicines/rx-001`);
      await expect(cards.filter({ hasText: localizeDrugName('Ibuprofen', locale) })).toHaveAttribute('href', `/${locale}/app/medicines/rx-002`);
      // Read-only: the cards only open B3; nothing in the bridge acts on the prescription.
      await expect(bridge.getByRole('button')).toHaveCount(0);
      await clickWhenLive(cards.first());
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/medicines/rx-001$`), NAV);
    });

    test('opening the alert twice never changes its state', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      const band = page.locator('[data-testid="alert-band"][data-severity="danger"]');
      const who = page.locator('[data-step="who"]');
      await expect(band).toBeVisible();
      await expect(who).toContainText(copy.vocabulary.pending_medical_review[locale]);
      await page.reload();
      await expect(band).toBeVisible();
      await expect(who).toContainText(copy.vocabulary.pending_medical_review[locale]);
      await expect(page.locator('[data-step="what-to-do"]')).toBeVisible();
    });

    test('back returns to the safety list; no bottom bar on the pushed detail at phone width, the rail from 834 (D-010)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001`);
      const nav = page.getByRole('navigation', { name: copy.shell.mainNavigationLabel[locale] });
      if ((page.viewportSize()?.width ?? 390) < 834) {
        await expect(nav).toHaveCount(0);
      } else {
        await expect(nav).toBeVisible();
        await expect(nav.locator('[aria-current="page"]')).toContainText(copy.shell.tabSafety[locale]);
      }
      await clickWhenLive(page.getByRole('link', { name: copy.safety.c1BackLabel[locale] }));
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety$`), NAV);
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
      await clickWhenLive(page.getByRole('button', { name: copy.shell.retry[locale] }));
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/safety/ia-001$`), NAV);
    });

    test('failed-refresh (LastKnown) — never an empty screen', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/safety/ia-001?view=offline`);
      await expect(page.getByText(copy.vocabulary.asOf[locale])).toBeVisible();
      await expect(page.locator('[data-testid="alert-band"][data-severity="danger"]')).toBeVisible();
    });
  });
}

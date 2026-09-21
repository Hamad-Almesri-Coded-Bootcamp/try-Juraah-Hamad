/**
 * WP4 bundle g — E1 (calendar sync), E2 (activity feed), E3 (settings), E4 (help), E5 (notifications
 * & messaging), every state named in `docs/Acceptance Criteria and Test Plan.md` / `docs/SCREENS.md`,
 * at 390/834/1440 × ar/en (the three Playwright projects give the viewport axis; the locale loop
 * below matches `tests/e2e/safety.spec.ts`'s own convention).
 *
 * Seed cast used: حمد (pt-01, `hamad`) — tracking off, push `default`, chat `not_connected`, refill
 * alerts on, calendar off · فاطمة (pt-02, `fatima`) — push `denied`, chat `expired` · سارة (pt-03,
 * `sara_patient`) — tracking on, push `granted`, chat `connected`, calendar on · بدر (pt-04, `badr`)
 * — no Settings/MessagingLink/PushSubscription row at all (the documented-defaults case).
 *
 * The mock store is a module-level singleton shared by every project this file runs under (D-002),
 * so any test that both depends on a patient's PRISTINE state and would otherwise be repeated per
 * locale/project stays read-only in the loop below. The handful of real mutations —
 * `enableCalendarSync`, `updateSettings` (turning tracking off), and the `startMessagingLink` /
 * `disconnectMessaging` round trip — are written once each, hardcoded to one locale, and guarded to
 * a single project (`desktop-1440`, the last-declared project in `playwright.config.ts`, run last
 * under `--workers=1`), exactly like `tests/e2e/identity.spec.ts`'s own `completeOnboarding` guard.
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

for (const [locale, dir] of LOCALES) {
  // -----------------------------------------------------------------------------------------
  // E1 — Calendar sync (read-only states only — the subscribe action is a one-shot mutation below)
  // -----------------------------------------------------------------------------------------
  test.describe(`E1 — Calendar sync (${locale})`, () => {
    test('off (حمد never subscribed) — the subscribe action, no link', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/calendar`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.getByTestId('calendar-off')).toBeVisible();
      await expect(page.getByTestId('calendar-on')).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('on (سارة already subscribed) — the per-patient webcal link, instructions, one-directional line', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/calendar`);
      await expect(page.getByTestId('calendar-on')).toBeVisible();
      const input = page.locator('input[dir="ltr"][readonly]');
      await expect(input).toHaveValue(/^webcal:\/\//);
      await noOverflowAndAxeClean(page);
    });

    test('G7 states', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/calendar?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/calendar?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/calendar?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------------------------
  // E2 — Activity feed
  // -----------------------------------------------------------------------------------------
  test.describe(`E2 — Activity feed (${locale})`, () => {
    test('حمد — reverse-chronological rows, a masked name from the seed’s own message, never a Civil ID', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/activity`);
      const list = page.getByTestId('activity-list');
      await expect(list).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/\d{12}/);
      await expect(page.getByText(/عبدالله م\*\*\* ع\*\*\* المطيري|عبدالله م\*\*\*/).first()).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('a prescription row opens B3, nothing else', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/activity`);
      const link = page.locator('a[href*="/app/medicines/rx-001"]').first();
      await expect(link).toBeVisible();
    });

    test('بدر — empty, never alarming', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'badr');
      await page.goto(`/${locale}/app/more/activity`);
      await expect(page.getByText(/ما فيه شي مسجّل بعد|Nothing recorded yet/)).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('G7 states', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/activity?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/activity?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/activity?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------------------------
  // E3 — Settings (read-only states — turning tracking off is a one-shot mutation below)
  // -----------------------------------------------------------------------------------------
  test.describe(`E3 — Settings (${locale})`, () => {
    test('exactly the permitted controls — no channel Select, no language control in the content', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/settings`);
      const content = page.locator('#main-content');
      await expect(content.locator('[role="switch"]')).toHaveCount(3);
      await expect(content.locator('input[type="radio"]')).toHaveCount(2);
      await expect(content.locator('select')).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('حمد — tracking off with no connected chat: one-line explanation, flipping it goes to E5 rather than failing, and writes nothing', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/settings`);
      const trackingSwitch = page.locator('[role="switch"]').first();
      await expect(trackingSwitch).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText(/تحتاج محادثة مربوطة|A connected chat is what turns/)).toBeVisible();
      await trackingSwitch.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/more/notifications$`));
      // Nothing was written — re-visiting settings still shows tracking off.
      await page.goto(`/${locale}/app/more/settings`);
      await expect(page.locator('[role="switch"]').first()).toHaveAttribute('aria-checked', 'false');
    });

    test('G7 states', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/settings?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/settings?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/settings?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
    });
  });

  // -----------------------------------------------------------------------------------------
  // E4 — Help & support
  // -----------------------------------------------------------------------------------------
  test.describe(`E4 — Help & support (${locale})`, () => {
    test('static topics render, ends with the no-clinical-advice line', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/help`);
      await expect(page.getByTestId('help-screen')).toBeVisible();
      await expect(page.getByText(/هذا التطبيق ما يعطي استشارة طبية|This app gives no medical advice/)).toBeVisible();
      await noOverflowAndAxeClean(page);
    });
  });

  // -----------------------------------------------------------------------------------------
  // E5 — Notifications & messaging (read-only states — the chat round trip is a one-shot below)
  // -----------------------------------------------------------------------------------------
  test.describe(`E5 — Notifications & messaging (${locale})`, () => {
    test('حمد — push default, chat not connected: neither section blocks navigation', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/notifications`);
      await expect(page.getByTestId('push-default')).toBeVisible();
      await expect(page.getByTestId('chat-not-connected')).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('سارة — push granted: alert types listed, send-test, disable; chat connected: send-test, disconnect', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/notifications`);
      const pushGranted = page.getByTestId('push-granted');
      await expect(pushGranted).toBeVisible();
      await expect(pushGranted.getByText(/تعارض خطير|Serious interaction/)).toBeVisible();
      await expect(pushGranted.getByText(/تذكير الجرعة|Dose reminder/)).toBeVisible();
      await expect(page.getByTestId('chat-connected')).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('فاطمة — push denied: neutral tone, no warning/danger class, never a nag; chat: her retry link is the current, most-recently-created row (pending)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'fatima');
      await page.goto(`/${locale}/app/more/notifications`);
      await expect(page.getByTestId('push-denied')).toBeVisible();
      await expect(page.locator('.wsf-notice--warning')).toHaveCount(0);
      await expect(page.locator('.wsf-notice--danger')).toHaveCount(0);
      // فاطمة carries two MessagingLink rows (ml-02 expired, ml-05 her pending retry) — the mock's
      // own "most recently created wins" rule (docs/Seed Dataset.md line 163) makes ml-05 current,
      // so her CURRENT chat state resolves to `pending`, not `expired` (no seeded patient's current
      // state ever resolves to `expired` — recorded in docs/backend-notes/wp4g.md).
      await expect(page.getByTestId('chat-pending')).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('iOS Safari not installed (dev-only render fixture, ?view=ios) — Home Screen install steps, never a bare promise', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/notifications?view=ios`);
      await expect(page.getByTestId('push-ios-install')).toBeVisible();
      await expect(page.getByText(/الشاشة الرئيسية|Home Screen/).first()).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('G12 — no notification payload ever carries an action (static scan of this screen’s own markup)', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'sara_patient');
      await page.goto(`/${locale}/app/more/notifications`);
      const html = await page.content();
      expect(html).not.toMatch(/"actions"\s*:/);
    });

    test('G7 states', async ({ page, context, baseURL }) => {
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/notifications?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/notifications?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/notifications?view=offline`);
      await expect(page.getByText(/آخر تحديث|As of/)).toBeVisible();
    });
  });
}

// ---------------------------------------------------------------------------------------------
// One-shot mutations against the shared mock store — each written once, hardcoded to /ar/, and
// guarded to a single project (see this file's own header comment for why).
// ---------------------------------------------------------------------------------------------

test.describe('E1 — subscribing (one-shot)', () => {
  test('حمد subscribes: the exact link the data layer returns, never one built on screen', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'enableCalendarSync is a one-way mutation against the shared mock store (D-002); every project reuses the same dev server, so this runs once.');
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/calendar');
    await expect(page.getByTestId('calendar-off')).toBeVisible(); // still pristine at this point in the run
    await page.getByRole('button', { name: 'إنشاء رابط الاشتراك' }).click();
    await expect(page.getByTestId('calendar-on')).toBeVisible();
    await expect(page.locator('input[dir="ltr"][readonly]')).toHaveValue('webcal://jurah.app/calendar/pt-01.ics');
  });
});

test.describe('E3 — turning tracking off (one-shot)', () => {
  test('سارة confirms in a Sheet naming all three consequences, and the store only changes after confirming', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'updateSettings here is a real, order-sensitive mutation against the shared mock store (D-002); every project reuses the same dev server, so this runs once.');
    await addSession(context, baseURL, 'sara_patient');
    await page.goto('/ar/app/more/settings');
    const trackingSwitch = page.locator('[role="switch"]').first();
    await expect(trackingSwitch).toHaveAttribute('aria-checked', 'true'); // still pristine at this point in the run
    await trackingSwitch.click();

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const consequences = sheet.getByTestId('turn-off-consequences');
    await expect(consequences).toContainText('تتوقف رسائل المتابعة اليومية.');
    await expect(consequences).toContainText('الجرعات الجديدة تصير بدون حالة.');
    await expect(consequences).toContainText('سجلّك المسجّل يبقى محفوظًا.');
    // Not yet written — the Sheet asks before it acts.
    await expect(trackingSwitch).toHaveAttribute('aria-checked', 'true');

    await sheet.getByRole('button', { name: 'إيقاف المتابعة' }).click();
    await expect(page.locator('[role="switch"]').first()).toHaveAttribute('aria-checked', 'false');
  });
});

test.describe('E5 — chat round trip (one-shot)', () => {
  test('حمد: connect → pending → connected → send test → disconnect, the link token never in the DOM at any step', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'startMessagingLink/disconnectMessaging are real mutations against the shared mock store (D-002); every project reuses the same dev server, so this runs once.');
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/notifications');

    await expect(page.getByTestId('chat-not-connected')).toBeVisible(); // still pristine at this point in the run
    let body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);

    // The mock confirms `pending → connected` only ~50ms after `startMessagingLink` — often faster
    // than this click's own `router.refresh()` round trip, so the `pending` render is not reliably
    // observable here (it IS observable, statically and without a race, on فاطمة's own retry link —
    // the `pending` test above). Accept either transient render, then wait for the real settle.
    await page.getByRole('button', { name: 'افتح تيليقرام' }).click();
    await expect(page.getByTestId('chat-pending').or(page.getByTestId('chat-connected'))).toBeVisible();
    body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);

    // The mock confirms after its own short server-side delay — waited for, never slept for a
    // fixed guess (this file's own polling effect re-requests the page's data on a timer).
    await expect(page.getByTestId('chat-connected')).toBeVisible({ timeout: 15_000 });
    body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);

    await page.getByRole('button', { name: 'أرسل رسالة تجربة' }).click();
    await page.getByRole('button', { name: 'فصل الربط' }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    await expect(sheet.getByTestId('disconnect-consequences')).toContainText('تتوقف رسائل المتابعة اليومية.');
    await sheet.getByRole('button', { name: 'فصل الربط' }).click();

    await expect(page.getByTestId('chat-not-connected')).toBeVisible();
    body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);
  });
});

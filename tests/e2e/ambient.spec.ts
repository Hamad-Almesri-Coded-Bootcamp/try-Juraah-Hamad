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
 *
 * Daylight (CR-071): expected wording is read from the copy catalogue (`copy.ambient`, `copy.vocabulary`)
 * rather than re-typed, so the next copy edit does not break a check whose intent is unchanged. The G7
 * walks visit three dev-compiled routes in one test, so they carry their own longer timeout.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { linkTokenLeaks } from './helpers/link-token';
import { copy } from '@/i18n';
import { localizePersonName } from '@/i18n/localize';
import { LINK_FROM, linkReturnPath } from '@/lib/messaging/link';

const LOCALES = [
  ['ar', 'rtl'],
  ['en', 'ltr'],
] as const;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

/**
 * A client handler (a Toggle, a Button) ignores a click that lands before React has hydrated it, and
 * on the dev server hydration can lag well past the first paint. Wait until React owns the element
 * (its props are attached to the node), then click. `networkidle` is not used: dev-compiled route
 * prefetches can keep the network busy for the whole test.
 */
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

/**
 * Rule 7 / AP-09 (CR-083): no link token anywhere in the page, the RSC payload included. The whole
 * document (page.content(), not the body's text), because a token in a client component's props is
 * serialised into the page's flight data even when nothing renders it. Seed tokens are
 * `mock-token-ml-NN`, live ones `mock-token-live-N`; a real one would only ever sit in a t.me URL.
 * The scan (tests/e2e/helpers/link-token.ts, AP-16 row 4) also catches the raw `linkToken` /
 * `chatId` field names, so a real, non-mock-shaped token still fails this.
 */
async function expectNoLinkToken(page: Page) {
  const html = await page.content();
  expect(linkTokenLeaks(html), 'rule 7').toEqual([]);
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
      test.setTimeout(90_000); // three cold dev-server routes in one test
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/calendar?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/calendar?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/calendar?view=offline`);
      await expect(page.getByText(copy.vocabulary.asOf[locale])).toBeVisible();
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
      // Daylight: grouped by day, newest first, each message in the reader's language.
      await expect(list.getByTestId('activity-day').first()).toBeVisible();
      const bodyText = await page.locator('body').innerText();
      expect(bodyText).not.toMatch(/\d{12}/);
      // The seed's own masked name (buildAuditEvents: "… عبدالله م*** ع*** المطيري"), localised with its
      // shape intact: first and family name in full, each middle name its initial + exactly three asterisks.
      await expect(page.getByText(localizePersonName('عبدالله م*** ع*** المطيري', locale)).first()).toBeVisible();
      const maskedWords = (await list.innerText()).split(/\s+/).filter((w) => w.includes('*'));
      expect(maskedWords.length, 'at least one masked name on the feed').toBeGreaterThan(0);
      for (const word of maskedWords) expect(word, 'a masked middle name is one letter + exactly three asterisks').toMatch(/^\p{L}\*{3}$/u);
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
      await expect(page.getByText(copy.ambient.e2EmptyTitle[locale])).toBeVisible();
      await expect(page.getByTestId('activity-list')).toHaveCount(0);
      await noOverflowAndAxeClean(page);
    });

    test('G7 states', async ({ page, context, baseURL }) => {
      test.setTimeout(90_000); // three cold dev-server routes in one test
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/activity?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/activity?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/activity?view=offline`);
      await expect(page.getByText(copy.vocabulary.asOf[locale])).toBeVisible();
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
      const trackingSwitch = page.locator('#main-content [role="switch"]').first();
      await expect(trackingSwitch).toHaveAttribute('aria-checked', 'false');
      await expect(page.getByText(copy.ambient.e3TrackingNoChatNotice[locale])).toBeVisible();
      // The switch's handler is client-side, and the E5 route may still be a cold compile.
      await clickWhenLive(trackingSwitch);
      await expect(page).toHaveURL(new RegExp(`/${locale}/app/more/notifications$`), { timeout: 15_000 });
      // Nothing was written — re-visiting settings still shows tracking off.
      await page.goto(`/${locale}/app/more/settings`);
      await expect(page.locator('#main-content [role="switch"]').first()).toHaveAttribute('aria-checked', 'false');
    });

    test('G7 states', async ({ page, context, baseURL }) => {
      test.setTimeout(90_000); // three cold dev-server routes in one test
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/settings?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/settings?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/settings?view=offline`);
      await expect(page.getByText(copy.vocabulary.asOf[locale])).toBeVisible();
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
      await expect(page.getByText(copy.ambient.e4NoAdviceNote[locale])).toBeVisible();
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
      await expect(pushGranted.getByText(copy.ambient.e5AlertDanger[locale], { exact: true })).toBeVisible();
      await expect(pushGranted.getByText(copy.ambient.e5AlertReminder[locale], { exact: true })).toBeVisible();
      await expect(pushGranted.getByRole('button', { name: copy.ambient.e5SendTestAction[locale] })).toBeVisible();
      await expect(pushGranted.getByRole('button', { name: copy.ambient.e5DisableAction[locale] })).toBeVisible();
      const chatConnected = page.getByTestId('chat-connected');
      await expect(chatConnected).toBeVisible();
      await expect(chatConnected.getByRole('button', { name: copy.ambient.e5SendTestMessageAction[locale] })).toBeVisible();
      await expect(chatConnected.getByRole('button', { name: copy.ambient.e5DisconnectAction[locale] })).toBeVisible();
      await noOverflowAndAxeClean(page);
    });

    test('فاطمة — push denied: neutral tone, no warning/danger class, never a nag; chat: her retry link is the current, most-recently-created row (pending)', async ({ page, context, baseURL }, testInfo) => {
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
      // AP-09: ml-05 carries a live seed token (mock-token-ml-05); the page holds none of it, and the
      // waiting state offers "I pressed Start" and "Open Telegram again" (a form to the link route).
      await expectNoLinkToken(page);
      const pendingState = page.getByTestId('chat-pending');
      await expect(pendingState.getByRole('button', { name: copy.ambient.e5ChatCheckAction[locale] })).toBeVisible();
      await expect(pendingState.locator('form[action="/api/messaging/telegram/open"][method="post"]')).toHaveCount(1);
      await noOverflowAndAxeClean(page);
      if (testInfo.project.name === 'phone-390') {
        // The chat section at 390 px (the shell scrolls inside its own container, so a full-page shot
        // would stop at the first screen); copied to docs/backend-notes/ap-09/ as the acceptance proof.
        await page.getByTestId('chat-section').screenshot({ path: testInfo.outputPath(`e5-pending-${locale}-390.png`) });
      }
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
      test.setTimeout(90_000); // three cold dev-server routes in one test
      await addSession(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/notifications?view=loading`);
      await expect(page.getByRole('status').first()).toBeVisible();
      await page.goto(`/${locale}/app/more/notifications?view=error`);
      await expect(page.locator('#main-content').getByRole('alert')).toBeVisible();
      await page.goto(`/${locale}/app/more/notifications?view=offline`);
      await expect(page.getByText(copy.vocabulary.asOf[locale])).toBeVisible();
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
    await clickWhenLive(page.getByRole('button', { name: copy.ambient.e1SubscribeAction.ar }));
    await expect(page.getByTestId('calendar-on')).toBeVisible();
    await expect(page.locator('input[dir="ltr"][readonly]')).toHaveValue('webcal://jurah.app/calendar/pt-01.ics');
  });
});

test.describe('E3 — turning tracking off (one-shot)', () => {
  test('سارة confirms in a Sheet naming all three consequences, and the store only changes after confirming', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'updateSettings here is a real, order-sensitive mutation against the shared mock store (D-002); every project reuses the same dev server, so this runs once.');
    await addSession(context, baseURL, 'sara_patient');
    await page.goto('/ar/app/more/settings');
    const trackingSwitch = page.locator('#main-content [role="switch"]').first();
    await expect(trackingSwitch).toHaveAttribute('aria-checked', 'true'); // still pristine at this point in the run
    await clickWhenLive(trackingSwitch);

    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const consequences = sheet.getByTestId('turn-off-consequences');
    await expect(consequences).toContainText(copy.ambient.e3TurnOffConsequence1.ar);
    await expect(consequences).toContainText(copy.ambient.e3TurnOffConsequence2.ar);
    await expect(consequences).toContainText(copy.ambient.e3TurnOffConsequence3.ar);
    // Not yet written — the Sheet asks before it acts.
    await expect(trackingSwitch).toHaveAttribute('aria-checked', 'true');

    await sheet.getByRole('button', { name: copy.ambient.e3TurnOffConfirm.ar }).click();
    await expect(page.locator('#main-content [role="switch"]').first()).toHaveAttribute('aria-checked', 'false');
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
    await expectNoLinkToken(page);

    // AP-09: "Open Telegram" is a form POST to the link route, which mints حمد's own link. The bot is
    // simulated in this run (no JURAH_BOT_TOKEN), so its answer is a 303 straight back to E5, with no
    // token and no t.me anywhere in it; with a real bot the same answer's Location is the t.me link
    // (tests/unit/api/telegram-open.test.ts). The mock confirms ~50ms later, often before E5 has
    // re-rendered, so either transient state is accepted before waiting for the real settle.
    const answer = page.waitForResponse((r) => r.url().endsWith('/api/messaging/telegram/open') && r.request().method() === 'POST');
    await clickWhenLive(page.getByRole('button', { name: copy.ambient.e5OpenChatAction.ar }));
    const routeAnswer = await answer;
    expect(routeAnswer.status()).toBe(303);
    expect(routeAnswer.headers()['location']).toBe('/ar/app/more/notifications');
    expect(routeAnswer.headers()['cache-control']).toBe('no-store');
    expect(routeAnswer.headers()['referrer-policy']).toBe('no-referrer');
    expect(routeAnswer.request().headers()['origin']).toBe(new URL(baseURL ?? 'http://localhost:3100').origin);
    expect(routeAnswer.request().postData()).toBe('locale=ar&from=notifications');
    await expect(page.getByTestId('chat-pending').or(page.getByTestId('chat-connected'))).toBeVisible();
    body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);
    await expectNoLinkToken(page);

    // The mock confirms after its own short server-side delay — waited for, never slept for a
    // fixed guess (this file's own polling effect re-requests the page's data on a timer).
    await expect(page.getByTestId('chat-connected')).toBeVisible({ timeout: 15_000 });
    body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);
    await expectNoLinkToken(page);

    await page.getByRole('button', { name: copy.ambient.e5SendTestMessageAction.ar }).click();
    // Daylight: the screen says the test message went, in its own words (no longer the clipboard's "Copied").
    await expect(page.getByTestId('chat-connected').getByRole('status').filter({ hasText: copy.ambient.e5TestMessageSent.ar })).toBeVisible();
    await page.getByRole('button', { name: copy.ambient.e5DisconnectAction.ar }).click();
    const sheet = page.getByRole('dialog');
    await expect(sheet).toBeVisible();
    const consequences = sheet.getByTestId('disconnect-consequences');
    await expect(consequences).toContainText(copy.ambient.e5DisconnectConsequence1.ar);
    await expect(consequences).toContainText(copy.ambient.e5DisconnectConsequence2.ar);
    await sheet.getByRole('button', { name: copy.ambient.e5DisconnectConfirm.ar }).click();

    await expect(page.getByTestId('chat-not-connected')).toBeVisible();
    body = await page.locator('body').innerHTML();
    expect(body).not.toMatch(/mock-token-live-/);
    await expectNoLinkToken(page);
  });
});

test.describe('E5 — the link route refuses everything but a same-origin post (AP-09, read-only)', () => {
  test('a cross-site post, a post with no Origin and a GET mint nothing and carry no token — every return page (E5, A2 step 2, F4), both locales', async ({ page, context, baseURL }) => {
    // بدر has no link row at all, so any mint would show on his E5 (and nothing else of his is touched).
    await addSession(context, baseURL, 'badr');
    for (const locale of ['ar', 'en'] as const) {
      for (const from of LINK_FROM) {
        const form = { locale, from };
        for (const headers of [{ origin: 'https://evil.example' }, {}] as Record<string, string>[]) {
          const r = await page.request.post('/api/messaging/telegram/open', { form, headers, maxRedirects: 0 });
          expect(r.status()).toBe(303);
          expect(r.headers()['location']).toBe(linkReturnPath(locale, from));
          expect(r.headers()['cache-control']).toBe('no-store');
          expect(await r.text()).toBe('');
          expect(linkTokenLeaks(r.headers()['location'] ?? ''), 'rule 7').toEqual([]);
        }
      }
    }
    // One way in: F1's GET (which read the pending token) no longer exists.
    const get = await page.request.get('/api/messaging/telegram/open?locale=en', { maxRedirects: 0 });
    expect(get.status()).toBe(405);
    // Nothing was minted: بدر's chat is still not connected.
    await page.goto('/en/app/more/notifications');
    await expect(page.getByTestId('chat-not-connected')).toBeVisible();
    await expectNoLinkToken(page);
  });
});

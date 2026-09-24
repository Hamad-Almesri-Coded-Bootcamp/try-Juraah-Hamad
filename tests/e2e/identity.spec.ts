/**
 * WP4b — identity surfaces: A0 (session gate, tested here per the brief — WP3 built it, this
 * bundle never edits `app/[locale]/gate/**`), A1 (sign-in), A1b (role chooser), A2 (first-run
 * setup), A3 (profile). Every state in the four SCREENS rows, at 390/834/1440 (the three Playwright
 * projects this file already runs under) × ar/en.
 *
 * A note on A1's "lapsed" state: it is the real Countdown component's own 25-second timeout
 * (`HAWIATI_COUNTDOWN_SECONDS`), which this mock always resolves in under two seconds — forcing a
 * genuine unanswered approval here would mean either a real 25-second wait per test or a test-only
 * hook this brief's prohibitions rule out ("no invented seed value … no UX rule" change). It is
 * covered instead by `tests/unit/identity/sign-in-form.test.tsx` (fake timers, a controlled hang),
 * which asserts the same UI the board specifies. Documented in the report, not hidden.
 */
import { test, expect, type BrowserContext } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { pendingInvitationCookieFor, sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy } from '../../i18n';
import { formatNumber } from '../../i18n/format';

const LOCALES = ['ar', 'en'] as const;
// Expected wording comes from the copy catalogue (CR-071 rewrote every Arabic string in Fusha), so the
// next copy edit changes what the test reads, never what it protects.
const id = copy.identity;

async function addSession(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}

async function addPendingInvitationOnly(context: BrowserContext, baseURL: string | undefined, subjectId: string) {
  // D-018 / E-25 (lead, Gate 2): the cookie is signed — a hand-built unsigned value is exactly the forgery proxy.ts refuses.
  await context.addCookies([pendingInvitationCookieFor(subjectId, new URL(baseURL ?? 'http://localhost:3100'))]);
}

// ---------------------------------------------------------------------------------------------
// A0 — the session gate (a routing state, WP3's — tested, never edited)
// ---------------------------------------------------------------------------------------------
test.describe('A0 — session gate', () => {
  test('renders a skeleton, never a blank screen, while it resolves', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    // Slow the navigation down so the skeleton is observable rather than racing past it.
    await page.route('**/ar/gate', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.continue();
    });
    const navigation = page.goto('/ar/gate');
    await expect(page.getByRole('status')).toBeVisible();
    await navigation;
    await expect(page).toHaveURL(/\/ar\/app(\/|$)/);
  });

  test('routes every seeded outcome to its own destination', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/app(\/|$)/);

    await context.clearCookies();
    await addSession(context, baseURL, 'badr'); // onboardingCompleted: false
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/app\/setup(\?|$)/);

    await context.clearCookies();
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/care(\/|$)/);

    await context.clearCookies();
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/clinic\/review(\/|$)/);

    await context.clearCookies();
    await addSession(context, baseURL, 'dana');
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/clinic\/audit(\/|$)/);

    await context.clearCookies();
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/signin(\/|$)/);
  });

  test('ناصر (pending invitation only) never grants anything beyond /invitation', async ({ page, context, baseURL }) => {
    await addPendingInvitationOnly(context, baseURL, 'cg-03');
    await page.goto('/ar/gate');
    await expect(page).toHaveURL(/\/ar\/invitation(\?|$)/);
    for (const route of ['/app', '/care', '/clinic/review', '/clinic/audit', '/signin', '/signin/choose']) {
      await page.goto(`/ar${route}`);
      await expect(page, route).toHaveURL(/\/ar\/invitation(\?|$)/);
    }
  });
});

// ---------------------------------------------------------------------------------------------
// A1 — sign-in / identity verification
// ---------------------------------------------------------------------------------------------
test.describe('A1 — sign-in', () => {
  // Audit M14 (2026-09-23): Continue is never disabled-until-valid. Empty and malformed input each
  // get their own message in the field on submit — by button or by Enter — and nothing is cleared.
  test('empty: continue stays enabled and says what to do, on click or Enter', async ({ page }) => {
    await page.goto('/ar/signin');
    const continueButton = page.getByRole('button', { name: id.continueLabel.ar });
    const civilId = page.getByLabel(id.civilIdLabel.ar);
    await expect(continueButton).toBeEnabled();
    await continueButton.click();
    await expect(page.getByText(id.civilIdRequiredError.ar)).toBeVisible();
    await civilId.fill('123');
    await civilId.press('Enter');
    await expect(page.getByText(id.civilIdLengthError.ar)).toBeVisible();
    await expect(civilId).toHaveValue('123');
    await expect(page).toHaveURL(/\/ar\/signin$/);
  });

  test('invalid ID: a specific error, the input kept', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('111111111111');
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page.getByText(id.invalidIdError.ar)).toBeVisible();
    await expect(page.getByLabel(id.civilIdLabel.ar)).toHaveValue('111111111111');
  });

  test('countdown becomes visible for a valid ID before it resolves', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('255031200187'); // حمد
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page.getByRole('progressbar')).toBeVisible();
    await expect(page).toHaveURL(/\/ar\/app(\/|$)/, { timeout: 10_000 });
  });

  test('a single-role ID (حمد) reaches its shell home directly', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('255031200187');
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page).toHaveURL(/\/ar\/app(\/|$)/, { timeout: 10_000 });
  });

  test('a dual-role ID (سارة) reaches the role chooser, never a shell directly', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('290022500654');
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page).toHaveURL(/\/ar\/signin\/choose(\?|$)/, { timeout: 10_000 });
  });

  test('a pending-invitation-only ID (ناصر) reaches F0 and nothing else', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('288110300229');
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page).toHaveURL(/\/ar\/invitation(\?|$)/, { timeout: 10_000 });
  });

  test('no_claims — byte-identical wording for منى (an account, no role) and a Civil ID with no account', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('292043000517'); // منى
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    const firstText = await page.getByTestId('no-claims').innerText();

    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('277091900873'); // no account
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    const secondText = await page.getByTestId('no-claims').innerText();

    expect(firstText).toBe(secondText);
  });

  test('a revoked-access ID (طلال) also resolves as no_claims, identically', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('298052000731'); // طلال — his access was revoked
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    const revokedText = await page.getByTestId('no-claims').innerText();
    await expect(page.getByTestId('no-claims').getByText(id.noClaimsTitle.ar)).toBeVisible();
    await expect(page.getByTestId('no-claims').getByText(id.noClaimsCardTitle.ar)).toBeVisible();

    // "Identically": byte for byte the words a Civil ID with no account at all gets (rule 6 / G9).
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('277091900873'); // no account
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    expect(await page.getByTestId('no-claims').innerText()).toBe(revokedText);
  });
});

// ---------------------------------------------------------------------------------------------
// A1b — role chooser
// ---------------------------------------------------------------------------------------------
test.describe('A1b — role chooser (سارة)', () => {
  test('a single-role ID never sees this screen', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/signin/choose');
    await expect(page).not.toHaveURL(/\/ar\/signin\/choose/);
  });

  test('two equal cards; choosing "my medicines" opens the patient shell', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('290022500654');
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page).toHaveURL(/\/ar\/signin\/choose(\?|$)/, { timeout: 10_000 });
    await expect(page.getByRole('button', { name: id.roleChooserOwnButton.ar })).toBeVisible();
    await expect(page.getByRole('button', { name: id.roleChooserCaregiverButtonTemplate.ar.replace('{name}', 'حمد') })).toBeVisible();
    await page.getByRole('button', { name: id.roleChooserOwnButton.ar }).click();
    await expect(page).toHaveURL(/\/ar\/app(\/|$)/);
  });

  test('choosing the caregiver record opens the caregiver shell, without signing out', async ({ page }) => {
    await page.goto('/ar/signin');
    await page.getByLabel(id.civilIdLabel.ar).fill('290022500654');
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page).toHaveURL(/\/ar\/signin\/choose(\?|$)/, { timeout: 10_000 });
    await page.getByRole('button', { name: id.roleChooserCaregiverButtonTemplate.ar.replace('{name}', 'حمد') }).click();
    await expect(page).toHaveURL(/\/ar\/care(\/|$)/);
  });
});

// ---------------------------------------------------------------------------------------------
// A2 — first-run setup (بدر)
// ---------------------------------------------------------------------------------------------
test.describe('A2 — first-run setup (بدر)', () => {
  // بدر (`onboardingCompleted: false`) is the seed's ONE never-onboarded patient (CR-004), and
  // `completeOnboarding` has no undo — the mock store is a server-side singleton that survives for
  // the life of the dev server (D-002), shared by every project this file runs under. Any test that
  // depends on his PRE-completion state must therefore run before the one test that finishes his
  // flow, and that one test is guarded to run on a single project so it does not complete him before
  // a later project's own A0/A2 tests get to see him pristine.

  test('abandoning returns to the same step — a bookmarked step URL resumes there, not at step 1', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'badr');
    await page.goto('/ar/app/setup?step=2');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(id.inviteStepTitle.ar);
  });

  // Read-only (nothing is clicked), so it runs on every project before the one test that finishes
  // بدر's flow. Equal choices are drawn equal (UX §2/§13, audit M2; CR-071): the three reminder
  // offers are three cards with three buttons of one variant and one size, "Later" among them, and
  // inviting a caregiver and "not now" are the same size too — declining is never the smaller path.
  test('equal choices drawn equal: the three reminder offers, and invite beside "not now"', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'badr');
    await page.goto('/ar/app/setup?step=1');
    const offers = [id.browserOfferButton.ar, id.telegramOfferButton.ar, id.laterOfferButton.ar].map((name) =>
      page.getByRole('button', { name, exact: true }),
    );
    const offerBoxes = await Promise.all(offers.map(async (b) => (await b.boundingBox())!));
    for (const box of offerBoxes.slice(1)) {
      expect(box.width).toBeCloseTo(offerBoxes[0]!.width, 0);
      expect(box.height).toBeCloseTo(offerBoxes[0]!.height, 0);
    }
    // None of the three is the screen's primary: the same class list on all three.
    const classes = await Promise.all(offers.map((b) => b.getAttribute('class')));
    expect(new Set(classes).size).toBe(1);

    await page.goto('/ar/app/setup?step=2');
    const invite = page.getByRole('button', { name: id.inviteOpenLabel.ar, exact: true });
    const notNow = page.getByRole('button', { name: id.skipInviteLabel.ar, exact: true });
    const [a, b] = [(await invite.boundingBox())!, (await notNow.boundingBox())!];
    expect(a.width).toBeCloseTo(b.width, 0);
    expect(a.height).toBeCloseTo(b.height, 0);
    expect(await invite.getAttribute('class')).toBe(await notNow.getAttribute('class'));
  });

  // AP-09 (CR-086): the Telegram offer is the same link form as E5 and F4. The route's own answer is
  // proven by ambient.spec (حمد's round trip) and tests/unit/api/telegram-open.test.ts; here the one
  // post it would make for بدر is caught before it reaches the server and answered as the simulated
  // route answers (303 to the invite step), because a real mint would change بدر's activity feed,
  // which other specs read as empty. Read-only for the store, so it runs on every project, and before
  // the one test that finishes his setup.
  test('the Telegram offer posts a form to the link route (locale and screen only, same origin), lands on the next step, and no token is ever on the page', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'badr');
    await page.goto('/ar/app/setup?step=1');
    let html = await page.content();
    expect(html).not.toMatch(/mock-token-|t\.me\/[A-Za-z0-9_]+\?start=/);

    const posted: { method: string; body: string | null; origin: string | undefined }[] = [];
    await page.route('**/api/messaging/telegram/open', async (route) => {
      const request = route.request();
      posted.push({ method: request.method(), body: request.postData(), origin: request.headers()['origin'] });
      await route.fulfill({ status: 303, headers: { location: '/ar/app/setup?step=2', 'cache-control': 'no-store' } });
    });
    const offer = page.getByRole('button', { name: id.telegramOfferButton.ar, exact: true });
    await expect(offer).toHaveAttribute('type', 'submit');
    await offer.click();
    await expect(page).toHaveURL(/step=2/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(id.inviteStepTitle.ar);
    expect(posted).toEqual([{ method: 'POST', body: 'locale=ar&from=setup', origin: new URL(baseURL ?? 'http://localhost:3100').origin }]);
    html = await page.content();
    expect(html).not.toMatch(/mock-token-|t\.me\/[A-Za-z0-9_]+\?start=/);
  });

  test('setup never runs twice: a completed patient visiting /app/setup is sent to Today', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad'); // onboardingCompleted: true already, unaffected by بدر's state
    await page.goto('/ar/app/setup');
    await expect(page).toHaveURL(/\/ar\/app(\?|$)/);
  });

  test('four steps end to end; declining everything lands on Today with no warning', async ({ page, context, baseURL }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-1440', 'runs once only — completeOnboarding is irreversible against the shared mock store (D-002), and every project reuses the same dev server');
    await addSession(context, baseURL, 'badr');
    await page.goto('/ar/app/setup');
    // StepIndicator's "Step X of Y" caption, in the reader's digits (Arabic-Indic in Arabic, CR-071).
    const stepCaption = (n: number) => `${copy.vocabulary.stepOf.ar} ${formatNumber(n, 'ar')} ${copy.vocabulary.of.ar} ${formatNumber(4, 'ar')}`;
    await expect(page.getByText(stepCaption(1))).toBeVisible();

    // Step 1 — language (required; a default is already selected).
    await page.getByRole('button', { name: id.continueLabel.ar }).click();
    await expect(page).toHaveURL(/step=1/);
    await expect(page.getByText(stepCaption(2))).toBeVisible();

    // Step 2 — notification offer: "later" is an ordinary choice, not a small link.
    await expect(page.getByRole('button', { name: id.browserOfferButton.ar })).toBeVisible();
    await expect(page.getByRole('button', { name: id.telegramOfferButton.ar })).toBeVisible();
    await page.getByRole('button', { name: id.laterOfferButton.ar, exact: true }).click();
    await expect(page).toHaveURL(/step=2/);

    // Step 3 — optional caregiver invite; "not now" moves on without inviting anyone.
    await page.getByRole('button', { name: id.skipInviteLabel.ar }).click();
    await expect(page).toHaveURL(/step=3/);

    // Step 4 — closing explainer, finish.
    await page.getByRole('button', { name: id.finishSetupLabel.ar }).click();
    await expect(page).toHaveURL(/\/ar\/app(\?|$)/);
    // No error, no warning banner on arrival — scoped to the app's own content: Next's route
    // announcer (`<next-route-announcer role="alert">`) appears outside it after a client-side
    // navigation and is framework chrome, not a banner (same exclusion prescription.spec uses).
    await expect(page.locator('#main-content').getByRole('alert')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------------------------
// A3 — profile / account (patient)
// ---------------------------------------------------------------------------------------------
test.describe('A3 — profile (حمد)', () => {
  test('no Civil ID anywhere on the page, masked or whole', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/profile');
    const bodyText = await page.locator('body').innerText();
    expect(bodyText).not.toMatch(/\d{9,}/);
  });

  test('name in full, the simulated-Hawiati identity line, notification states neutral, caregiver count, sign out', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/profile');
    await expect(page.getByTestId('profile-identity').getByText('حمد سالم المطيري')).toBeVisible(); // the seed's name, in full
    await expect(page.getByText(id.identityLineValue.ar)).toBeVisible();
    // Both notification states are plain values in neutral rows, each opening E5 (never a warning).
    await expect(page.getByRole('link', { name: new RegExp(id.browserNotifLabel.ar) })).toHaveAttribute('href', /\/app\/more\/notifications$/);
    await expect(page.getByRole('link', { name: new RegExp(id.chatLabel.ar) })).toHaveAttribute('href', /\/app\/more\/notifications$/);
    await expect(page.locator('#main-content').getByRole('alert')).toHaveCount(0);
    await expect(page.getByRole('link', { name: new RegExp(id.caregiverCountLabel.ar) })).toHaveAttribute('href', /\/app\/more\/caregivers$/);
    await expect(page.getByRole('button', { name: copy.shell.signOut.ar })).toBeVisible();
  });

  test('editing the contact phone', async ({ page, context, baseURL }, testInfo) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/profile');
    const phone = page.getByLabel(id.phoneLabel.ar);
    // The mock store is shared across the three viewport projects in one run: a value an earlier
    // project already saved would defeat the editor's dirty-check (no change → no save button),
    // so each project writes its own number.
    const perProject = { 'phone-390': '99012345', 'tablet-834': '99012346', 'desktop-1440': '99012347' } as const;
    await phone.fill(perProject[testInfo.project.name as keyof typeof perProject] ?? '99012349');
    await page.getByRole('button', { name: id.phoneSaveLabel.ar }).click();
    await expect(page.getByRole('button', { name: id.phoneSaveLabel.ar })).toHaveCount(0);
  });

  test('sign out clears the session and returns to the landing page with no way back', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar/app/more/profile');
    await page.getByRole('button', { name: copy.shell.signOut.ar }).click();
    await expect(page).toHaveURL(/\/ar\/?$/);
    await page.goBack();
    await expect(page).not.toHaveURL(/\/app/);
  });
});

// ---------------------------------------------------------------------------------------------
// Twelve-point checklist support: bidirectional, no overflow, axe clean — ar/en on every project
// ---------------------------------------------------------------------------------------------
for (const locale of LOCALES) {
  test(`A1 (${locale}) — axe clean, no overflow, correct dir`, async ({ page }) => {
    await page.goto(`/${locale}/signin`);
    await expect(page.locator('html')).toHaveAttribute('dir', locale === 'ar' ? 'rtl' : 'ltr');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });

  test(`A3 (${locale}) — axe clean, no overflow`, async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto(`/${locale}/app/more/profile`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });
}

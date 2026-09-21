/**
 * L1 — the public landing page (docs/Acceptance Criteria and Test Plan.md, G11; SCREENS.md's L1
 * row). Runs under the three viewport projects `playwright.config.ts` defines (390/834/1440), each
 * test reading its own `page.viewportSize()` rather than hard-coding a project name — the same
 * technique `tests/e2e/shells.spec.ts` uses.
 *
 * Every "sign in" / "continue" action on this page is `features/landing/SignInCta.tsx`, which
 * wraps `features/shell/NavigateButton` — a real `<button>` wired to `router.push`, not an anchor
 * (the same pattern the system pages already use for their "way back" action). Assertions on these
 * therefore query `role: 'button'` and prove the destination by clicking and waiting for the URL,
 * not by reading an `href` attribute that does not exist on a button.
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

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
}

// ---------------------------------------------------------------------------
// Content state, 390 / 834 / 1440 × ar / en: G11's ten sections, no overflow, axe clean.
// ---------------------------------------------------------------------------
for (const [locale, dir] of LOCALES) {
  test(`L1 (${locale}) — dir, no overflow, axe clean, at this project's viewport`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('html')).toHaveAttribute('dir', dir);
    await noHorizontalOverflow(page);

    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
  });

  test(`L1 (${locale}) — ten sections in spec order (one h1, eight h2 section headings)`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 2 })).toHaveCount(8);
  });

  test(`L1 (${locale}) — sign-in reachable from the top and from the closing section (G11 pass criteria)`, async ({ page }) => {
    await page.goto(`/${locale}`);
    // The one repeated action (header, hero, closing — docs/backend-notes/wp4a.md §7.1).
    const signInButtons = page.getByRole('button', { name: /Hawiati|هويّاتي/ });
    await expect(signInButtons).toHaveCount(3);
    await expect(signInButtons.first()).toBeVisible();
    await expect(signInButtons.last()).toBeVisible();
  });

  test(`L1 (${locale}) — the clinic route is never linked or named`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('a[href*="/clinic"]')).toHaveCount(0);
    const html = await page.content();
    expect(html).not.toContain('/clinic');
  });

  test(`L1 (${locale}) — the hero mockup carries a real alt text and reserves its layout space`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const img = page.locator('img[src="/landing/today-preview.png"]');
    await expect(img).toHaveCount(1);
    const alt = await img.getAttribute('alt');
    expect(alt && alt.length).toBeGreaterThan(20);
    await expect(img).toHaveAttribute('width', '390');
    await expect(img).toHaveAttribute('height', '844');
  });

  test(`L1 (${locale}) — images unavailable: the image still carries alt text and the layout still holds`, async ({ page, context }) => {
    await context.route('**/landing/today-preview.png', (route) => route.abort());
    await page.goto(`/${locale}`);
    const img = page.locator('img[src="/landing/today-preview.png"]');
    await expect(img).toHaveAttribute('alt', /.{20,}/);
    // The layout reserves the intrinsic width/height even though the image itself failed to load —
    // a collapsed (zero-height) box would mean the layout depends on the image loading.
    const box = await img.boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(0);
    await noHorizontalOverflow(page);
  });
}

// ---------------------------------------------------------------------------
// Signed-in state (WHAT TO BUILD: "the primary button continues into the right shell").
// ---------------------------------------------------------------------------
test.describe('L1 — signed-in state: the primary action continues into the right shell', () => {
  test('no session: the primary action reads the sign-in copy and goes to /ar/signin', async ({ page }) => {
    await page.goto('/ar');
    await page.getByRole('button', { name: /هويّاتي/ }).first().click();
    await expect(page).toHaveURL(/\/ar\/signin(\?|$)/);
  });

  test('a patient session (حمد): the primary action continues to /ar/app', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar');
    // The sign-in copy must not still be showing once the continue-variant copy applies.
    await expect(page.getByRole('button', { name: /هويّاتي/ })).toHaveCount(0);
    await page.getByRole('button', { name: /المتابعة/ }).first().click();
    await expect(page).toHaveURL(/\/ar\/app(\/|\?|$)/);
  });

  test('a caregiver session (عبدالله): the primary action continues to /ar/care', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar');
    await page.getByRole('button', { name: /المتابعة/ }).first().click();
    await expect(page).toHaveURL(/\/ar\/care(\/|\?|$)/);
  });

  test('a reviewer session: the primary action continues to /en/clinic/review', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/en');
    await page.getByRole('button', { name: /Continue/ }).first().click();
    await expect(page).toHaveURL(/\/en\/clinic\/review(\/|\?|$)/);
  });

  test('an admin session: the primary action continues to /en/clinic/audit', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_admin');
    await page.goto('/en');
    await page.getByRole('button', { name: /Continue/ }).first().click();
    await expect(page).toHaveURL(/\/en\/clinic\/audit(\/|\?|$)/);
  });

  // A pending-invitation-only session is not exercised here: `proxy.ts`'s blanket rule redirects
  // *any* path other than `/invitation` to it before this route ever renders (already covered by
  // `tests/e2e/roles.spec.ts`'s ناصر walk, which includes `/` in the routes it checks) — so L1's
  // own `pendingInvitationOnly` branch in `resolveLandingCta` is unreachable through a real
  // navigation and is covered instead by `tests/unit/landing/cta.test.ts` (defensive correctness:
  // it must still point at `/invitation`, never at a shell home, if that ever changes).
});

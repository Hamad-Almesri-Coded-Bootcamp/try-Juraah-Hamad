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
 *
 * Daylight (CR-071): the hero's picture is no longer a screenshot `<img>` but the live `DayDial`
 * (features/landing/HeroDial.tsx), one `role="img"` described in words; the card wall is gone. The
 * hero-picture tests below assert that new picture with the same intent (described for assistive
 * technology, layout reserved, beside the words when wide, independent of any image loading).
 * Expected wording is read from the copy catalogue.
 */
import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy } from '../../i18n';
import { formatTime } from '../../i18n/format';
import { localizeDrugName } from '../../i18n/localize';

/** The hero's one picture: the live day dial, described in words (HeroDial.tsx). */
const heroPicture = (page: Page) => page.locator('section[aria-labelledby="hero-title"]').getByRole('img');
/** The dial actually drawn: HeroDial renders a 296px and a 400px dial and shows one per container width. */
const heroDial = (page: Page) => page.locator('section[aria-labelledby="hero-title"] .jr-dial').filter({ visible: true });
/** The hero becomes a row once <main> is 1000px wide (its `@[1000px]` container query). */
const mainIsWide = (page: Page) => page.locator('main').evaluate((el) => el.clientWidth >= 1000);

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
    // The one repeated action (header, hero, closing — docs/backend-notes/wp4a.md §7.1). The header's
    // is icon-only at phone width, its accessible name still the full action (WCAG 2.5.3).
    const signInButtons = page.getByRole('button', { name: copy.landing.ctaSignIn[locale], exact: true });
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

  // Premise changed (CR-071): the screenshot <img> became the live DayDial. Same intent: the hero's
  // picture is described in words, and its box is reserved by the layout, not by a loaded file.
  test(`L1 (${locale}) — the hero picture (the live day dial) carries a real description and reserves its layout space`, async ({ page }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator('section[aria-labelledby="hero-title"] img')).toHaveCount(0); // no screenshot any more
    const picture = heroPicture(page);
    await expect(picture).toHaveCount(1);
    const description = (await picture.getAttribute('aria-label')) ?? '';
    expect(description.length).toBeGreaterThan(20);
    // It describes a day the build really renders (G11): حمد's next dose on REFERENCE_NOW, in the reader's language.
    expect(description).toContain(localizeDrugName('Brufen', locale));
    expect(description).toContain(formatTime('14:00', locale));
    const dial = heroDial(page);
    await expect(dial).toHaveCount(1);
    const box = (await dial.boundingBox())!;
    expect(box.width).toBeCloseTo(box.height, 0);
    expect(box.width).toBe((await mainIsWide(page)) ? 400 : 296);
  });

  test(`L1 (${locale}) — the hero is a row beside the day dial when the page is wide, stacked at phone and tablet width (V2Landing)`, async ({ page }) => {
    await page.goto(`/${locale}`);
    const [h, d] = await Promise.all([page.getByRole('heading', { level: 1 }).boundingBox(), heroDial(page).boundingBox()]);
    expect(h && d).toBeTruthy();
    if (await mainIsWide(page)) {
      // Side by side: the dial's vertical extent overlaps the headline's, and the two never overlap sideways.
      expect(d!.y < h!.y + h!.height && h!.y < d!.y + d!.height, 'hero text and dial share a row').toBeTruthy();
      expect(d!.x >= h!.x + h!.width || h!.x >= d!.x + d!.width, 'dial beside the headline, not over it').toBeTruthy();
    } else {
      expect(d!.y, 'dial below the headline at phone/tablet width').toBeGreaterThan(h!.y + h!.height);
    }
    await noHorizontalOverflow(page);
  });

  // Premise changed (CR-071): the hero no longer depends on an image file at all. With every image
  // request refused, the picture still carries its description, keeps its box, and any <img> left on
  // the page still has alt text.
  test(`L1 (${locale}) — images unavailable: the hero picture keeps its description and the layout still holds`, async ({ page, context }) => {
    await context.route(/\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i, (route) => route.abort());
    await page.goto(`/${locale}`);
    await expect(heroPicture(page)).toHaveAttribute('aria-label', /.{20,}/);
    const box = await heroDial(page).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThan(0);
    await expect(page.locator('img:not([alt])')).toHaveCount(0);
    await noHorizontalOverflow(page);
  });
}

// ---------------------------------------------------------------------------
// Signed-in state (WHAT TO BUILD: "the primary button continues into the right shell").
// ---------------------------------------------------------------------------
test.describe('L1 — signed-in state: the primary action continues into the right shell', () => {
  test('no session: the primary action reads the sign-in copy and goes to /ar/signin', async ({ page }) => {
    await page.goto('/ar');
    await page.getByRole('button', { name: copy.landing.ctaSignIn.ar, exact: true }).first().click();
    await expect(page).toHaveURL(/\/ar\/signin(\?|$)/);
  });

  test('a patient session (حمد): the primary action continues to /ar/app', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'hamad');
    await page.goto('/ar');
    // The sign-in copy must not still be showing once the continue-variant copy applies. The
    // continue copy is asserted present first, so the absence check can never pass on an empty page.
    const continueButtons = page.getByRole('button', { name: copy.landing.ctaContinue.ar, exact: true });
    await expect(continueButtons).toHaveCount(3);
    await expect(page.getByRole('button', { name: copy.landing.ctaSignIn.ar, exact: true })).toHaveCount(0);
    await continueButtons.first().click();
    await expect(page).toHaveURL(/\/ar\/app(\/|\?|$)/);
  });

  test('a caregiver session (عبدالله): the primary action continues to /ar/care', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'abdullah');
    await page.goto('/ar');
    await page.getByRole('button', { name: copy.landing.ctaContinue.ar, exact: true }).first().click();
    await expect(page).toHaveURL(/\/ar\/care(\/|\?|$)/);
  });

  test('a reviewer session: the primary action continues to /en/clinic/review', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_reviewer');
    await page.goto('/en');
    await page.getByRole('button', { name: copy.landing.ctaContinue.en, exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/clinic\/review(\/|\?|$)/);
  });

  test('an admin session: the primary action continues to /en/clinic/audit', async ({ page, context, baseURL }) => {
    await addSession(context, baseURL, 'khalid_admin');
    await page.goto('/en');
    await page.getByRole('button', { name: copy.landing.ctaContinue.en, exact: true }).first().click();
    await expect(page).toHaveURL(/\/en\/clinic\/audit(\/|\?|$)/);
  });

  // A pending-invitation-only session is not exercised here: `proxy.ts`'s blanket rule redirects
  // *any* path other than `/invitation` to it before this route ever renders (already covered by
  // `tests/e2e/roles.spec.ts`'s ناصر walk, which includes `/` in the routes it checks) — so L1's
  // own `pendingInvitationOnly` branch in `resolveLandingCta` is unreachable through a real
  // navigation and is covered instead by `tests/unit/landing/cta.test.ts` (defensive correctness:
  // it must still point at `/invitation`, never at a shell home, if that ever changes).
});

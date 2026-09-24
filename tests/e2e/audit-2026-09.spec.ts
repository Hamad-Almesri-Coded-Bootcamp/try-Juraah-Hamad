/**
 * Runtime proofs for the 2026-09-23 UX audit fixes (docs/audits/2026-09-23-hallmark-ux-audit.md).
 * Each test observes the behaviour on a real rendered screen, beside the static guard or unit test
 * that approximates it (owner's rule: a static guard needs one runtime proof).
 *
 * Read-only against the shared dev-server store: every test opens things and closes them; nothing
 * is submitted, so the three viewport projects can run these in parallel.
 */
import { test, expect, type BrowserContext, type Locator } from '@playwright/test';
import { sessionCookieFor, TEST_SESSIONS } from './helpers/session';
import { copy } from '../../i18n';

async function as(context: BrowserContext, baseURL: string | undefined, who: keyof typeof TEST_SESSIONS) {
  await context.addCookies([sessionCookieFor(who, new URL(baseURL ?? 'http://localhost:3100'))]);
}
const phoneOnly = (width: number | undefined) => (width ?? 0) > 400;

/** +1 = the glyph points right on screen, -1 = left: the `scale` x-factor times the transform's.
 * The bundle's chevron points right when neither is applied (components/ui/Icon.tsx, `reverse`). */
async function pointing(glyph: Locator): Promise<number> {
  return glyph.first().evaluate((el) => {
    const cs = getComputedStyle(el);
    const scaleX = cs.scale === 'none' ? 1 : Number.parseFloat(cs.scale.split(' ')[0] ?? '1');
    const a = cs.transform === 'none' ? 1 : new DOMMatrixReadOnly(cs.transform).a;
    return Math.sign(scaleX * a);
  });
}

test.describe('audit C2 — a Sheet owns the viewport', () => {
  test('D1 confirm sheet: its actions are on screen and nothing paints over them (390)', async ({ page, context, baseURL, viewport }) => {
    test.skip(phoneOnly(viewport?.width), 'phone-width behaviour: the TabBar used to cover the sheet');
    await as(context, baseURL, 'hamad');
    await page.goto('/en/app/more/refill');
    await page.getByRole('button', { name: 'Request a refill' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    for (const name of ['Send the request', 'Cancel']) {
      const box = await dialog.getByRole('button', { name, exact: true }).boundingBox();
      expect(box, name).not.toBeNull();
      expect(box!.y + box!.height, `${name} bottom edge`).toBeLessThanOrEqual(viewport!.height);
      const onTop = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest('[role=dialog]'), { x: box!.x + box!.width / 2, y: box!.y + box!.height / 2 });
      expect(onTop, `${name} is the topmost element at its centre`).toBe(true);
    }
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
});

// Premise changed (CR-071, CR-069(k)): on a screen whose bar carries the assistant (the pill,
// `[data-assistant-trigger]`), the floating launcher steps aside (daylight.css); it floats only where
// no bar offers it. Same intent as before: exactly one way to the assistant is on screen, inside the
// viewport and clear of the dock, and it opens a real panel whose layer covers the viewport.
test.describe('audit C3 — the assistant is on screen and opens a real panel', () => {
  test('phone shell: the bar pill is inside the viewport, above the dock; the floating launcher steps aside; the panel layer covers the viewport', async ({ page, context, baseURL, viewport }) => {
    test.skip(phoneOnly(viewport?.width), 'phone-width placement (the launcher used to sit under the TabBar)');
    await as(context, baseURL, 'hamad');
    await page.goto('/ar/app');
    const pill = page.locator('[data-assistant-trigger]').filter({ visible: true });
    await expect(pill).toHaveCount(1);
    await expect(page.getByTestId('assistant-launcher')).toBeHidden(); // never two ways at once
    const box = (await pill.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
    const dockTop = await page.getByRole('navigation', { name: copy.shell.mainNavigationLabel.ar }).evaluate((el) => el.getBoundingClientRect().top);
    expect(box.y + box.height).toBeLessThanOrEqual(dockTop);
    await pill.click();
    const layer = (await page.getByTestId('sheet-layer').boundingBox())!;
    expect(layer.width).toBe(viewport!.width);
    expect(layer.height).toBe(viewport!.height);
    await page.keyboard.press('Escape');
  });

  test('phone, a page with no bar (not found): the floating launcher is inside the viewport and opens the same panel', async ({ page, viewport }) => {
    test.skip(phoneOnly(viewport?.width), 'phone-width offset (bottom-24 generated no CSS)');
    await page.goto('/ar/this-page-does-not-exist');
    await expect(page.locator('[data-assistant-trigger]').filter({ visible: true })).toHaveCount(0);
    const launcher = page.getByTestId('assistant-launcher').getByRole('button');
    await expect(launcher).toBeVisible();
    const box = (await launcher.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport!.width);
    await launcher.click();
    const layer = (await page.getByTestId('sheet-layer').boundingBox())!;
    expect(layer.width).toBe(viewport!.width);
    expect(layer.height).toBe(viewport!.height);
    await page.keyboard.press('Escape');
  });
});

test.describe('audit C4 — Card layout utilities apply (bundle.css in a cascade layer)', () => {
  // CR-071 (CR-069(f)) removed the landing's card wall: the two audience cards are its only Cards.
  test('landing cards are flex columns, so a title never runs into its body', async ({ page }) => {
    await page.goto('/en');
    const cards = await page.locator('.wsf-card').evaluateAll((els) =>
      els.map((c) => {
        const cs = getComputedStyle(c);
        const title = c.querySelector('h3')!.getBoundingClientRect();
        const body = c.querySelector('p')!.getBoundingClientRect();
        return { display: cs.display, direction: cs.flexDirection, titleBottom: title.bottom, bodyTop: body.top };
      }),
    );
    expect(cards.length).toBe(2);
    for (const card of cards) {
      expect(card.display).toBe('flex');
      expect(card.direction).toBe('column');
      expect(card.titleBottom, 'the title ends before its body starts').toBeLessThanOrEqual(card.bodyTop);
    }
  });
});

test.describe('audit C5 — backward arrows point backward in both directions', () => {
  for (const [locale, start] of [['en', -1], ['ar', 1]] as const) {
    test(`${locale}: the AppBar back chevron and "previous day" point to the start edge; "next day" to the end`, async ({ page, context, baseURL }) => {
      await as(context, baseURL, 'hamad');
      await page.goto(`/${locale}/app/more/refill`);
      expect(await pointing(page.locator('.wsf-appbar .wsf-iconbtn .wsf-ico'))).toBe(start);
      await page.goto(`/${locale}/app?day=2026-09-26`);
      const prev = page.getByRole('link', { name: locale === 'en' ? 'Previous day' : 'اليوم السابق' });
      const next = page.getByRole('link', { name: locale === 'en' ? 'Next day' : 'اليوم التالي' });
      expect(await pointing(prev.locator('.wsf-ico'))).toBe(start);
      expect(await pointing(next.locator('.wsf-ico'))).toBe(-start);
    });
  }
});

test.describe('audit C3 (zero step) — the caregiver whose-data banner stays on screen', () => {
  test('scrolling Today keeps the ContextBanner pinned to the top (UX §10)', async ({ page, context, baseURL, viewport }) => {
    test.skip(phoneOnly(viewport?.width), 'the pane scrolls under the banner at phone width');
    await as(context, baseURL, 'abdullah');
    await page.goto('/ar/care');
    await page.locator('.overflow-y-auto').first().evaluate((el) => { el.scrollTop = el.scrollHeight; });
    const top = await page.getByText('حمد', { exact: false }).first().evaluate((el) => el.closest('.sticky')?.getBoundingClientRect().top ?? -1);
    expect(top).toBe(0);
  });
});

test.describe('audit C6 — the danger alert opens its detail', () => {
  test('patient B2 with ONE alert (حمد): "Open the alert" opens C2', async ({ page, context, baseURL }) => {
    await as(context, baseURL, 'hamad');
    await page.goto('/en/app/medicines');
    await page.getByRole('button', { name: copy.day.openAlertAction.en }).click();
    await expect(page).toHaveURL(/\/en\/app\/safety\/ia-001$/);
  });

  test('caregiver F2 (عبدالله on حمد): the same action opens the read-only alert detail', async ({ page, context, baseURL }) => {
    await as(context, baseURL, 'abdullah');
    await page.goto('/ar/care/medicines');
    await page.getByRole('button', { name: copy.day.openAlertAction.ar }).click();
    await expect(page).toHaveURL(/\/ar\/care\/alerts\/ia-001$/);
  });
});

test.describe('audit C7 — caregiver Today and Medicines say where you are, and switch language', () => {
  // Today's bar is now the navy sky (SkyHeader, CR-071), Medicines' the AppBar: either way the one
  // h1 and the language switch sit in the same bar (the page's banner).
  for (const [path, title] of [['/ar/care', copy.shell.careTabToday.ar], ['/ar/care/medicines', copy.shell.careTabMedicines.ar]] as const) {
    test(`${path}: one h1 naming the screen, and the app-bar language switch`, async ({ page, context, baseURL }) => {
      await as(context, baseURL, 'abdullah');
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(title);
      const bar = page.getByRole('banner').filter({ has: page.locator('h1') });
      await expect(bar).toHaveCount(1);
      await expect(bar.getByRole('link', { name: copy.shell.languageSwitchLabel.ar })).toBeVisible();
    });
  }
});

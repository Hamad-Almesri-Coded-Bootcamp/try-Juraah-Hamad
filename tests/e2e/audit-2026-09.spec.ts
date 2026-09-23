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

test.describe('audit C3 — the assistant launcher is on screen and opens a real panel', () => {
  test('phone: inside the viewport, above the TabBar; the panel layer covers the viewport', async ({ page, context, baseURL, viewport }) => {
    test.skip(phoneOnly(viewport?.width), 'phone-width offset (bottom-24 generated no CSS)');
    await as(context, baseURL, 'hamad');
    await page.goto('/ar/app');
    const launcher = page.getByTestId('assistant-launcher').getByRole('button');
    const box = (await launcher.boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport!.height);
    const tabBarTop = await page.locator('aside').first().evaluate((el) => el.getBoundingClientRect().top);
    expect(box.y + box.height).toBeLessThanOrEqual(tabBarTop);
    await launcher.click();
    const layer = (await page.getByTestId('sheet-layer').boundingBox())!;
    expect(layer.width).toBe(viewport!.width);
    expect(layer.height).toBe(viewport!.height);
    await page.keyboard.press('Escape');
  });
});

test.describe('audit C4 — Card layout utilities apply (bundle.css in a cascade layer)', () => {
  test('landing cards are flex columns, so a title never runs into its body', async ({ page }) => {
    await page.goto('/en');
    const displays = await page.locator('.wsf-card').evaluateAll((cards) => cards.map((c) => getComputedStyle(c).display));
    expect(displays.length).toBeGreaterThan(10);
    expect(displays.every((d) => d === 'flex')).toBe(true);
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
    await page.getByRole('button', { name: 'Open the alert' }).click();
    await expect(page).toHaveURL(/\/en\/app\/safety\/ia-001$/);
  });

  test('caregiver F2 (عبدالله on حمد): the same action opens the read-only alert detail', async ({ page, context, baseURL }) => {
    await as(context, baseURL, 'abdullah');
    await page.goto('/ar/care/medicines');
    await page.getByRole('button', { name: 'افتح التنبيه' }).click();
    await expect(page).toHaveURL(/\/ar\/care\/alerts\/ia-001$/);
  });
});

test.describe('audit C7 — caregiver Today and Medicines say where you are, and switch language', () => {
  for (const [path, title] of [['/ar/care', 'اليوم'], ['/ar/care/medicines', 'الأدوية']] as const) {
    test(`${path}: one h1 naming the screen, and the app-bar language switch`, async ({ page, context, baseURL }) => {
      await as(context, baseURL, 'abdullah');
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.locator('h1')).toHaveText(title);
      await expect(page.locator('.wsf-appbar').getByRole('link', { name: /English|اللغة|language/i })).toBeVisible();
    });
  }
});

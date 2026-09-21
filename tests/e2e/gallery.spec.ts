/**
 * Gate 2 — the dev-only components gallery renders every group at 390 / 834 / 1440 (Playwright projects),
 * in rtl and ltr, with no horizontal overflow and no axe violation. Red until the WP2 group pages exist.
 */
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const GROUPS = ['a', 'b', 'c', 'd'] as const;
const LOCALES = [['ar', 'rtl'], ['en', 'ltr']] as const;

for (const [locale, dir] of LOCALES) {
  for (const group of GROUPS) {
    test(`gallery ${group} · ${locale} renders without overflow and passes axe`, async ({ page }) => {
      await page.goto(`/${locale}/dev-gallery/${group}`);
      await expect(page.locator('html')).toHaveAttribute('dir', dir);
      await expect(page.locator('[data-gallery-section]').first()).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, 'horizontal overflow in px').toBeLessThanOrEqual(0);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length} node(s)`)).toEqual([]);
    });
  }
}

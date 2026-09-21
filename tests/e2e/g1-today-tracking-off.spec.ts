/**
 * G1, observed at runtime (owner, Gate 0b): on B1 · Today with tracking OFF, the dose list contains
 * zero <button>, zero <input>, zero elements with an onClick handler and zero role="button".
 * Static guard 4 approximates G1; this test observes it on the real screen. It is RED until B1 exists
 * (WP4 bundle c) and the session helper exists (WP1) — a red test, never a skipped one.
 */
import { test, expect } from '@playwright/test';
import { sessionCookieFor } from './helpers/session';

test('B1 tracking off: the dose list exposes no interactive control at all', async ({ page, context, baseURL }) => {
  await context.addCookies([sessionCookieFor('hamad', new URL(baseURL ?? 'http://localhost:3100'))]);
  await page.goto('/ar/app');
  const list = page.getByTestId('dose-list');
  await expect(list).toBeVisible();
  await expect(list.getByTestId('dose-row')).toHaveCount(6); // حمد, 2026-09-21: six rows, four time groups
  await expect(list.locator('button')).toHaveCount(0);
  await expect(list.locator('input')).toHaveCount(0);
  await expect(list.locator('[role="button"]')).toHaveCount(0);
  const withOnClick = await list.evaluate((root) =>
    Array.from(root.querySelectorAll('*')).filter((el) => {
      const props = Object.keys(el).find((k) => k.startsWith('__reactProps$'));
      return (props && (el as unknown as Record<string, { onClick?: unknown }>)[props]?.onClick) || el.hasAttribute('onclick');
    }).length,
  );
  expect(withOnClick).toBe(0);
  await expect(list.getByTestId('status-pill')).toHaveCount(0);
});

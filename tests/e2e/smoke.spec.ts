import { test, expect } from '@playwright/test';

test('the root redirects to the default locale and sets dir=rtl', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/ar$/);
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
});

test('the English locale sets dir=ltr and serves the manifest', async ({ page, request }) => {
  await page.goto('/en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  const manifest = await request.get('/manifest.webmanifest');
  expect(manifest.ok()).toBeTruthy();
  const body = await manifest.json();
  expect(body.dir).toBe('rtl');
});

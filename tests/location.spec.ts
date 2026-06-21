import { test, expect } from '@playwright/test';

test('english location renders beaches gallery with headings and captions', async ({ page }) => {
  await page.goto('/en/location');
  await expect(page.getByRole('heading', { name: 'Sivota' }).first()).toBeVisible();
  await expect(page.locator('#gallery figure')).toHaveCount(12);
  await expect(page.locator('#gallery h4').filter({ hasText: 'Agia Paraskevi' })).toBeVisible();
  // caption is carried on the anchor for the lightbox
  const first = page.locator('#gallery a').first();
  await expect(first).toHaveAttribute('data-pswp-caption', /Agia Paraskevi/);
});

test('greek location uses translated beach names', async ({ page }) => {
  await page.goto('/gr/location');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.locator('#gallery h4').filter({ hasText: 'Αγία Παρασκευή' })).toBeVisible();
});

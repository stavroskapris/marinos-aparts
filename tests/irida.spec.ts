import { test, expect } from '@playwright/test';

test('english irida renders title, facilities, and 15-image gallery', async ({ page }) => {
  await page.goto('/en/irida');
  await expect(page.getByRole('heading', { name: 'Irida Resort' }).first()).toBeVisible();
  await expect(page.getByText('Free wi-fi Internet')).toBeVisible();
  await expect(page.locator('#gallery figure')).toHaveCount(15);
  await expect(page.locator('.tm-main-nav li.nav-item').filter({ hasText: 'Irida Resort' })).toHaveClass(/active/);
});

test('greek irida sets lang and translated main', async ({ page }) => {
  await page.goto('/gr/irida');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Παροχές')).toBeVisible();
});

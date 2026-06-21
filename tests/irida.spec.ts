import { test, expect } from '@playwright/test';

test('english irida renders title, facilities, and 15-image gallery', async ({ page }) => {
  await page.goto('/en/irida');
  await expect(page.getByRole('heading', { name: 'Irida Resort' }).first()).toBeVisible();
  await expect(page.getByText('Free wi-fi Internet')).toBeVisible();
  await expect(page.locator('#gallery figure')).toHaveCount(15);
  await expect(page.locator('.tm-main-nav li.nav-item').filter({ hasText: 'Irida Resort' })).toHaveClass(/active/);
  // irida-specific facility must be present
  await expect(page.getByText('Built-in closets')).toBeVisible();
  // kimon-only facilities must be absent on irida
  await expect(page.getByText('Big yard')).toHaveCount(0);
  await expect(page.getByText('Private parking with cover')).toHaveCount(0);
});

test('greek irida sets lang and translated main', async ({ page }) => {
  await page.goto('/gr/irida');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Παροχές')).toBeVisible();
});

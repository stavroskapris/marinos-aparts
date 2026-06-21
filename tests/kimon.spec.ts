import { test, expect } from '@playwright/test';

test('english kimon renders title, facilities, and gallery', async ({ page }) => {
  await page.goto('/en/kimon');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Kimon Resort' }).first()).toBeVisible();
  await expect(page.getByText('Free wi-fi Internet')).toBeVisible();           // a facility
  await expect(page.locator('#gallery figure')).toHaveCount(20);               // 20 kimon images
  await expect(page.locator('.tm-main-nav li.nav-item').filter({ hasText: 'Kimon Resort' })).toHaveClass(/active/);
});

test('greek kimon renders translated facilities', async ({ page }) => {
  await page.goto('/gr/kimon');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Δωρεάν wi-fi Internet')).toBeVisible();
});

test('kimon gallery opens PhotoSwipe on click', async ({ page }) => {
  await page.goto('/en/kimon');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();                            // v5 injects .pswp on open
});

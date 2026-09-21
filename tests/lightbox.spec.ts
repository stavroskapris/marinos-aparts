import { test, expect } from '@playwright/test';

test('lightbox shows a fullscreen toggle button', async ({ page }) => {
  await page.goto('/en/kimon');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  await expect(page.locator('.pswp__button--fs')).toBeVisible();
});

test('location lightbox caption renders bottom-anchored and readable', async ({ page }) => {
  await page.goto('/en/location');
  await page.locator('#gallery a').first().click();
  const caption = page.locator('.pswp__custom-caption');
  await expect(caption).toBeVisible();
  await expect(caption).toContainText('Agia Paraskevi');
  const box = await caption.boundingBox();
  const vp = page.viewportSize();
  expect(box!.y).toBeGreaterThan(vp!.height / 2);
});

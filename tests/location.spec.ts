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

test('location lightbox caption renders anchored at the bottom and is readable', async ({ page }) => {
  await page.goto('/en/location');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();

  const caption = page.locator('.pswp__custom-caption');
  await expect(caption).toBeVisible();
  await expect(caption).toContainText('Agia Paraskevi');

  // Legacy parity: the caption is a bottom bar, not overlapping the top toolbar.
  const box = await caption.boundingBox();
  const vp = page.viewportSize();
  expect(box).not.toBeNull();
  expect(box!.y).toBeGreaterThan(vp!.height / 2);

  // The top-bar close button stays visible and unobstructed.
  await expect(page.locator('.pswp__button--close')).toBeVisible();
});

test('greek location uses translated beach names', async ({ page }) => {
  await page.goto('/gr/location');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.locator('#gallery h4').filter({ hasText: 'Αγία Παρασκευή' })).toBeVisible();
});

import { test, expect } from '@playwright/test';

test('exactly one display face is active at a time', async ({ page }) => {
  await page.goto('/en/');
  const toggle = page.locator('[data-type-toggle]');
  if ((await toggle.count()) === 0) return; // toggle already removed, fine

  const serifFont = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  await page.getByRole('button', { name: 'Sans' }).click();
  const sansFont = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(sansFont).not.toBe(serifFont);
  expect(sansFont).toMatch(/Manrope/);

  await page.getByRole('button', { name: 'Serif' }).click();
  const back = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(back).toBe(serifFont);
});

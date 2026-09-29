import { test, expect } from '@playwright/test';

test('exactly one display face is active at a time', async ({ page }) => {
  await page.goto('/en/');
  const toggle = page.locator('[data-type-toggle]');
  test.skip((await toggle.count()) === 0, 'toggle removed');

  const h1 = page.locator('h1');
  const serif = page.getByRole('button', { name: 'Serif' });
  const sans = page.getByRole('button', { name: 'Sans' });

  const serifFont = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(serifFont).toMatch(/Garamond/);
  await expect(serif).toHaveAttribute('aria-pressed', 'true');

  await sans.click();
  const sansFont = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(sansFont).not.toBe(serifFont);
  expect(sansFont).toMatch(/Manrope/);
  await expect(sans).toHaveAttribute('aria-pressed', 'true');
  await expect(serif).toHaveAttribute('aria-pressed', 'false');

  await serif.click();
  const back = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(back).toBe(serifFont);
  await expect(serif).toHaveAttribute('aria-pressed', 'true');
});

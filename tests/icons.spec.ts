import { test, expect } from '@playwright/test';

test('no Font Awesome request is made on any page', async ({ page }) => {
  const thirdParty: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('fontawesome')) thirdParty.push(r.url());
  });

  for (const path of ['/en/', '/en/kimon/', '/en/location/', '/en/contact/', '/gr/']) {
    await page.goto(path);
  }
  expect(thirdParty).toEqual([]);
});

test('no leftover <i class="fa"> markup remains', async ({ page }) => {
  await page.goto('/en/contact/');
  expect(await page.locator('i[class*="fa-"]').count()).toBe(0);
});

test('social icons keep their accessible names', async ({ page }) => {
  await page.goto('/en/contact/');
  await expect(page.getByLabel('Marinos Apartments on Facebook')).toBeVisible();
  await expect(page.getByLabel('Marinos Apartments on Instagram')).toBeVisible();
});

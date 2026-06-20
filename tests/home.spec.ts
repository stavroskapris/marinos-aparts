import { test, expect } from '@playwright/test';

test('site builds and serves the english home route', async ({ page }) => {
  const response = await page.goto('/en/');
  expect(response?.status()).toBe(200);
});

test('html lang attribute and GA4 are present on english home', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const ga = page.locator('script[src*="googletagmanager.com/gtag/js?id=G-7PRPXQ745M"]');
  await expect(ga).toHaveCount(1);
});

test('hreflang alternates point to per-locale urls', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('link[rel="alternate"][hreflang="gr"]')).toHaveAttribute('href', /\/gr\/$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/$/);
});

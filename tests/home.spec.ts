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

test('navbar links are locale-prefixed', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a.tm-site-logo')).toHaveAttribute('href', '/en/');
  await expect(page.getByRole('link', { name: 'Kimon Resort' }).first()).toHaveAttribute('href', '/en/kimon');
});

test('language switcher links to the same page in the other locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a[data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/');
  await page.locator('a[data-lang-switch="gr"]').click();
  await expect(page).toHaveURL(/\/gr\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
});

test('scroll-to-top button exists', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a.scroll-top')).toHaveCount(1);
});

test('footer shows current year and registry number', async ({ page }) => {
  await page.goto('/en/');
  const year = new Date().getFullYear().toString();
  await expect(page.locator('#current-year')).toHaveText(year);
  await expect(page.locator('.tm-copyright-text')).toContainText('General Registry Number');
});

test('leaflet map initializes in the footer', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#osm-map .leaflet-container')).toBeVisible();
});

test('weather widget container renders for the locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#weather-widget')).toBeVisible();
});

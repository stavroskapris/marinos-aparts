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
  await expect(page.locator('link[rel="alternate"][hreflang="el"]')).toHaveAttribute('href', /\/gr\/$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/$/);
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /\/en\/$/);
});

test('navbar links are locale-prefixed', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('[data-nav] .navbar__logo')).toHaveAttribute('href', '/en/');
  await expect(page.getByRole('link', { name: 'Kimon Resort' }).first()).toHaveAttribute('href', '/en/kimon');
});

test('language switcher links to the same page in the other locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('[data-nav] [data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/');
  await page.locator('[data-nav] [data-lang-switch="gr"]').click();
  await expect(page).toHaveURL(/\/gr\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');
});

test('scroll-to-top button exists', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('button.scroll-top')).toHaveCount(1);
});

test('footer shows current year and registry number', async ({ page }) => {
  await page.goto('/en/');
  const year = new Date().getFullYear().toString();
  await expect(page.locator('#current-year')).toHaveText(year);
  await expect(page.getByText('General Registry Number')).toBeVisible();
});

test('leaflet map initializes in the footer', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#osm-map.leaflet-container')).toBeVisible();
});

test('weather widget container renders for the locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#weather-widget')).toBeVisible();
});

test('english home renders intro, welcome, and both resort cards', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByRole('heading', { level: 1, name: /Marinos Aparts/ }).first()).toBeVisible();
  await expect(page.getByText('thirty years of hospitality').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kimon Resort' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Irida Resort' })).toBeVisible();
  await expect(page.locator('img[src*="kimon-home"], img[src*="kimon/kimon-home"]')).toHaveCount(1);
});

test('greek home renders translated welcome copy', async ({ page }) => {
  await page.goto('/gr/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');
  await expect(page.getByText('Read More')).toHaveCount(0); // EN-only string absent
  await expect(page.getByText('Περισσότερα')).toHaveCount(2); // GR read-more buttons present (Kimon + Irida)
});

test('mobile hamburger toggles the nav menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/en/');
  const menu = page.locator('[data-nav-menu]');
  await expect(menu).not.toHaveClass(/is-open/);
  await page.locator('[data-nav-toggle]').click();
  await expect(menu).toHaveClass(/is-open/);
  await expect(page.locator('[data-nav-toggle]')).toHaveAttribute('aria-expanded', 'true');
});

test('home nav item is active on the home page', async ({ page }) => {
  await page.goto('/en/');
  const items = page.locator('.navbar__link');
  await expect(items.filter({ hasText: 'Home' })).toHaveClass(/is-active/);
  await expect(items.filter({ hasText: 'Kimon Resort' })).not.toHaveClass(/is-active/);
});

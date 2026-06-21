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
  await expect(page.locator('link[rel="alternate"][hreflang="x-default"]')).toHaveAttribute('href', /\/en\/$/);
});

test('navbar links are locale-prefixed', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a.tm-site-logo')).toHaveAttribute('href', '/en/');
  await expect(page.getByRole('link', { name: 'Kimon Resort' }).first()).toHaveAttribute('href', '/en/kimon');
});

test('language switcher links to the same page in the other locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('.languagepicker a[data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/');
  await page.locator('.languagepicker a[data-lang-switch="gr"]').click();
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
  await expect(page.locator('#osm-map.leaflet-container')).toBeVisible();
});

test('weather widget container renders for the locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#weather-widget')).toBeVisible();
});

test('english home renders intro, welcome, and both resort cards', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('h2.tm-title')).toContainText('Marinos Aparts');
  await expect(page.locator('p').filter({ hasText: 'Welcome to Marinos-aparts Rooms in Sivota' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kimon Resort' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Irida Resort' })).toBeVisible();
  await expect(page.locator('img[src*="kimon-home"], img[src*="kimon/kimon-home"]')).toHaveCount(1);
});

test('greek home renders translated welcome copy', async ({ page }) => {
  await page.goto('/gr/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Read More')).toHaveCount(0); // EN-only string absent
  await expect(page.getByText('Περισσότερα')).toHaveCount(2); // GR read-more buttons present (Kimon + Irida)
});

test('mobile hamburger toggles the nav menu', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto('/en/');
  const menu = page.locator('#tmNavbar');
  await expect(menu).not.toHaveClass(/\bin\b/);
  await page.locator('.tm-main-nav .navbar-toggler').click();
  await expect(menu).toHaveClass(/\bin\b/);
  await expect(page.locator('.tm-main-nav .navbar-toggler')).toHaveAttribute('aria-expanded', 'true');
});

test('home nav item is active on the home page', async ({ page }) => {
  await page.goto('/en/');
  const items = page.locator('.tm-main-nav li.nav-item');
  await expect(items.filter({ hasText: 'Home' })).toHaveClass(/active/);
  await expect(items.filter({ hasText: 'Kimon Resort' })).not.toHaveClass(/active/);
});

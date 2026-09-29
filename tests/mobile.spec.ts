import { test, expect } from '@playwright/test';

const ROUTES = ['/en/', '/gr/', '/en/kimon', '/gr/kimon', '/en/irida', '/gr/irida', '/en/location', '/gr/location', '/en/contact', '/gr/contact'];

test('no horizontal overflow at mobile width (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const offenders: string[] = [];
  for (const route of ROUTES) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) offenders.push(`${route}: ${overflow}px`);
  }
  expect(offenders, `pages overflowing at 390px: ${offenders.join(', ')}`).toHaveLength(0);
});

test('language switcher: shown inline on desktop, inside the menu on mobile', async ({ page }) => {
  // desktop: switcher visible without opening anything, no menu toggle
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/');
  await expect(page.locator('[data-nav] .navbar__lang').first()).toBeVisible();
  await expect(page.locator('[data-nav-toggle]')).toBeHidden();

  // mobile: switcher hidden until the menu opens, then both locale links present
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');
  await expect(page.locator('[data-nav] .navbar__lang').first()).toBeHidden();
  await page.locator('[data-nav-toggle]').click();
  const menuLinks = page.locator('[data-nav-menu] .navbar__lang');
  await expect(menuLinks).toHaveCount(2);
  await expect(menuLinks.first()).toBeVisible();
  await expect(menuLinks.first()).toHaveAttribute('href', /\/(en|gr)\//);
});

test('language switcher emits valid list-item markup', async ({ page }) => {
  await page.goto('/en/');
  // each item is a valid <li><a>, and no link is nested inside another link
  await expect(page.locator('[data-nav] ul.navbar__langs > li > a')).toHaveCount(2);
  await expect(page.locator('[data-nav] a a')).toHaveCount(0);
});

test('mobile: nav toggle, language switch, gallery open all work at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // nav toggle
  await page.goto('/en/kimon');
  const menu = page.locator('[data-nav-menu]');
  await page.locator('[data-nav-toggle]').click();
  await expect(menu).toBeVisible();

  // language switch via the in-menu mobile switcher
  await page.locator('[data-nav-menu] [data-lang-switch="gr"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'el');

  // gallery opens on mobile
  await page.goto('/en/location');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
});

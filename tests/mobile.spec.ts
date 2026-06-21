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

test('language switcher: desktop picker hidden on mobile, in-menu switcher shown', async ({ page }) => {
  // desktop: flag picker visible, in-menu switcher hidden
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/');
  await expect(page.locator('.languagepicker')).toBeVisible();
  await expect(page.locator('#toggle-js-langmenu')).toBeHidden();

  // mobile: flag picker hidden, in-menu switcher present with both locale links
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');
  await expect(page.locator('.languagepicker')).toBeHidden();
  const menuLinks = page.locator('#toggle-js-langmenu a');
  await expect(menuLinks).toHaveCount(2);
  await expect(menuLinks.first()).toHaveAttribute('href', /\/(en|gr)\//);
});

test('LangSwitcher emits valid li-inside-a-free markup', async ({ page }) => {
  await page.goto('/en/');
  // the picker anchors wrap an <li>; assert the corrected nesting <li><a>
  await expect(page.locator('.languagepicker li a img')).toHaveCount(2);
});

test('mobile: nav toggle, language switch, gallery open all work at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // nav toggle
  await page.goto('/en/kimon');
  const menu = page.locator('#tmNavbar');
  await page.locator('.navbar-toggler').click();
  await expect(menu).toBeVisible();

  // language switch via the in-menu mobile switcher
  await page.locator('#toggle-js-langmenu a[data-lang-switch="gr"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');

  // gallery opens on mobile
  await page.goto('/en/location');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
});

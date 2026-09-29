import { test, expect } from '@playwright/test';

const WIDTHS = [1440, 1280, 1100, 900, 390];

test('Greek navigation never overflows its container at any width', async ({ page }) => {
  // Greek runs 15-30% longer than English. A nav tuned to the English copy
  // clips or wraps on /gr/ and nothing in an English-only test would catch it.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/gr/');

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);

    const menuHidden = await page.locator('[data-nav-menu]').evaluate(
      (el) => getComputedStyle(el).display === 'none'
    );
    if (menuHidden) continue; // collapsed into the mobile menu, nothing to measure

    for (const link of await page.locator('.navbar__link').all()) {
      const box = await link.boundingBox();
      expect(box, 'nav link has no box').not.toBeNull();
      // One line: a wrapped nav item is the visible symptom of overflow.
      expect(box!.height, `nav link wrapped at ${width}px`).toBeLessThan(60);
    }
  }
});

test('every nav link is reachable and visibly focused by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/');

  const first = page.locator('.navbar__link').first();
  await first.focus();
  await expect(first).toBeFocused();

  const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline, 'focused nav link has no visible outline').not.toBe('none');
});

test('the mobile menu opens, closes on Escape, and reports its state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');

  const toggle = page.locator('[data-nav-toggle]');
  const menu = page.locator('[data-nav-menu]');

  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('the language switcher keeps its path segments', async ({ page }) => {
  // `gr` is a URL segment; `el` is the language tag. Conflating them breaks
  // both the switcher and hreflang.
  await page.goto('/en/kimon/');
  await expect(page.locator('[data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/kimon/');
  await expect(page.locator('[data-lang-switch="gr"]')).toHaveAttribute('hreflang', 'el');
});

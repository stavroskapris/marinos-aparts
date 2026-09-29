import { test, expect } from '@playwright/test';

test('content is visible when JavaScript is disabled', async ({ browser }) => {
  // The failure this guards: hiding [data-reveal] unconditionally in CSS,
  // which leaves a script-blocked visitor staring at an empty page.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/');

  const revealables = page.locator('[data-reveal]');
  const count = await revealables.count();
  for (let i = 0; i < count; i++) {
    await expect(revealables.nth(i)).toBeVisible();
  }
  await context.close();
});

test('reveal applies when JavaScript runs', async ({ page }) => {
  await page.goto('/en/');
  const first = page.locator('[data-reveal]').first();
  await expect(first).toHaveClass(/is-revealed/);
});

test('reduced motion reveals everything immediately and animates nothing', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/en/');

  const revealables = page.locator('[data-reveal]');
  const count = await revealables.count();
  for (let i = 0; i < count; i++) {
    const el = revealables.nth(i);
    await expect(el).toBeVisible();
    await expect(el).toHaveCSS('opacity', '1');
    await expect(el).toHaveCSS('transition-duration', /^(0s|0\.00001s|1e-05s)$/);
  }
  await context.close();
});

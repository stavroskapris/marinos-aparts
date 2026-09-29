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
    const el = revealables.nth(i);
    await expect(el).toBeVisible();
    // toBeVisible() alone treats opacity:0 as visible, so check the styles.
    await expect(el).toHaveCSS('opacity', '1');
    await expect(el).toHaveCSS('transform', 'none');
  }
  await context.close();
});

test('positive control: with JS on and the bundle blocked, reveal CSS hides content', async ({ page }) => {
  // Proves the CSS really hides under .js, so the JS-off test above is
  // distinguishing "conditional hiding" from "never hides".
  await page.route('**/_astro/**/*.js', (route) => route.abort());
  await page.route('**/_astro/*.js', (route) => route.abort());
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveClass(/(^|\s)js(\s|$)/);
  await expect(page.locator('[data-reveal]').first()).toHaveCSS('opacity', '0');
});

test('watchdog: a blocked bundle leaves content visible once it fires', async ({ page }) => {
  await page.route('**/_astro/**/*.js', (route) => route.abort());
  await page.route('**/_astro/*.js', (route) => route.abort());
  await page.goto('/en/');
  const el = page.locator('[data-reveal]').first();
  await expect(el).toHaveCSS('opacity', '0');
  await expect(page.locator('html')).not.toHaveClass(/(^|\s)js(\s|$)/, { timeout: 5000 });
  await expect(el).toHaveCSS('opacity', '1');
  await expect(el).toHaveCSS('transform', 'none');
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
    // Only the element-level disabling rule produces 'none'; the global
    // !important duration reset would give 1e-05s even without it.
    await expect(el).toHaveCSS('transition-property', 'none');
    await expect(el).toHaveCSS('transition-duration', /^(0s|0\.00001s|1e-05s)$/);
  }
  await context.close();
});

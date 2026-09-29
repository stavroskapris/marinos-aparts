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
  // One evaluate, straight after goto: the watchdog removes .js at 2500ms, so
  // separate assertions would each spend round-trips against that timer.
  const state = await page.evaluate(() => ({
    hasJs: document.documentElement.classList.contains('js'),
    opacity: getComputedStyle(document.querySelector('[data-reveal]')!).opacity,
  }));
  expect(state).toEqual({ hasJs: true, opacity: '0' });
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

test('content stays visible if reveal setup throws after signalling ready', async ({ page }) => {
  // The watchdog is disarmed once data-reveal-ready is set, so this failure
  // mode is covered only by the catch in initReveal.
  await page.addInitScript(() => {
    (window as any).IntersectionObserver = function () {
      throw new Error('boom');
    };
  });
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('data-reveal-ready', '');
  await expect(page.locator('html')).not.toHaveClass(/(^|\s)js(\s|$)/);
  const el = page.locator('[data-reveal]').first();
  await expect(el).toHaveCSS('opacity', '1');
  await expect(el).toHaveCSS('transform', 'none');
});

import { test, expect } from '@playwright/test';

test('exactly one display face is active at a time', async ({ page }) => {
  await page.goto('/en/');
  const toggle = page.locator('[data-type-toggle]');
  test.skip((await toggle.count()) === 0, 'toggle removed');

  const h1 = page.locator('h1');
  const serif = page.getByRole('button', { name: 'Serif' });
  const sans = page.getByRole('button', { name: 'Sans' });

  const serifFont = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(serifFont).toMatch(/Garamond/);
  await expect(serif).toHaveAttribute('aria-pressed', 'true');

  await sans.click();
  const sansFont = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(sansFont).not.toBe(serifFont);
  expect(sansFont).toMatch(/Manrope/);
  await expect(sans).toHaveAttribute('aria-pressed', 'true');
  await expect(serif).toHaveAttribute('aria-pressed', 'false');

  await serif.click();
  const back = await h1.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(back).toBe(serifFont);
  await expect(serif).toHaveAttribute('aria-pressed', 'true');
});

const WIDTHS = [390, 430, 768, 1280];

test('the hero reveals its content and does not overflow, in both locales', async ({ page }) => {
  for (const lang of ['en', 'gr']) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(`/${lang}/`);
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toHaveCSS('opacity', '1');
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow on /${lang}/ at ${w}px`).toBeLessThanOrEqual(0);
      // The headline must not spill out of its own container either.
      const spill = await h1.evaluate((el) =>
        el.getBoundingClientRect().right - document.documentElement.clientWidth);
      expect(spill, `headline spill on /${lang}/ at ${w}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('hero content is readable with JavaScript disabled', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/gr/');
  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();
  await expect(h1).toHaveCSS('opacity', '1');
  await expect(h1).toHaveCSS('transform', 'none');
  await ctx.close();
});

test('every home section reveals rather than staying hidden', async ({ page }) => {
  await page.goto('/en/');
  // Scroll the way a reader does. A single jump carries the viewport past
  // sections without them ever intersecting, which is not what is under test.
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.5;
    for (let y = 0; y < document.body.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(1200);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('[data-reveal]')]
      .filter((el) => getComputedStyle(el).opacity !== '1').length);
  expect(hidden, 'elements still hidden after scrolling to the bottom').toBe(0);
});

test('the photo band does not exceed the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  const wide = await page.evaluate(() =>
    [...document.images].filter((i) => i.getBoundingClientRect().width > document.documentElement.clientWidth).length);
  expect(wide).toBe(0);
});

test('the home page has one photo band and a hero', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('.photoband')).toHaveCount(1);
  await expect(page.locator('.hero')).toHaveCount(1);
});

const overlaps = (a: DOMRect | any, b: DOMRect | any) =>
  !(a.top >= b.bottom || a.bottom <= b.top || a.left >= b.right || a.right <= b.left);

test('the type toggle never covers the CTAs, and keeps 44px targets', async ({ page }) => {
  for (const lang of ['en', 'gr']) {
    for (const w of [390, 700, 860, 1280]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(`/${lang}/`);
      const boxes = await page.evaluate(() => {
        const r = (el: Element) => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, width: b.width, height: b.height }; };
        return {
          acts: r(document.querySelector('.hero__actions')!),
          toggle: r(document.querySelector('[data-type-toggle]')!),
          buttons: [...document.querySelectorAll('[data-type-toggle] button')].map(r),
        };
      });
      expect(overlaps(boxes.toggle, boxes.acts), `toggle overlaps CTAs on /${lang}/ at ${w}px`).toBe(false);
      for (const b of boxes.buttons) {
        expect(b.width, `toggle width on /${lang}/ at ${w}px`).toBeGreaterThanOrEqual(44);
        expect(b.height, `toggle height on /${lang}/ at ${w}px`).toBeGreaterThanOrEqual(44);
      }
    }
  }
});

test('the hero copy clears the navbar in both faces and locales', async ({ page }) => {
  for (const lang of ['en', 'gr']) {
    for (const face of ['Serif', 'Sans']) {
      await page.setViewportSize({ width: 390, height: 800 });
      await page.goto(`/${lang}/`);
      await page.getByRole('button', { name: face }).click();
      const { navBottom, eyebrowTop } = await page.evaluate(() => ({
        navBottom: document.querySelector('[data-nav]')!.getBoundingClientRect().bottom,
        eyebrowTop: document.querySelector('.hero .eyebrow')!.getBoundingClientRect().top,
      }));
      expect(eyebrowTop, `eyebrow under the nav on /${lang}/ (${face})`).toBeGreaterThan(navBottom);
    }
  }
});

test('the footer social links fit and keep 44px targets on a phone', async ({ page }) => {
  for (const lang of ['en', 'gr']) {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`/${lang}/`);
    const m = await page.evaluate(() => {
      const links = [...document.querySelectorAll('.footer__social a')].map((a) => {
        const r = a.getBoundingClientRect();
        return { w: r.width, h: r.height, right: r.right };
      });
      return { links, overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    expect(m.links.length).toBe(2);
    expect(m.overflow, `overflow on /${lang}/ at 390px`).toBeLessThanOrEqual(0);
    for (const l of m.links) {
      expect(l.w).toBeGreaterThanOrEqual(44);
      expect(l.h).toBeGreaterThanOrEqual(44);
      expect(l.right).toBeLessThanOrEqual(390);
    }
  }
});

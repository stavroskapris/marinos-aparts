import { test, expect } from '@playwright/test';
import { CONTACT } from '../src/site';

// 1101 is the widest layout that is still uncollapsed (the menu collapses at
// max-width 1100px), so it is where Greek labels are most cramped.
const WIDTHS = [1440, 1280, 1200, 1101, 1100, 900, 390];

test('Greek navigation never overflows or overlaps at any width', async ({ page }) => {
  // Greek runs 15-30% longer than English. A nav tuned to the English copy
  // clips or collides on /gr/ and nothing in an English-only test would catch it.
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

    const menuOverflow = await page.locator('[data-nav-menu]').evaluate(
      (el) => el.scrollWidth - el.clientWidth
    );
    expect(menuOverflow, `nav menu overflows itself at ${width}px`).toBeLessThanOrEqual(0);

    // Links, the Book button and the language links, in visual order.
    let previousRight = -Infinity;
    for (const item of await page.locator('[data-nav-menu] a').all()) {
      const box = await item.boundingBox();
      expect(box, 'nav item has no box').not.toBeNull();
      expect(box!.x + box!.width, `nav item leaves the viewport at ${width}px`).toBeLessThanOrEqual(width);
      expect(box!.x, `nav items overlap at ${width}px`).toBeGreaterThanOrEqual(previousRight - 0.5);
      previousRight = box!.x + box!.width;
    }
  }
});

test('every nav control is visibly focused by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/');

  const targets = [
    page.locator('.navbar__link').first(),
    page.locator('.navbar__lang').first(),
  ];
  for (const target of targets) {
    await target.focus();
    await expect(target).toBeFocused();
    const outline = await target.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
    });
    expect(outline.style, 'focused control has no outline').not.toBe('none');
    expect(outline.width, 'focus outline has no width').toBeGreaterThan(0);
    expect(outline.color, 'focus outline is transparent').not.toBe('transparent');
    expect(outline.color, 'focus outline is transparent').not.toMatch(/rgba\(.*,\s*0\)$/);
  }

  // The toggle only exists on the collapsed layout.
  await page.setViewportSize({ width: 390, height: 844 });
  const toggle = page.locator('[data-nav-toggle]');
  await toggle.focus();
  await expect(toggle).toBeFocused();
  const t = await toggle.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { style: cs.outlineStyle, width: parseFloat(cs.outlineWidth), color: cs.outlineColor };
  });
  expect(t.style).not.toBe('none');
  expect(t.width).toBeGreaterThan(0);
  expect(t.color).not.toBe('transparent');
  expect(t.color).not.toMatch(/rgba\(.*,\s*0\)$/);
});

test('every interactive nav element is at least 44px in both dimensions at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');
  await page.locator('[data-nav-toggle]').click();

  for (const el of await page.locator('[data-nav] a, [data-nav] button').all()) {
    const box = await el.boundingBox();
    const name = await el.evaluate((e) => e.getAttribute('aria-label') ?? e.textContent?.trim() ?? e.tagName);
    expect(box, `${name} has no box`).not.toBeNull();
    expect(box!.width, `${name} is narrower than 44px`).toBeGreaterThanOrEqual(44);
    expect(box!.height, `${name} is shorter than 44px`).toBeGreaterThanOrEqual(44);
  }
});

for (const lang of ['en', 'gr']) {
  test(`the mobile menu opens, closes on Escape, and reports its state on /${lang}/`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/${lang}/`);

    const toggle = page.locator('[data-nav-toggle]');
    const menu = page.locator('[data-nav-menu]');

    await expect(toggle).toHaveAttribute('aria-label', lang === 'gr' ? 'Μενού' : 'Menu');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(menu).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(toggle).toBeFocused();
  });
}

test('the language switcher keeps its path segments', async ({ page }) => {
  // `gr` is a URL segment; `el` is the language tag. Conflating them breaks
  // both the switcher and hreflang.
  await page.goto('/en/kimon/');
  await expect(page.locator('[data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/kimon/');
  await expect(page.locator('[data-lang-switch="gr"]')).toHaveAttribute('hreflang', 'el');
});

test('the footer keeps its contact details and legal text', async ({ page }) => {
  await page.goto('/en/');
  const footer = page.locator('footer.footer');
  await expect(footer.getByRole('link', { name: CONTACT.phone })).toBeVisible();
  await expect(footer.getByRole('link', { name: CONTACT.email })).toBeVisible();
  await expect(footer.getByText(/Marinos-Aparts/)).toBeVisible();
  await expect(footer.getByText('General Registry Number')).toBeVisible();
  await expect(footer.getByRole('link', { name: 'stavroskapris' })).toBeVisible();
  await expect(footer.locator('#osm-map')).toHaveCSS('height', '280px');
});

test('scroll to top is a button, appears past 500px and does not dirty the URL', async ({ page }) => {
  await page.goto('/en/');
  const btn = page.getByRole('button', { name: 'Scroll to top' });
  await expect(btn).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(btn).toBeVisible();

  await btn.click();
  expect(new URL(page.url()).hash).toBe('');
});

for (const lang of ['en', 'gr']) {
  for (const width of [390, 430, 768, 1280]) {
    test(`the footer does not overflow horizontally at ${width}px on /${lang}/`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/${lang}/`);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

const PAGES = ['/en/', '/en/kimon/', '/en/irida/', '/en/location/', '/en/contact/',
               '/gr/', '/gr/kimon/', '/gr/irida/', '/gr/location/', '/gr/contact/'];

test('no Bootstrap or templatemo classes survive on any page', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const stale = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll('[class]'))) {
        for (const cls of Array.from(el.classList)) {
          if (/^(col-|row$|container-fluid$|tm-|navbar-toggleable|img-fluid|img-rounded|text-xs-|hidden-md-up)/.test(cls)) {
            bad.push(cls);
          }
        }
      }
      return Array.from(new Set(bad));
    });
    expect(stale, `stale framework classes on ${path}`).toEqual([]);
  }
});

for (const width of [320, 390, 768, 1280]) {
  test(`no page scrolls horizontally at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    for (const path of PAGES) {
      await page.goto(path);
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth
      );
      expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
    }
  });
}

test('no image is wider than the viewport on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of PAGES) {
    await page.goto(path);
    const wide = await page.evaluate(() =>
      Array.from(document.querySelectorAll('img'))
        .filter((img) => img.getBoundingClientRect().width > window.innerWidth)
        .map((img) => img.currentSrc || img.src)
    );
    expect(wide, `images wider than the viewport on ${path}`).toEqual([]);
  }
});

test('every interactive element is at least 44px tall and wide on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of PAGES) {
    await page.goto(path);
    const small = await page.evaluate(() => {
      const out: string[] = [];
      const sel = 'a[href], button, input:not([type=hidden]), textarea, select, [role=button]';
      for (const el of Array.from(document.querySelectorAll<HTMLElement>(sel))) {
        // Third-party embeds (reCAPTCHA, Leaflet's own zoom and attribution controls) are not ours to size.
        if (el.closest('.g-recaptcha, .leaflet-container, .visually-hidden, .skip-link')) continue;
        if (el.matches('.skip-link, .visually-hidden')) continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // not rendered
        // Inline text links inside a sentence are exempt (WCAG 2.5.8 inline exception).
        const inline = getComputedStyle(el).display === 'inline' && !!el.closest('p, li, span, h1, h2, h3, h4, h5');
        if (inline) continue;
        if (r.width < 43.5 || r.height < 43.5) {
          out.push(`${el.tagName.toLowerCase()}.${el.className || ''} "${(el.textContent || '').trim().slice(0, 20)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    expect(small, `undersized touch targets on ${path}`).toEqual([]);
  }
});

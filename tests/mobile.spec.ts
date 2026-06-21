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

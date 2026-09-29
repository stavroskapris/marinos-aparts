import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONTACT } from './site';

test('the phone href is the dialable form of the displayed number', () => {
  expect(CONTACT.phoneHref).toBe(`tel:${CONTACT.phone.replace(/\s/g, '')}`);
  expect(CONTACT.emailHref).toBe(`mailto:${CONTACT.email}`);
});

test('no phone number is hardcoded outside src/site.ts', () => {
  // The defect this prevents: header, footer and JSON-LD drifting apart, which
  // is how the site came to advertise two different numbers at once.
  const files = [
    'src/layouts/BaseLayout.astro',
    'src/components/HeaderBottom.astro',
    'src/components/Footer.astro',
    'src/i18n/en.json',
    'src/i18n/gr.json',
  ];
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    expect(text, `${path} hardcodes a phone number`).not.toMatch(/\+30[-\s]?\d{4}[-\s]?\d{3}[-\s]?\d{3}/);
  }
});

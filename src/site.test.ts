import { test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { CONTACT } from './site';

test('the phone href is a dialable tel: URI carrying the displayed digits', () => {
  expect(CONTACT.phoneHref).toMatch(/^tel:\+\d+$/);
  expect(CONTACT.phoneHref.slice(4).replace(/\D/g, '')).toBe(CONTACT.phone.replace(/\D/g, ''));
  expect(CONTACT.emailHref).toBe(`mailto:${CONTACT.email}`);
});

// The only long digit runs that may live in source: the two General Registry
// (GEMI) identifiers quoted in the footer copy. They are business registration
// numbers, not phone numbers. Listed exactly so nothing else is loosened.
const KNOWN_IDENTIFIERS = ['019630328004', '019630328000'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(e.parentPath ?? e.path, e.name).replace(/\\/g, '/'))
    .filter((p) => /\.(astro|ts|json)$/.test(p))
    .filter((p) => !/\.test\.ts$/.test(p) && !p.endsWith('src/site.ts'));
}

// A run of digit groups (each 2+ digits) joined by single spaces or hyphens,
// optionally with a leading + and parentheses. Totalling 10+ digits, it reads
// as a phone number whatever its prefix or grouping, landlines included.
const DIGIT_RUN = /(?<!\d)\(?\+?\d{2,}\)?(?:[-\s]\(?\d{2,}\)?)*/g;

function phoneLike(text: string): string[] {
  let cleaned = text;
  for (const id of KNOWN_IDENTIFIERS) cleaned = cleaned.split(id).join('');
  return (cleaned.match(DIGIT_RUN) ?? []).filter((m) => m.replace(/\D/g, '').length >= 10);
}

test('the guard recognises phone numbers however they are written', () => {
  for (const sample of ['+30 6909 025 820', '+30 69 0902 5820', '0030 6909025820', '(+30) 6909 025 820', '26650 12345', '2665-012-345', '6909025820']) {
    expect(phoneLike(sample), sample).not.toEqual([]);
  }
  expect(phoneLike('KIMON 019630328004 | 019630328000')).toEqual([]);
  expect(phoneLike('M0 6-8 12-8 12 M8 8 0 0 1 16 0 rgb(255 255 255)')).toEqual([]);
});

test('no phone number is hardcoded anywhere in src outside src/site.ts', () => {
  // The defect this prevents: header, footer and JSON-LD drifting apart, which
  // is how the site came to advertise two different numbers at once.
  const files = sourceFiles('src');
  expect(files.length).toBeGreaterThan(20);
  for (const path of files) {
    expect(phoneLike(readFileSync(path, 'utf8')), `${path} hardcodes a phone number`).toEqual([]);
  }
});

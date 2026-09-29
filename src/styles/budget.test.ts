import { test, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Always build into a private directory: a pre-existing dist/ may be stale or
// partial, and other test files build into dist/ concurrently.
let out = '';
let fontBytes = 0;
let ownBytes = 0;
const ownFiles: string[] = [];
const vendorFiles: string[] = [];
let sawTokens = false;
// Bundles are told apart by content, not by the hashed filename. Vendor CSS
// (Leaflet, PhotoSwipe) is recognised by its selectors; everything else is
// ours, and must include the bundle that defines our design tokens.
const isVendor = (css: string) => /\.leaflet-|\.pswp/.test(css) && !css.includes('--sp-3:');
beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'budget-test-'));
  execSync(`npx astro build --outDir ${out}`, { stdio: 'ignore' });
  const dir = `${out}/_astro`;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css'))) {
    const css = readFileSync(`${dir}/${f}`, 'utf8');
    if (isVendor(css)) {
      vendorFiles.push(f);
      continue;
    }
    if (css.includes('--sp-3:')) sawTokens = true;
    const faces = (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).join('').length;
    fontBytes += faces;
    ownBytes += css.length - faces;
    ownFiles.push(f);
  }
}, 180_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

// These are ratchets: if a change needs more, the number moves deliberately
// and the commit says why. Only CSS we author is budgeted: vendor bundles
// (Leaflet, PhotoSwipe) move with their package versions, not with our code.
// The font @font-face rules are measured apart because they scale with the
// subsets we ship, and would otherwise hide growth in what we author.
// Measured when set: authored CSS 13.1KB, font-face rules 7.2KB.
test('the authored-CSS bundle was identified', () => {
  expect(sawTokens, 'no CSS bundle contains our design tokens (--sp-3)').toBe(true);
  expect(ownFiles.length).toBeGreaterThan(0);
});

test('our own authored CSS stays within budget', () => {
  const kb = ownBytes / 1024;
  expect(
    kb,
    `authored CSS is ${kb.toFixed(1)}KB across [${ownFiles.join(', ')}] (vendor, not counted: [${vendorFiles.join(', ')}])`,
  ).toBeLessThan(16);
});

test('the Fontsource @font-face CSS stays within budget', () => {
  const kb = fontBytes / 1024;
  expect(kb, `font @font-face CSS is ${kb.toFixed(1)}KB across [${ownFiles.join(', ')}]`).toBeLessThan(9);
});

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
beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'budget-test-'));
  execSync(`npx astro build --outDir ${out}`, { stdio: 'ignore' });
  const dir = `${out}/_astro`;
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.css'))) {
    const css = readFileSync(`${dir}/${f}`, 'utf8');
    const faces = (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).join('').length;
    fontBytes += faces;
    ownBytes += css.length - faces;
  }
}, 180_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

// These are ratchets: if a change needs more, the number moves deliberately
// and the commit says why. Bootstrap alone was 95KB of a ~125KB payload.
// The two are measured apart because the font @font-face rules scale with the
// subsets we ship, and would otherwise hide growth in what we author.
// Measured when set: own CSS 32.9KB, font-face rules 7.2KB.
test('our own built CSS stays within budget', () => {
  const kb = ownBytes / 1024;
  expect(kb, `own CSS is ${kb.toFixed(1)}KB`).toBeLessThan(36);
});

test('the Fontsource @font-face CSS stays within budget', () => {
  const kb = fontBytes / 1024;
  expect(kb, `font CSS is ${kb.toFixed(1)}KB`).toBeLessThan(9);
});

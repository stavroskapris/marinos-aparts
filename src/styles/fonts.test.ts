import { test, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Always rebuild, into a private directory: a stale dist/ could make these
// assertions pass or fail against an old build, and other test files build
// into dist/ concurrently.
let css = '';
let out = '';
beforeAll(() => {
  out = mkdtempSync(join(tmpdir(), 'fonts-test-'));
  execSync(`npx astro build --outDir ${out}`, { stdio: 'ignore' });
  const cssDir = `${out}/_astro`;
  css = readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(`${cssDir}/${f}`, 'utf8'))
    .join('\n');
}, 180_000);

afterAll(() => rmSync(out, { recursive: true, force: true }));

// Read the first family of each stack out of tokens.css, so this test and the
// token file cannot drift apart. Only that first entry is actually installed;
// the later fallbacks are not.
function primaryFamily(token: string): string {
  const tokens = readFileSync('src/styles/tokens.css', 'utf8');
  const m = tokens.match(new RegExp(`${token}:\\s*['"]([^'"]+)['"]`));
  if (!m) throw new Error(`cannot find ${token} in tokens.css`);
  return m[1];
}

function fontFaces(family: string): string[] {
  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) ?? [];
  return blocks.filter((b) =>
    new RegExp(`font-family:\\s*['"]?${family}['"]?\\s*[;}]`, 'i').test(b),
  );
}

test.each(['--font-display', '--font-body'])(
  '%s: the exact family named in tokens.css ships a Greek face',
  (token) => {
    const family = primaryFamily(token);
    const faces = fontFaces(family);
    expect(faces.length, `no @font-face named "${family}" in built CSS`).toBeGreaterThan(0);
    // U+0370 starts the Greek and Coptic block. Without a face declaring it,
    // /gr/ silently renders in a system fallback.
    expect(
      faces.some((b) => /unicode-range:[^;]*U\+0370/i.test(b)),
      `no Greek unicode-range for "${family}"`,
    ).toBe(true);
  },
);

test('no Google Fonts CDN reference in either locale or any built CSS', () => {
  const sources: Record<string, string> = {
    'en/index.html': readFileSync(join(out, 'en/index.html'), 'utf8'),
    'gr/index.html': readFileSync(join(out, 'gr/index.html'), 'utf8'),
    'built CSS': css,
  };
  for (const [name, text] of Object.entries(sources)) {
    expect(text, `${name} references fonts.googleapis.com`).not.toContain('fonts.googleapis.com');
    expect(text, `${name} references fonts.gstatic.com`).not.toContain('fonts.gstatic.com');
  }
});

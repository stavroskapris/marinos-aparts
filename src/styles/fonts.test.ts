import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

function builtCss(): string {
  if (!existsSync('dist')) execSync('npm run build', { stdio: 'inherit' });
  const cssDir = 'dist/_astro';
  return readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(`${cssDir}/${f}`, 'utf8'))
    .join('\n');
}

// Split the built CSS into @font-face blocks so each family can be checked
// for its own Greek face, rather than one family satisfying the assertion
// for both.
function fontFaces(css: string, family: RegExp): string[] {
  return (css.match(/@font-face\s*\{[^}]*\}/g) ?? []).filter((b) => family.test(b));
}

test('the built CSS ships Greek glyphs for both families', () => {
  const css = builtCss();
  for (const family of [/font-family:\s*['"]?EB Garamond/i, /font-family:\s*['"]?Manrope/i]) {
    const faces = fontFaces(css, family);
    expect(faces.length, `no @font-face for ${family}`).toBeGreaterThan(0);
    // U+0370 starts the Greek and Coptic block. Without a face declaring it,
    // /gr/ silently renders in a system fallback.
    expect(
      faces.some((b) => /unicode-range:[^;]*U\+0370/i.test(b)),
      `no Greek unicode-range for ${family}`,
    ).toBe(true);
  }
}, 180_000);

test('no Google Fonts CDN request remains', () => {
  builtCss();
  const html = readFileSync('dist/en/index.html', 'utf8');
  expect(html).not.toContain('fonts.googleapis.com');
  expect(html).not.toContain('fonts.gstatic.com');
});

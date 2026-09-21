import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

test('build emits no prod-hardcoded redirect stub at the root', () => {
  execSync('npm run build', { stdio: 'inherit' });
  // With the redirects block removed, Astro generates no root index.html stub.
  // If one exists, it must NOT be a meta-refresh to the absolute prod URL.
  if (existsSync('dist/index.html')) {
    const html = readFileSync('dist/index.html', 'utf8');
    expect(html).not.toMatch(/http-equiv="refresh"[^>]*marinos-aparts\.gr/i);
  }
  // All legacy .html redirect stubs (one per removed `redirects` entry) must be gone.
  for (const stub of ['home.html', 'kimon.html', 'irida.html', 'location.html', 'contact.html']) {
    expect(existsSync(`dist/${stub}`)).toBe(false);
  }
}, 120_000);

// Runs after the build above (vitest executes a file's tests in order), so it
// reuses dist/ rather than paying for a second build.
test('build emits the SEO assets the legacy site published', () => {
  expect(existsSync('dist/sitemap-index.xml')).toBe(true);
  expect(existsSync('dist/sitemap-0.xml')).toBe(true);
  expect(existsSync('dist/robots.txt')).toBe(true);

  const sitemap = readFileSync('dist/sitemap-0.xml', 'utf8');
  // Every route, both locales, cross-linked with a parseable language tag.
  expect(sitemap.match(/<url>/g)).toHaveLength(10);
  expect(sitemap).toContain('hreflang="el"');
  expect(sitemap).not.toContain('hreflang="gr"');
});

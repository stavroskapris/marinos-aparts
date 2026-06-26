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

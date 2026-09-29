import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';

test('the built CSS stays within budget', () => {
  if (!existsSync('dist')) execSync('npm run build', { stdio: 'inherit' });

  const dir = 'dist/_astro';
  const bytes = readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .reduce((total, f) => total + statSync(`${dir}/${f}`).size, 0);

  const kb = bytes / 1024;
  // Was ~125KB, of which bootstrap.min.css alone was 95KB. This budget is a
  // ratchet: if a change needs more, the number moves deliberately and the
  // commit says why. Measured 40.0KB when set. The total includes the Fontsource subset CSS, which
  // scales with subsets rather than with our authoring.
  expect(kb, `built CSS is ${kb.toFixed(1)}KB`).toBeLessThan(52);
}, 180_000);

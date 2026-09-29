import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const WORKFLOWS = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/deploy-prod.yml',
];

test('no workflow still runs the retired parity gates', () => {
  for (const path of WORKFLOWS) {
    const yaml = readFileSync(path, 'utf8');
    expect(yaml, `${path} still runs a parity gate`).not.toMatch(/parity:(text|images)/);
  }
});

test('package.json defines no retired parity scripts', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const name of ['parity:text', 'parity:images', 'visual:capture']) {
    expect(Object.keys(pkg.scripts)).not.toContain(name);
  }
});

test('the gates that remain run in every deploy workflow', () => {
  // These are what carries the risk once parity is gone. If one is dropped
  // from a deploy workflow, a broken build reaches S3.
  for (const path of ['.github/workflows/deploy-staging.yml', '.github/workflows/deploy-prod.yml']) {
    const yaml = readFileSync(path, 'utf8');
    expect(yaml, `${path} must run unit tests`).toMatch(/npm run test:unit/);
    expect(yaml, `${path} must run e2e tests`).toMatch(/npm test/);
    expect(yaml, `${path} must type-check`).toMatch(/astro check/);
    expect(yaml, `${path} must check links`).toMatch(/npm run check:links:ci/);
  }
});

import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

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

// Ordered `run` values of every job's steps. Parsing the YAML (rather than
// matching raw text) means a commented-out step is absent and a moved step has
// a different index, so both regressions fail the assertions below.
function runSteps(path: string): string[] {
  const doc = parse(readFileSync(path, 'utf8'));
  return Object.values<any>(doc.jobs).flatMap((job) =>
    (job.steps ?? []).map((step: any) => (typeof step.run === 'string' ? step.run.trim() : '')),
  );
}

test('the gates that remain run in every deploy workflow, before the sync', () => {
  // These carry the risk once parity is gone. A gate that is missing, disabled
  // or ordered after the sync lets a broken build reach S3.
  const GATES = ['npm run test:unit', 'npm test', 'npx astro check', 'npm run check:links:ci'];
  for (const path of ['.github/workflows/deploy-staging.yml', '.github/workflows/deploy-prod.yml']) {
    const runs = runSteps(path);
    const sync = runs.findIndex((r) => r.includes('aws s3 sync'));
    expect(sync, `${path} must have an aws s3 sync step`).toBeGreaterThan(-1);
    for (const gate of GATES) {
      const at = runs.indexOf(gate);
      expect(at, `${path} must run "${gate}" as a step`).toBeGreaterThan(-1);
      expect(at, `${path} must run "${gate}" before the sync`).toBeLessThan(sync);
    }
  }
});

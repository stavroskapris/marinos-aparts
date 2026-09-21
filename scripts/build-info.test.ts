import { test, expect } from 'vitest';
import { buildInfo } from './build-info.mjs';

const when = new Date('2026-09-21T12:00:00.000Z');

test('prefers the runner-provided values in CI', () => {
  const info = buildInfo(
    {
      GITHUB_SHA: 'abc123',
      GITHUB_REF_NAME: 'master',
      GITHUB_RUN_ID: '42',
      GITHUB_WORKFLOW: 'Deploy Production',
    },
    when,
  );
  expect(info).toEqual({
    commit: 'abc123',
    ref: 'master',
    runId: '42',
    workflow: 'Deploy Production',
    builtAt: '2026-09-21T12:00:00.000Z',
  });
});

test('falls back to git outside CI, and marks the build local', () => {
  const info = buildInfo({}, when);
  expect(info.workflow).toBe('local');
  expect(info.runId).toBeNull();
  // Resolved from the repo rather than left as a placeholder.
  expect(info.commit).toMatch(/^[0-9a-f]{40}$/);
});

test('carries nothing secret', () => {
  const serialised = JSON.stringify(
    buildInfo({ GITHUB_SHA: 'abc', AWS_SECRET_ACCESS_KEY: 'shhh', PROD_DISTRIBUTION_ID: 'E123' }, when),
  );
  expect(serialised).not.toContain('shhh');
  expect(serialised).not.toContain('E123');
});

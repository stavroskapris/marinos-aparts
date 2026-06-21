import { defineConfig } from 'vitest/config';

// Unit tests live in src/ as *.test.ts and run under Vitest.
// The Playwright e2e specs in tests/ (*.spec.ts) run under `npm test` only —
// scope Vitest to src so it does not try to collect the Playwright specs
// (which throw "test() not expected here" under the Vitest runner).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
  },
});

// Writes dist/.build-info.json so production can be asked what it is running.
//
// This exists because deploy-prod.yml used to check out with no ref and build
// whatever master HEAD was at dispatch time, leaving no record. Establishing
// what production was serving meant comparing content hashes against a local
// build - not something you want to be doing during an incident.
//
// It runs after `astro build` and before the S3 sync, so the file is part of
// the synced artifact rather than something `--delete` would strip on the next
// deploy. Everything in it is already public (the repository is public); no
// secrets, no infrastructure identifiers.
import { execFileSync } from 'node:child_process';
import { writeFileSync, existsSync } from 'node:fs';

function git(...args) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

export function buildInfo(env = process.env, now = new Date()) {
  return {
    // In Actions these come from the runner; locally they fall back to git so
    // a developer's `npm run build` still produces a truthful file.
    commit: env.GITHUB_SHA || git('rev-parse', 'HEAD') || 'unknown',
    ref: env.GITHUB_REF_NAME || git('rev-parse', '--abbrev-ref', 'HEAD') || 'unknown',
    runId: env.GITHUB_RUN_ID || null,
    workflow: env.GITHUB_WORKFLOW || 'local',
    builtAt: now.toISOString(),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!existsSync('dist')) {
    console.error('build-info: dist/ does not exist — run the build first');
    process.exit(1);
  }
  const info = buildInfo();
  writeFileSync('dist/.build-info.json', JSON.stringify(info, null, 2) + '\n');
  console.log('build-info:', JSON.stringify(info));
}

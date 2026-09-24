# Edge Function Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy the CloudFront Functions from the pipeline instead of by hand, and give staging its own copy so an edge change can be tested before it reaches production.

**Architecture:** A small Node script compares the repo's function source against what is published LIVE and updates + publishes only when they differ, so a deploy that changes nothing creates no new version. `marinos-redirects` is split into per-environment functions, because today one function is attached to both distributions — the reason automating the current shape would be actively worse than the manual process. Each deploy workflow then publishes its own environment's functions.

**Tech Stack:** CloudFront Functions (`cloudfront-js-2.0`), AWS CLI v2, Node 22, Vitest, GitHub Actions.

**Spec:** No separate spec — the problem statement and the findings behind it are in **Background** below.

## Global Constraints

- **Function code stays ES5.** `function handler(event){}`, no arrow functions, template literals or `module.exports`. That is the CloudFront Functions runtime, and both functions are unit-tested by loading the file and invoking `handler`, so they must remain plain functions.
- **One source file per behaviour, two deployed functions.** Staging and production run *identical* redirect logic; they are separate CloudFront Functions purely so they can be deployed at different times. Do not let the two sources diverge.
- **`update-function` and `publish-function` both require `--if-match <ETag>`**, and the ETag changes after each call. Read it immediately before each use; never cache one across steps.
- **This repository is public.** No account IDs, distribution IDs, OAC/OAI IDs or function ARNs in committed files. Workflows read them from secrets; the runbook uses placeholders.
- The GitHub Actions IAM user (`s3-deploy-static-site`) already holds `CloudFrontFullAccess`, so **no IAM change is needed** for the workflows to publish functions.
- Node ≥ 22 (`nvm use 22`). Run gates from the repo root.

---

## Background

### The problem

`infra/cloudfront/redirects.js` is versioned, reviewed and unit-tested like source code — and **nothing deploys it.** Neither `deploy-staging.yml` nor `deploy-prod.yml` touches it; they sync `dist/` and invalidate. Publishing is done by hand:

```bash
aws cloudfront update-function --name marinos-redirects --if-match <ETag> \
  --function-code fileb://infra/cloudfront/redirects.js ...
aws cloudfront publish-function --name marinos-redirects --if-match <new ETag>
```

So the file on `master` can silently disagree with what runs at the edge, and nothing detects it. This is not hypothetical — on 2026-09-24 it happened twice in one afternoon:

- PR #30 merged into `astro-migration`, a retired branch, so `master` said `302` while the change sat somewhere that deploys nothing.
- After #55 landed, `master` said `301` while the edge still served `302` until the function was republished by hand.

The `.build-info.json` work solved exactly this class of problem for the *site*. The edge has no equivalent.

### Why the obvious fix is wrong

`marinos-redirects` is **a single function attached to both distributions**:

```
<PROD_DIST_ID>      viewer-request  marinos-redirects
<STAGING_DIST_ID>   viewer-request  marinos-redirects      <-- the same function
                    viewer-response marinos-staging-noindex
```

Adding a publish step to `deploy-staging.yml` in that shape would mean **every push to `master` instantly changes production's edge behaviour**, with no staging soak at all. That is worse than deploying by hand. It also explains a note in PR #30 that read as a shrug at the time — "the function is shared with staging, so staging flips at the same moment" — which is really a statement that staging provides no isolation for edge changes.

So the split comes first, the automation second.

### What this does not cover

Rollback of a function version. CloudFront keeps published versions, so reverting is `update-function` with the previous source followed by `publish-function` — which this plan's script does automatically once the repo is reverted. Nothing here retains or pins historical versions.

---

## File Structure

```
scripts/deploy-function.mjs        # NEW: compare LIVE vs repo, update+publish only on change
scripts/deploy-function.test.ts    # NEW: unit tests for the comparison and argument handling
.github/workflows/ci.yml           # MODIFY: drift check — LIVE must match the repo
.github/workflows/deploy-staging.yml # MODIFY: publish the staging functions
.github/workflows/deploy-prod.yml    # MODIFY: publish the prod function
docs/superpowers/runbook-edge-split.md # NEW (Task 3): operator record of the split
```

---

## Task 1: A script that publishes a function only when it has changed

**Files:**
- Create: `scripts/deploy-function.mjs`
- Create: `scripts/deploy-function.test.ts`

**Interfaces:**
- Produces: `needsPublish(liveCode, repoCode)` → `boolean`, exported for testing.
- Produces: a CLI, `node scripts/deploy-function.mjs <function-name> <source-path>`, which exits 0 whether or not it published, and non-zero only on a real failure. Tasks 2 and 4 invoke it.

- [ ] **Step 1: Write the failing test**

Create `scripts/deploy-function.test.ts`:

```ts
import { test, expect } from 'vitest';
import { needsPublish } from './deploy-function.mjs';

test('publishes when the code differs', () => {
  expect(needsPublish('function handler(e){return e}', 'function handler(e){return e.request}')).toBe(true);
});

test('does not publish when the code is identical', () => {
  const code = 'function handler(e){return e.request}';
  expect(needsPublish(code, code)).toBe(false);
});

test('ignores a trailing-newline difference', () => {
  // get-function returns the stored code, which may not carry the file's
  // final newline. That is not a reason to burn a function version.
  expect(needsPublish('function handler(e){}\n', 'function handler(e){}')).toBe(false);
});

test('treats a missing live function as needing a publish', () => {
  expect(needsPublish(null, 'function handler(e){}')).toBe(true);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run scripts/deploy-function.test.ts`
Expected: FAIL — cannot resolve `./deploy-function.mjs`.

- [ ] **Step 3: Implement the script**

Create `scripts/deploy-function.mjs`:

```js
// Publishes a CloudFront Function from the repo, but only when the published
// LIVE code actually differs. Without the comparison every deploy would burn a
// new function version for no change.
//
// Exists because infra/cloudfront/*.js were versioned and tested like source
// but deployed entirely by hand, so `master` could disagree with the edge and
// nothing would notice.
import { execFileSync } from 'node:child_process';
import { readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const RUNTIME = 'cloudfront-js-2.0';

export function needsPublish(liveCode, repoCode) {
  if (liveCode === null || liveCode === undefined) return true;
  return liveCode.trimEnd() !== repoCode.trimEnd();
}

function aws(args) {
  return execFileSync('aws', args, { encoding: 'utf8' }).trim();
}

function liveCodeOf(name) {
  const out = join(mkdtempSync(join(tmpdir(), 'cf-fn-')), 'live.js');
  try {
    aws(['cloudfront', 'get-function', '--name', name, '--stage', 'LIVE', out]);
  } catch {
    return null; // not published yet
  }
  return readFileSync(out, 'utf8');
}

function main() {
  const [name, source] = process.argv.slice(2);
  if (!name || !source) {
    console.error('usage: deploy-function.mjs <function-name> <source-path>');
    process.exit(2);
  }

  const repoCode = readFileSync(source, 'utf8');
  if (!needsPublish(liveCodeOf(name), repoCode)) {
    console.log(`${name}: already live, nothing to publish`);
    return;
  }

  // Each call invalidates the previous ETag, so read it immediately before use.
  const describeEtag = aws(['cloudfront', 'describe-function', '--name', name, '--query', 'ETag', '--output', 'text']);
  const updateEtag = aws([
    'cloudfront', 'update-function',
    '--name', name,
    '--if-match', describeEtag,
    '--function-config', `Comment=deployed from ${source},Runtime=${RUNTIME}`,
    '--function-code', `fileb://${source}`,
    '--query', 'ETag', '--output', 'text',
  ]);
  aws(['cloudfront', 'publish-function', '--name', name, '--if-match', updateEtag]);
  console.log(`${name}: published from ${source}`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run scripts/deploy-function.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Confirm the whole unit suite still passes**

Run: `npm run test:unit`
Expected: PASS — the existing 17 plus the 4 new.

- [ ] **Step 6: Commit**

```bash
git add scripts/deploy-function.mjs scripts/deploy-function.test.ts
git commit -m "feat(infra): publish a cloudfront function only when it has changed"
```

---

## Task 2: Fail CI when the edge has drifted from the repo

**Files:**
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `needsPublish` semantics from Task 1 — the check is the same comparison, read-only.
- Produces: nothing consumed later. This task is deliberately independent of the split, so the drift it would have caught on 2026-09-24 starts being caught immediately.

- [ ] **Step 1: Add a read-only drift check to CI**

In `.github/workflows/ci.yml`, after the existing gates:

```yaml
      - uses: aws-actions/configure-aws-credentials@v6
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      - name: Edge functions must match what is published
        run: |
          set -euo pipefail
          for fn in marinos-redirects:infra/cloudfront/redirects.js \
                    marinos-staging-noindex:infra/cloudfront/staging-noindex.js; do
            name="${fn%%:*}"; src="${fn##*:}"
            aws cloudfront get-function --name "$name" --stage LIVE /tmp/live.js >/dev/null
            if ! diff -q <(sed -e 's/[[:space:]]*$//' "$src") <(sed -e 's/[[:space:]]*$//' /tmp/live.js) >/dev/null; then
              echo "::error::$name has drifted from $src"
              diff <(cat "$src") <(cat /tmp/live.js) || true
              exit 1
            fi
            echo "$name matches $src"
          done
```

> This runs on pull requests, so it reports drift as a failing check rather than silently. It is read-only — it never publishes.

- [ ] **Step 2: Verify the check passes on the current state**

Run locally with the admin profile (the workflow uses the deploy user, which also has `CloudFrontFullAccess`):

```bash
export AWS_PROFILE=stavros-administrator AWS_REGION=eu-west-1
aws cloudfront get-function --name marinos-redirects --stage LIVE /tmp/live.js >/dev/null
diff <(sed -e 's/[[:space:]]*$//' infra/cloudfront/redirects.js) <(sed -e 's/[[:space:]]*$//' /tmp/live.js) && echo "in sync"
```
Expected: `in sync` — the function was republished by hand on 2026-09-24, so the repo and the edge currently agree.

- [ ] **Step 3: Prove the check actually fails on drift**

A check that has never failed is not known to work. Temporarily edit `infra/cloudfront/redirects.js` (change a comment), re-run the diff from Step 2, confirm it reports a difference, then **revert the edit**.

Expected: the diff is non-empty and the command exits non-zero.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: fail when a deployed edge function has drifted from the repo"
```

---

## Task 3: [RUNBOOK] Give staging its own redirect function

> **Operator steps — run with AWS credentials (`--profile stavros-administrator --region eu-west-1`). Not agent-dispatchable.** Record IDs in `docs/superpowers/runbook-edge-split.md`.

**Files:** Create `docs/superpowers/runbook-edge-split.md`.

Set `export AWS="aws --profile stavros-administrator --region eu-west-1"`.

- [ ] **Step 1: Create the staging copy of the redirect function**

Identical code, separate function, so staging can be updated without touching production.

```bash
cd infra/cloudfront
$AWS cloudfront create-function \
  --name marinos-redirects-staging \
  --function-config Comment="redirects + clean URLs (staging)",Runtime="cloudfront-js-2.0" \
  --function-code fileb://redirects.js \
  --query 'ETag' --output text   # record as CREATE_ETAG
$AWS cloudfront publish-function --name marinos-redirects-staging --if-match <CREATE_ETAG>
```
Verification: `$AWS cloudfront describe-function --name marinos-redirects-staging --stage LIVE --query 'FunctionSummary.Status' --output text` → `DEPLOYED`.

- [ ] **Step 2: Point the staging distribution at its own function**

The staging distribution already has a viewer-response association (`marinos-staging-noindex`); this replaces only the viewer-request entry, keeping the other.

```bash
DIST=<STAGING_DIST_ID>
ACCT=$($AWS sts get-caller-identity --query Account --output text)
$AWS cloudfront get-distribution-config --id $DIST > /tmp/staging-cur.json
ETAG=$(jq -r .ETag /tmp/staging-cur.json)

jq --arg fn "arn:aws:cloudfront::$ACCT:function:marinos-redirects-staging" '
  .DistributionConfig
  | .DefaultCacheBehavior.FunctionAssociations.Items =
      ( .DefaultCacheBehavior.FunctionAssociations.Items
        | map(if .EventType == "viewer-request" then .FunctionARN = $fn else . end) )
' /tmp/staging-cur.json > /tmp/staging-new.json

diff <(jq -S .DistributionConfig /tmp/staging-cur.json) <(jq -S . /tmp/staging-new.json)
```

**Gate:** the diff must show exactly one changed `FunctionARN`, on the viewer-request entry, and the viewer-response `marinos-staging-noindex` entry must be untouched.

```bash
$AWS cloudfront update-distribution --id $DIST \
  --distribution-config file:///tmp/staging-new.json --if-match "$ETAG"
$AWS cloudfront wait distribution-deployed --id $DIST
$AWS cloudfront create-invalidation --distribution-id $DIST --paths "/*"
```

- [ ] **Step 3: Verify staging still behaves, and that prod is now independent**

```bash
for u in / /kimon.html /en/kimon /sitemap.xml /.build-info.json; do
  printf "%-18s " "$u"; curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://<STAGING_DOMAIN>$u"
done
curl -s -D - -o /dev/null "https://<STAGING_DOMAIN>/en/kimon" | grep -i x-robots-tag
```
Expected: `/` and `/kimon.html` 301, `/en/kimon` 200, `/sitemap.xml` 200, `/.build-info.json` 200, and `x-robots-tag: noindex, nofollow` still present — proving the viewer-response association survived.

**The independence test that matters:** production must still be on `marinos-redirects`.
```bash
$AWS cloudfront get-distribution-config --id <PROD_DIST_ID> \
  --query 'DistributionConfig.DefaultCacheBehavior.FunctionAssociations.Items[].FunctionARN' --output text
```
Expected: `…:function/marinos-redirects` — unchanged, and no longer shared.

- [ ] **Step 4: Record it and commit**

Write `docs/superpowers/runbook-edge-split.md` with the two function names, which distribution uses which, the ETag used, and the date. **No account IDs or distribution IDs** — this repository is public.

```bash
git add docs/superpowers/runbook-edge-split.md
git commit -m "docs: record the edge function split"
```

---

## Task 4: Publish the functions from the deploy workflows

**Files:**
- Modify: `.github/workflows/deploy-staging.yml`
- Modify: `.github/workflows/deploy-prod.yml`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `scripts/deploy-function.mjs` from Task 1, and the per-environment function names created in Task 3.

- [ ] **Step 1: Publish staging's functions on a staging deploy**

In `.github/workflows/deploy-staging.yml`, after `configure-aws-credentials` and before the S3 sync:

```yaml
      - run: node scripts/deploy-function.mjs marinos-redirects-staging infra/cloudfront/redirects.js
      - run: node scripts/deploy-function.mjs marinos-staging-noindex infra/cloudfront/staging-noindex.js
```

- [ ] **Step 2: Publish production's function on a production deploy**

In `.github/workflows/deploy-prod.yml`, in the same position:

```yaml
      - run: node scripts/deploy-function.mjs marinos-redirects infra/cloudfront/redirects.js
```

Production has no `staging-noindex` association and must not gain one — it would make the live site `noindex`.

- [ ] **Step 3: Update the CI drift check for the new names**

In `.github/workflows/ci.yml`, change the loop from Task 2 to check all three deployed functions:

```yaml
          for fn in marinos-redirects:infra/cloudfront/redirects.js \
                    marinos-redirects-staging:infra/cloudfront/redirects.js \
                    marinos-staging-noindex:infra/cloudfront/staging-noindex.js; do
```

Both redirect functions are checked against the *same* source file, which is what keeps them from diverging.

- [ ] **Step 4: Verify the YAML and the whole gate set**

```bash
npx --yes yaml-lint .github/workflows/*.yml
npm run test:unit && npm test && npm run parity:text && npm run parity:images
```
Expected: lint clean, all gates pass.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows
git commit -m "ci: deploy the edge functions from the pipeline"
```

- [ ] **Step 6: Land it and watch the first automated publish**

Open a PR. Per the project's review rule: wait for review, resolve comments, never auto-merge.

On merge, `deploy-staging` fires and should report `marinos-redirects-staging: already live, nothing to publish` — the code is unchanged, so the idempotence path is exercised on the very first run.

Then prove the pipeline actually publishes: make a trivial comment-only change to `infra/cloudfront/redirects.js`, land it, and confirm the staging deploy reports `published from …` while **production stays on the previous version** until `Deploy Production` is dispatched. That is the isolation this whole plan exists to create; verify it rather than assuming it.

---

## Follow-up worth considering separately

- **Attach the function association itself from the pipeline.** This plan deploys function *code* but still assumes the distribution's association was set by hand. Automating that means `update-distribution`, which is the riskiest CloudFront call there is — it belongs in its own change, if at all.
- **Alarm on drift** rather than only failing PR CI, so a console edit is noticed without waiting for someone to open a PR. A scheduled workflow running the Task 2 check would do it.

# CI/CD, Edge Redirects & Prod Cutover — Implementation Plan (Phase 1, Plan 4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the Astro site through an automated CI/CD pipeline and cut production over from the legacy bucket to the new Astro build, safely and verifiably.

**Architecture:** Two halves. **Tasks 1–4 are CODE** (a CloudFront Function for redirects + clean URLs, removal of the prod-hardcoded Astro redirect stubs, vendoring the last CDN dependency, and three GitHub Actions workflows) — agent-implementable and TDD where the unit is a pure function or a buildable artifact. **Tasks 5–8 are an OPERATOR RUNBOOK** — AWS/GitHub steps the human runs with their credentials (this environment has no AWS access), each with exact commands, a verification check, and a rollback note. All-AWS, staging-only (no per-PR previews); prod stays on S3 + CloudFront.

**Tech Stack:** Astro 4 (static), GitHub Actions, AWS S3 + CloudFront (+ CloudFront Functions, OAC), `aws` CLI, `gh` CLI, Vitest, Playwright.

## Global Constraints

- **Execution model:** Tasks 1–4 are implemented + tested in-repo and land via a PR into `astro-migration`. Tasks 5–8 are operator steps — **do NOT dispatch them to a subagent**; they require live AWS credentials and deliberate production changes. Each runbook step states its verification and (where relevant) rollback.
- Two locales `en` (default) + `gr`; per-locale URLs. Site origin `https://www.marinos-aparts.gr`. Region `eu-west-1`. Node 18+.
- Prod stays on **AWS S3 + CloudFront**. Buckets: `marinos-aparts-prod` (new prod), `marinos-aparts-staging` (new staging, own distribution), `marinos-test-bucket` (legacy prod — decommissioned only after the new prod is verified).
- The legacy deploy is `.github/workflows/main.yml` (push to `master` → `aws s3 sync ./ s3://marinos-test-bucket`). The new deploys sync **`dist/`** (the Astro build), not the repo root. `master` stays frozen until cutover (Task 7/8).
- Reuse the existing GitHub secrets `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`. New secrets added in the runbook: `STAGING_DISTRIBUTION_ID`, `PROD_DISTRIBUTION_ID`.
- API endpoints + reCAPTCHA key are public values in `src/config.ts` (baked at build) — no per-environment secret.
- Import convention: local TS without file extension; `.astro` imports with extension; JSON without import assertions.
- CloudFront Function code must be ES5-safe (`function handler(event){…}`, no `module.exports`, no template literals/arrow funcs) so it runs under either `cloudfront-js-1.0` or `2.0`.

## Redirect & clean-URL contract (used by Task 1 and the runbook)

The CloudFront Function, attached as **viewer-request** on each distribution, must:
- **301-redirect** these exact paths (relative `location`, so it redirects to the same host — works on staging + prod identically): `/`→`/en/`, `/home.html`→`/en/`, `/kimon.html`→`/en/kimon`, `/irida.html`→`/en/irida`, `/location.html`→`/en/location`, `/contact.html`→`/en/contact`.
- **Rewrite** clean URLs to S3 object keys: a path ending in `/` → append `index.html`; a path whose last segment has no `.` → append `/index.html` (so `/en/kimon` → `/en/kimon/index.html`). Paths whose last segment contains `.` (e.g. `/_astro/app.css`, `/img/nav/logo.png`) pass through unchanged.

## File Structure

```
infra/cloudfront/redirects.js        # NEW: CloudFront Function source (ES5-safe)
infra/cloudfront/redirects.test.ts   # NEW: Vitest unit test (loader-based)
vitest.config.ts                     # MODIFY: add infra/**/*.test.ts to include
astro.config.mjs                     # MODIFY: remove the `redirects` block
src/components/Map.astro             # MODIFY: vendor Leaflet CSS (drop unpkg <link>)
.github/workflows/ci.yml             # NEW: PR build+test gate
.github/workflows/deploy-staging.yml # NEW: merge-to-trunk -> staging deploy
.github/workflows/deploy-prod.yml    # NEW: workflow_dispatch -> prod deploy
.github/workflows/main.yml           # DELETE (Task 8, at cutover)
docs/superpowers/runbook-cutover.md  # NEW (Task 5): the operator runbook record
```

---

## Task 1: CloudFront Function for redirects + clean URLs

**Files:**
- Create: `infra/cloudfront/redirects.js`
- Create: `infra/cloudfront/redirects.test.ts`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `infra/cloudfront/redirects.js` containing a single `function handler(event)` (CloudFront Functions entry point). Deployed verbatim in the runbook (Tasks 6–7). Pure enough to unit-test by loading the file and invoking `handler`.

- [ ] **Step 1: Allow Vitest to find infra tests**

In `vitest.config.ts`, add `infra/**/*.test.ts` to the `include` array:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'infra/**/*.test.ts'],
  },
});
```

- [ ] **Step 2: Write the failing test**

Create `infra/cloudfront/redirects.test.ts` (loads the CF function file and invokes its `handler` — the file has no `module.exports`, so wrap it):

```ts
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function loadHandler() {
  const src = readFileSync(new URL('./redirects.js', import.meta.url), 'utf8');
  // The file declares `function handler(event){…}`; expose it via a wrapper.
  return new Function('event', `${src}\nreturn handler(event);`) as (e: any) => any;
}
const handler = loadHandler();
const req = (uri: string) => ({ request: { uri } });

test('root and legacy .html paths 301-redirect to locale URLs', () => {
  for (const [from, to] of [
    ['/', '/en/'],
    ['/home.html', '/en/'],
    ['/kimon.html', '/en/kimon'],
    ['/irida.html', '/en/irida'],
    ['/location.html', '/en/location'],
    ['/contact.html', '/en/contact'],
  ]) {
    const res = handler(req(from));
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe(to);
  }
});

test('clean URLs are rewritten to index.html objects', () => {
  expect(handler(req('/en/')).uri).toBe('/en/index.html');
  expect(handler(req('/en/kimon')).uri).toBe('/en/kimon/index.html');
  expect(handler(req('/gr/contact')).uri).toBe('/gr/contact/index.html');
});

test('paths with a file extension pass through unchanged', () => {
  expect(handler(req('/_astro/app.abc123.css')).uri).toBe('/_astro/app.abc123.css');
  expect(handler(req('/img/nav/logo_marinos.png')).uri).toBe('/img/nav/logo_marinos.png');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npm run test:unit -- infra/cloudfront/redirects.test.ts`
Expected: FAIL — `redirects.js` does not exist (ENOENT in `loadHandler`).

- [ ] **Step 4: Write the CloudFront Function**

Create `infra/cloudfront/redirects.js` (ES5-safe — no arrow functions, template literals, or `module.exports`):

```js
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    var redirects = {
        '/': '/en/',
        '/home.html': '/en/',
        '/kimon.html': '/en/kimon',
        '/irida.html': '/en/irida',
        '/location.html': '/en/location',
        '/contact.html': '/en/contact'
    };

    if (redirects.hasOwnProperty(uri)) {
        return {
            statusCode: 301,
            statusDescription: 'Moved Permanently',
            headers: { 'location': { value: redirects[uri] } }
        };
    }

    // Map clean/directory URLs to their S3 index.html object.
    if (uri.charAt(uri.length - 1) === '/') {
        request.uri = uri + 'index.html';
    } else {
        var lastSegment = uri.substring(uri.lastIndexOf('/') + 1);
        if (lastSegment.indexOf('.') === -1) {
            request.uri = uri + '/index.html';
        }
    }
    return request;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- infra/cloudfront/redirects.test.ts`
Expected: PASS (all three tests). Also run the full unit suite to confirm the `include` change didn't break collection: `npm run test:unit` → all PASS.

- [ ] **Step 6: Commit**

```bash
git add infra/cloudfront/redirects.js infra/cloudfront/redirects.test.ts vitest.config.ts
git commit -m "feat: CloudFront Function for redirects + clean-URL rewrites"
```

---

## Task 2: Remove the prod-hardcoded Astro redirect stubs

**Files:**
- Modify: `astro.config.mjs`
- Test: `infra/cloudfront/no-stub.test.ts` (a build-output assertion)

**Interfaces:**
- Consumes: nothing.
- Produces: the build no longer emits meta-refresh redirect stubs hardcoded to the prod URL. Redirects are owned by the CloudFront Function (Task 1). Local `npm run preview` of `/` or `/kimon.html` will 404 (the edge owns those) — expected; use `/en/` locally.

- [ ] **Step 1: Write the failing test**

Create `infra/cloudfront/no-stub.test.ts` (builds the site, then asserts no prod-hardcoded redirect stub remains):

```ts
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
  // The legacy .html redirect stubs must be gone too.
  expect(existsSync('dist/kimon.html')).toBe(false);
}, 120_000);
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- infra/cloudfront/no-stub.test.ts`
Expected: FAIL — currently `dist/kimon.html` exists (Astro generates it from the `redirects` block) / `dist/index.html` is a meta-refresh to `https://www.marinos-aparts.gr/en/`.

- [ ] **Step 3: Remove the `redirects` block**

In `astro.config.mjs`, delete the entire `redirects: { … }` block (the `/`, `/home.html`, `/kimon.html`, `/irida.html`, `/location.html`, `/contact.html` entries). Keep `site`, `output: 'static'`, and `trailingSlash: 'ignore'`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- infra/cloudfront/no-stub.test.ts`
Expected: PASS — no `dist/kimon.html`; no prod-hardcoded root stub.

- [ ] **Step 5: Commit**

```bash
git add astro.config.mjs infra/cloudfront/no-stub.test.ts
git commit -m "fix: drop prod-hardcoded Astro redirect stubs (edge owns redirects)"
```

---

## Task 3: Vendor Leaflet CSS off the CDN

**Files:**
- Modify: `src/components/Map.astro`
- Test: `npm run build` + a dist grep + the home Playwright suite

**Interfaces:**
- Produces: the Leaflet map CSS is bundled from the local `leaflet` package (already a dependency) instead of fetched from unpkg at runtime — closing the last runtime CDN dependency (the PhotoSwipe CSS was vendored in Plan 3).

- [ ] **Step 1: Replace the CDN link with a bundled import**

In `src/components/Map.astro`, delete the line:
```astro
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
```
and add a CSS import as the first line of the existing `<script>` (above `import L from 'leaflet';`):
```ts
<script>
  import 'leaflet/dist/leaflet.css';
  import L from 'leaflet';
  // …rest unchanged…
```

- [ ] **Step 2: Build and verify no Leaflet CDN reference remains**

Run: `npm run build`
Expected: exit 0.
Run: `grep -rl "unpkg.com/leaflet" dist || echo "no leaflet CDN refs in dist"`
Expected: `no leaflet CDN refs in dist`.

- [ ] **Step 3: Verify the map still renders**

Run: `npx playwright test tests/home.spec.ts -g "leaflet map"`
Expected: PASS (the footer map still initializes — confirms the bundled CSS loaded).

- [ ] **Step 4: Commit**

```bash
git add src/components/Map.astro
git commit -m "refactor: bundle Leaflet CSS locally instead of the unpkg CDN"
```

---

## Task 4: GitHub Actions workflows (CI, staging, prod)

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-staging.yml`
- Create: `.github/workflows/deploy-prod.yml`
- Test: YAML validity + structural review (Actions cannot run in this environment; real execution is verified in the runbook, Tasks 6–7)

**Interfaces:**
- Produces: three workflows. `ci.yml` gates PRs (build+test). `deploy-staging.yml` auto-deploys `dist/` to `marinos-aparts-staging` on push to the trunk and invalidates the staging distribution. `deploy-prod.yml` is manual (`workflow_dispatch`) and deploys to `marinos-aparts-prod` + invalidates prod. All gate on build + unit + e2e + parity scripts.

- [ ] **Step 1: Create the PR CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
    branches: [astro-migration, master]
jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:unit
      - run: npm test
      - run: npm run parity:text
      - run: npm run parity:images
```

- [ ] **Step 2: Create the staging deploy workflow**

Create `.github/workflows/deploy-staging.yml`. Trigger branch is `astro-migration` during the migration; Task 8 flips it to `master` at cutover.

```yaml
name: Deploy Staging
on:
  push:
    branches: [astro-migration]   # Task 8 flips this to: master
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:unit
      - run: npm test
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      - run: aws s3 sync ./dist s3://marinos-aparts-staging --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.STAGING_DISTRIBUTION_ID }} --paths "/*"
```

- [ ] **Step 3: Create the prod deploy workflow**

Create `.github/workflows/deploy-prod.yml` (manual only):

```yaml
name: Deploy Production
on:
  workflow_dispatch:
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 18
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run build
      - run: npm run test:unit
      - run: npm test
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: eu-west-1
      - run: aws s3 sync ./dist s3://marinos-aparts-prod --delete
      - run: aws cloudfront create-invalidation --distribution-id ${{ secrets.PROD_DISTRIBUTION_ID }} --paths "/*"
```

- [ ] **Step 4: Validate the YAML**

Run: `npx --yes yaml-lint .github/workflows/ci.yml .github/workflows/deploy-staging.yml .github/workflows/deploy-prod.yml` (or `python3 -c "import yaml,sys;[yaml.safe_load(open(f)) for f in sys.argv[1:]]" .github/workflows/*.yml` if yaml-lint is unavailable).
Expected: no parse errors. Confirm by review: each workflow gates on `npm run build` + `test:unit` + `test` before any deploy step; staging triggers on `astro-migration`; prod is `workflow_dispatch` only; secrets referenced are `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `STAGING_DISTRIBUTION_ID`, `PROD_DISTRIBUTION_ID`.

NOTE: do NOT delete `.github/workflows/main.yml` here — it stays until cutover (Task 8). The new `deploy-staging.yml` will fire on the merge of this PR into `astro-migration`; it will only succeed once the staging bucket + `STAGING_DISTRIBUTION_ID` secret exist (runbook Tasks 5–6). Sequence accordingly: it is acceptable for the first staging run to fail until the runbook provisions staging, or provision staging (Tasks 5–6) before merging this PR.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy-staging.yml .github/workflows/deploy-prod.yml
git commit -m "ci: add PR gate + staging (auto) and prod (manual) deploy workflows"
```

---

## Task 5: [RUNBOOK] AWS prerequisites & buckets

> **Operator step — run with AWS credentials. Not agent-dispatchable.** Record outputs (distribution IDs, ARNs) in `docs/superpowers/runbook-cutover.md` as you go.

**Files:** Create `docs/superpowers/runbook-cutover.md` to log IDs/decisions.

- [ ] **Step 1: Identify the prod CloudFront distribution**

```bash
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?contains(DomainName, 'marinos-test-bucket')]].{Id:Id,Domain:DomainName,Aliases:Aliases.Items}" \
  --output table
```
Record the `Id` as **PROD_DIST_ID**. Confirm its `Aliases` include `www.marinos-aparts.gr`. Verification: the alias matches the live domain.

- [ ] **Step 2: Create the two buckets (private)**

```bash
aws s3api create-bucket --bucket marinos-aparts-prod --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api create-bucket --bucket marinos-aparts-staging --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-public-access-block --bucket marinos-aparts-prod \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
aws s3api put-public-access-block --bucket marinos-aparts-staging \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```
Verification: `aws s3api head-bucket --bucket marinos-aparts-prod` and `… marinos-aparts-staging` both succeed (exit 0).

- [ ] **Step 3: Confirm the IAM user behind the GH secrets can do the new actions**

The deploy workflows use `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY`. Ensure that IAM principal has: `s3:PutObject`/`s3:DeleteObject`/`s3:ListBucket` on both new buckets, and `cloudfront:CreateInvalidation` on the distributions. Verification:
```bash
aws s3 cp - s3://marinos-aparts-staging/_perm-check.txt <<< "ok" && \
  aws s3 rm s3://marinos-aparts-staging/_perm-check.txt && echo "write OK"
```

- [ ] **Step 4: Set the distribution-ID secrets (after the distributions exist — staging in Task 6, prod is PROD_DIST_ID now)**

```bash
gh secret set PROD_DISTRIBUTION_ID --body "<PROD_DIST_ID>"
# STAGING_DISTRIBUTION_ID is set in Task 6 once the staging distribution exists.
```
Verification: `gh secret list` shows `PROD_DISTRIBUTION_ID`.

---

## Task 6: [RUNBOOK] Stand up staging & verify

> **Operator step.** Goal: a working staging site served from `marinos-aparts-staging` via its own CloudFront distribution, with the redirect function attached, auto-deploying on merge to `astro-migration`.

- [ ] **Step 1: Publish the CloudFront Function**

```bash
aws cloudfront create-function --name marinos-redirects \
  --function-config Comment="redirects + clean URLs",Runtime="cloudfront-js-2.0" \
  --function-code fileb://infra/cloudfront/redirects.js \
  --query 'ETag' --output text   # record as CREATE_ETAG
aws cloudfront publish-function --name marinos-redirects --if-match <CREATE_ETAG>
```
Record the function ARN: `aws cloudfront describe-function --name marinos-redirects --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text`.
Verification: `aws cloudfront describe-function --name marinos-redirects --query 'FunctionSummary.Status'` → `DEPLOYED`.

- [ ] **Step 2: Create the staging distribution (Console or CLI)**

Create a CloudFront distribution for staging with these exact settings (the Console is the practical path; settings enumerated so it is unambiguous):
- **Origin:** `marinos-aparts-staging` S3 bucket, access via **Origin Access Control (OAC)** (create an OAC; then apply the generated bucket policy so only this distribution can read the bucket).
- **Default root object:** `index.html`.
- **Viewer protocol policy:** Redirect HTTP→HTTPS.
- **Function association (default behavior):** **Viewer request → CloudFront Function `marinos-redirects`**.
- No custom domain needed (use the default `*.cloudfront.net` URL for staging).

Record the distribution `Id` as **STAGING_DIST_ID** and its domain as **STAGING_DOMAIN**.
Then:
```bash
gh secret set STAGING_DISTRIBUTION_ID --body "<STAGING_DIST_ID>"
```

- [ ] **Step 2 (CLI alternative for the function association on an existing distribution):**
If you created the distribution without the association, attach it by editing the distribution config: `aws cloudfront get-distribution-config --id <STAGING_DIST_ID>`, add to the DefaultCacheBehavior a `FunctionAssociations` with `{ Quantity: 1, Items: [{ EventType: "viewer-request", FunctionARN: "<function ARN>" }] }`, then `aws cloudfront update-distribution --id <STAGING_DIST_ID> --distribution-config file://config.json --if-match <ETag>`.

- [ ] **Step 3: Trigger the first staging deploy**

Merge the Task 1–4 PR into `astro-migration` (this fires `deploy-staging.yml`), or re-run the workflow now that the bucket + secret exist:
```bash
gh workflow run "Deploy Staging" --ref astro-migration   # if a manual re-run is needed
gh run watch
```
Verification: the workflow run is green; `aws s3 ls s3://marinos-aparts-staging/en/index.html` exists.

- [ ] **Step 4: Verify staging behavior**

Against `https://<STAGING_DOMAIN>/`:
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<STAGING_DOMAIN>/            # expect 301 -> /en/
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://<STAGING_DOMAIN>/kimon.html  # expect 301 -> /en/kimon
curl -s -o /dev/null -w "%{http_code}\n" https://<STAGING_DOMAIN>/en/kimon                     # expect 200 (clean URL rewrite)
curl -s -o /dev/null -w "%{http_code}\n" https://<STAGING_DOMAIN>/gr/location                  # expect 200
```
Then load the site in a browser: all 5 pages × 2 locales render; galleries open; map + weather load. **Known limitation:** the contact form may fail CORS on staging (API Gateway likely allows only the prod origin) — validation/reCAPTCHA UI is still testable; full submit is verified on prod post-cutover (or add the staging origin to API Gateway CORS).
Rollback: staging is independent of prod; nothing to roll back if it misbehaves — fix and redeploy.

---

## Task 7: [RUNBOOK] Production cutover

> **Operator step — the one hard-to-reverse action. The legacy bucket stays intact until prod is verified, so rollback = repoint the origin back.**

- [ ] **Step 1: Attach the redirect function to the prod distribution**

Associate the published `marinos-redirects` function as **viewer-request** on the prod distribution (`PROD_DIST_ID`) — same association as staging (Console or the CLI `update-distribution` method in Task 6 Step 2-alt). Do NOT repoint the origin yet.
Verification: `aws cloudfront get-distribution-config --id <PROD_DIST_ID>` shows the FunctionAssociation on the default behavior.

- [ ] **Step 2: Build + deploy the Astro site to the new prod bucket**

Run the manual prod workflow (it builds, tests, syncs `dist/` to `marinos-aparts-prod`, and invalidates `PROD_DIST_ID`):
```bash
gh workflow run "Deploy Production"
gh run watch
```
Verification: green run; `aws s3 ls s3://marinos-aparts-prod/en/index.html` exists.

- [ ] **Step 3: Repoint the prod distribution origin to the new bucket**

Change the prod distribution's origin from `marinos-test-bucket` to `marinos-aparts-prod` (with OAC + the bucket policy granting this distribution read). Console: edit the origin; or CLI via `get-distribution-config` → edit `Origins` (DomainName + OAC + S3OriginConfig) → `update-distribution --if-match <ETag>`. Then invalidate:
```bash
aws cloudfront create-invalidation --distribution-id <PROD_DIST_ID> --paths "/*"
```
Verification (on the LIVE domain, after the invalidation completes):
```bash
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://www.marinos-aparts.gr/           # 301 -> /en/
curl -s -o /dev/null -w "%{http_code}\n" https://www.marinos-aparts.gr/en/                          # 200
curl -s -o /dev/null -w "%{http_code}\n" https://www.marinos-aparts.gr/en/kimon                     # 200
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" https://www.marinos-aparts.gr/kimon.html  # 301 -> /en/kimon
```
Then browser-verify all pages + the **contact form full submit** (same-origin now → CORS OK) + maps + weather + language switch.
**Rollback:** if anything is wrong, repoint the prod distribution origin back to `marinos-test-bucket` and invalidate `/*` — the legacy site is restored. Do not proceed to Task 8 until prod is confirmed.

---

## Task 8: [RUNBOOK + CODE] Finalize & decommission

> Mixed: the workflow edits are CODE (PR); the merge + bucket deletion are operator steps.

- [ ] **Step 1: (CODE) Delete the legacy workflow and flip the staging trigger**

Delete `.github/workflows/main.yml`. In `.github/workflows/deploy-staging.yml`, change the trigger branch from `astro-migration` to `master`:
```yaml
on:
  push:
    branches: [master]
```
Commit:
```bash
git rm .github/workflows/main.yml
git add .github/workflows/deploy-staging.yml
git commit -m "ci: retire legacy main.yml; staging deploys from master post-cutover"
```
(Land this via PR into `astro-migration` so it's part of the cutover merge.)

- [ ] **Step 2: (OPERATOR) Merge `astro-migration` → `master`**

Open and merge the release PR `astro-migration` → `master`. After merge, `master` carries the Astro site and the new workflows; `deploy-staging.yml` now fires on pushes to `master`. The prod distribution already serves the new bucket (Task 7), so this merge does not itself change prod.
Verification: `master` HEAD == the merged migration tip; the staging workflow runs green on the merge.

- [ ] **Step 3: (OPERATOR) Decommission the legacy bucket — after a soak**

Once prod has served correctly from `marinos-aparts-prod` for an agreed soak window (e.g. 24–48h) and nothing references `marinos-test-bucket`:
```bash
aws s3 rm s3://marinos-test-bucket --recursive
aws s3api delete-bucket --bucket marinos-test-bucket --region eu-west-1
```
Verification: `aws s3api head-bucket --bucket marinos-test-bucket` returns a 404/NoSuchBucket. Rollback window closes here — do this only after prod confidence.

- [ ] **Step 4: Retire the integration branch**

After the cutover merge is confirmed, delete the long-lived `astro-migration` branch (local + remote). Phase 1 is complete.

---

## Self-Review

**Spec coverage (against `2026-06-20-astro-migration-design.md` §"Branching & deployment", §"CI/CD pipeline", §"Buckets & cutover", §7):**
- CI/CD three-environment model (preview dropped by decision; staging + prod) → Task 4 (ci/staging/prod workflows). ✓
- Staging auto-deploy on trunk; prod manual `workflow_dispatch`; tests gate every path → Task 4. ✓
- Trigger flips `astro-migration`→`master` at cutover; legacy `main.yml` deleted → Task 8 Step 1. ✓
- New buckets `marinos-aparts-prod` + `marinos-aparts-staging`; legacy decommissioned after verify → Tasks 5, 8. ✓
- Repoint existing prod distribution origin (preserve domain/cert/Route53) → Task 7 Step 3. ✓
- §7.1 CloudFront distribution ID obtained, not assumed → Task 5 Step 1. ✓
- §7.2 hosting mechanism = all-AWS staging-only → Tasks 5–6. ✓
- §7.3 redirect mechanism = CloudFront Function → Tasks 1, 6–7. ✓
- §7.4 secrets/config = reuse AWS GH secrets + dist-ID secrets; public config in src/config.ts → Global Constraints, Task 5 Step 4. ✓
- Deferred Leaflet-CSS vendoring (last CDN dependency) → Task 3. ✓
- Prod-hardcoded redirect-stub bug fixed (root bounced to prod) → Task 2. ✓

**Placeholder scan:** Runbook tasks use `<PROD_DIST_ID>`, `<STAGING_DIST_ID>`, `<STAGING_DOMAIN>`, `<ETag>`, `<function ARN>` — these are account-specific runtime values the operator obtains via the discovery commands provided in the same step (not vague TODOs). All code tasks (1–4) contain complete code/commands. No "implement later"/"add error handling" placeholders.

**Type/interface consistency:** The CloudFront Function `handler(event)` shape (Task 1) — `request.uri`, the `{statusCode, statusDescription, headers:{location:{value}}}` redirect response — matches what the runbook deploys (Tasks 6–7) and what the no-stub assumption relies on (Task 2: edge owns redirects). Secret names (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `STAGING_DISTRIBUTION_ID`, `PROD_DISTRIBUTION_ID`) and bucket names (`marinos-aparts-prod`, `marinos-aparts-staging`) are identical across Task 4 (workflows), Task 5 (creation), and Tasks 6–8. The staging trigger branch (`astro-migration`) in Task 4 is the exact line Task 8 flips to `master`.

**Note for executor:** Implement Tasks 1–4 via subagent-driven-development (code + TDD), land them as a PR into `astro-migration`, and run the final whole-branch review. **Tasks 5–8 are the operator runbook — hand them to the human; do NOT dispatch them to a subagent** (no AWS access; production changes). The staging workflow first fires when the Task 1–4 PR merges, so provision staging (Tasks 5–6) around that merge.

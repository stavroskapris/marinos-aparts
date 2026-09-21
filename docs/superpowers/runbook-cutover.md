# Runbook — Production Cutover (Plan 4, Tasks 5–8)

Operator document. **Run with AWS credentials; not agent-dispatchable.** Record IDs in the
Ledger section at the bottom as you go.

Supersedes **Task 7 of `docs/superpowers/plans/2026-06-21-cicd-and-cutover.md`**, whose
step ordering causes a live-site outage — see "Why the plan's ordering was wrong" below.

Status at time of writing (2026-09-21):
- Trunk `astro-migration` @ `70390ff`; Plans 1–4 code merged.
- Staging **<STAGING_DIST_ID>** / `<STAGING_DOMAIN>` — live and verified.
- `master` frozen at the 2023 legacy site; `main.yml` still deploys it to `marinos-test-bucket`.
- `PROD_DISTRIBUTION_ID` secret **not set**; `marinos-aparts-prod` bucket existence **unverified**.

---

## Why the plan's ordering was wrong

The plan's Task 7 attaches the `marinos-redirects` CloudFront Function to the prod
distribution (Step 1) and only repoints the origin two steps later (Step 3). The function
301s `/` → `/en/` and rewrites clean URLs to `/en/index.html` — **keys that do not exist in
`marinos-test-bucket`**. Every request to the live site 404s from the moment the function
association deploys until the origin swap finishes: two sequential CloudFront deployments,
roughly 5–15 minutes of hard downtime.

Reversing the order does not help. `dist/` has no root `index.html` (only `en/`, `gr/`,
`_astro/`, `img/`, `favicon.ico`), and CloudFront's default-root-object only rewrites `/`,
not `/en/`. So origin-first means `/en/`, `/en/kimon` and everything else 404s until the
function lands.

**The site is only correct when the new origin and the function are both in place.** They
must therefore change in a *single* `update-distribution` call — one config, one ETag, one
deployment, no broken intermediate state. The Console cannot do this (Origins and Behaviors
are separate saves), so the swap below is CLI + `jq`.

---

## Phase A — Prerequisites (no production impact)

Nothing in this phase touches the live distribution. Everything is reversible.

### A1. Identify the prod distribution and confirm its aliases

```bash
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[?contains(DomainName,'marinos-test-bucket')]].{Id:Id,Domain:DomainName,Aliases:Aliases.Items}" \
  --output table
```

Record the `Id` as **PROD_DIST_ID**.

**Gate:** its `Aliases` must include `www.marinos-aparts.gr` (and the apex
`marinos-aparts.gr` if that is served). If they do not, stop — you have the wrong
distribution, and no further step is safe.

Reusing this distribution is what keeps the domain, the ACM certificate and the Route 53
alias untouched. **No DNS, certificate or Route 53 change is part of this cutover.**

### A2. Record the current origin shape (needed for the swap, and for rollback)

```bash
aws cloudfront get-distribution-config --id <PROD_DIST_ID> > /tmp/prod-current.json
jq '.DistributionConfig.Origins' /tmp/prod-current.json
jq '.DistributionConfig.DefaultCacheBehavior | {TargetOriginId, FunctionAssociations, LambdaFunctionAssociations}' /tmp/prod-current.json
```

Note two things:

1. **Origin count.** If there is more than one origin, the `jq` in Phase C selects by
   index `0` — adjust the filter to target the right one.
2. **Origin type.** A legacy bucket is often wired as an S3 *website endpoint*
   (`marinos-test-bucket.s3-website-eu-west-1.amazonaws.com`) with a `CustomOriginConfig`,
   not a REST endpoint with `S3OriginConfig`. **Phase C has a variant for each — pick the
   one matching what you see here.** Getting this wrong produces a distribution that
   cannot reach the bucket.

Keep `/tmp/prod-current.json`. It is the rollback artifact.

### A3. Ensure the prod bucket exists and is private

```bash
aws s3api head-bucket --bucket marinos-aparts-prod 2>/dev/null && echo "exists" || echo "MISSING"
```

If missing:

```bash
aws s3api create-bucket --bucket marinos-aparts-prod --region eu-west-1 \
  --create-bucket-configuration LocationConstraint=eu-west-1
aws s3api put-public-access-block --bucket marinos-aparts-prod \
  --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true
```

### A4. Get an OAC id and the prod distribution ARN

An Origin Access Control is a signing configuration, not a bucket binding — the one the
staging wizard created can be reused. List what exists:

```bash
aws cloudfront list-origin-access-controls \
  --query 'OriginAccessControlList.Items[].{Id:Id,Name:Name,Origin:OriginAccessControlOriginType}' --output table
```

Record an S3-type OAC's `Id` as **OAC_ID**, or create one:

```bash
aws cloudfront create-origin-access-control --origin-access-control-config \
  'Name=marinos-prod-oac,Description=prod S3 OAC,SigningProtocol=sigv4,SigningBehavior=always,OriginAccessControlOriginType=s3' \
  --query 'OriginAccessControl.Id' --output text
```

Get the distribution ARN for the bucket policy:

```bash
aws cloudfront get-distribution --id <PROD_DIST_ID> --query 'Distribution.ARN' --output text
```

Record as **PROD_DIST_ARN**.

### A5. Grant the prod distribution read access to the prod bucket

This policy is inert until the origin actually points at this bucket, so it is safe to
apply now.

```bash
cat > /tmp/prod-bucket-policy.json <<'POLICY'
{
  "Version": "2008-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipalReadOnly",
      "Effect": "Allow",
      "Principal": { "Service": "cloudfront.amazonaws.com" },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::marinos-aparts-prod/*",
      "Condition": { "StringEquals": { "AWS:SourceArn": "PROD_DIST_ARN_PLACEHOLDER" } }
    }
  ]
}
POLICY
sed -i "s|PROD_DIST_ARN_PLACEHOLDER|<PROD_DIST_ARN>|" /tmp/prod-bucket-policy.json
aws s3api put-bucket-policy --bucket marinos-aparts-prod --policy file:///tmp/prod-bucket-policy.json
```

### A6. Confirm the redirect function is published

Do **not** recreate it — staging already uses this exact function.

```bash
aws cloudfront describe-function --name marinos-redirects --query 'FunctionSummary.Status' --output text
# expect: DEPLOYED
aws cloudfront describe-function --name marinos-redirects \
  --query 'FunctionSummary.FunctionMetadata.FunctionARN' --output text
```

Record as **FUNCTION_ARN**.

If you took the 302-during-soak option (see "Rollback is not fully symmetric" below), the
function must be republished from the edited `infra/cloudfront/redirects.js` *before* this
check.

### A7. Set the prod distribution-ID secret

```bash
gh secret set PROD_DISTRIBUTION_ID --body "<PROD_DIST_ID>"
gh secret list
```

**Gate:** `PROD_DISTRIBUTION_ID` must appear. `deploy-prod.yml` fails on its final
invalidation step without it.

---

## Phase B — Populate the prod bucket (still no production impact)

The distribution is not yet pointed at `marinos-aparts-prod`, so filling it changes nothing
for visitors.

```bash
gh workflow run "Deploy Production"
gh run watch
```

This builds, runs unit + Playwright + `parity:text` + `parity:images`, syncs `dist/` to
`s3://marinos-aparts-prod --delete`, then invalidates `PROD_DIST_ID`. **That invalidation
is harmless here** — the distribution is still serving the legacy bucket, so it just
re-fetches legacy objects.

Verify the bucket contents:

```bash
aws s3 ls s3://marinos-aparts-prod/en/index.html
aws s3 ls s3://marinos-aparts-prod/gr/index.html
aws s3 ls s3://marinos-aparts-prod/en/kimon/index.html
aws s3 ls s3://marinos-aparts-prod/ --recursive --summarize | tail -3
```

**Gate:** all three keys exist. Do not proceed otherwise — the swap would serve an empty
bucket.

---

## Phase C — The atomic swap (the one hard-to-reverse action)

Single `update-distribution`: origin **and** function association change together.

### C1. Build the new config

```bash
aws cloudfront get-distribution-config --id <PROD_DIST_ID> > /tmp/prod-current.json
ETAG=$(jq -r '.ETag' /tmp/prod-current.json)
echo "ETag: $ETAG"
```

Pick **one** variant, per what A2 showed.

**Variant 1 — legacy origin was a REST endpoint (`S3OriginConfig` present):**

```bash
jq --arg fn "<FUNCTION_ARN>" --arg oac "<OAC_ID>" '
  .DistributionConfig
  | .Origins.Items[0].DomainName = "marinos-aparts-prod.s3.eu-west-1.amazonaws.com"
  | .Origins.Items[0].OriginAccessControlId = $oac
  | .Origins.Items[0].S3OriginConfig.OriginAccessIdentity = ""
  | .DefaultCacheBehavior.FunctionAssociations = {
      "Quantity": 1,
      "Items": [ { "EventType": "viewer-request", "FunctionARN": $fn } ]
    }
' /tmp/prod-current.json > /tmp/prod-new.json
```

**Variant 2 — legacy origin was a website endpoint (`CustomOriginConfig` present):**

The origin must be converted to a REST + OAC origin; `CustomOriginConfig` and
`S3OriginConfig` are mutually exclusive.

```bash
jq --arg fn "<FUNCTION_ARN>" --arg oac "<OAC_ID>" '
  .DistributionConfig
  | .Origins.Items[0].DomainName = "marinos-aparts-prod.s3.eu-west-1.amazonaws.com"
  | .Origins.Items[0].OriginAccessControlId = $oac
  | del(.Origins.Items[0].CustomOriginConfig)
  | .Origins.Items[0].S3OriginConfig = { "OriginAccessIdentity": "" }
  | .DefaultCacheBehavior.FunctionAssociations = {
      "Quantity": 1,
      "Items": [ { "EventType": "viewer-request", "FunctionARN": $fn } ]
    }
' /tmp/prod-current.json > /tmp/prod-new.json
```

Note in both variants: the origin's `Id` is left unchanged, so
`DefaultCacheBehavior.TargetOriginId` still resolves. Do not rename it.

### C2. Review the diff before sending it

```bash
diff <(jq -S .DistributionConfig /tmp/prod-current.json) <(jq -S . /tmp/prod-new.json)
jq '{Origins: .Origins.Items[0], Fn: .DefaultCacheBehavior.FunctionAssociations, Target: .DefaultCacheBehavior.TargetOriginId, Aliases: .Aliases.Items, Root: .DefaultRootObject}' /tmp/prod-new.json
```

**Gate — read this output and confirm all five:**
- `Aliases` still contains `www.marinos-aparts.gr`
- `DomainName` is `marinos-aparts-prod.s3.eu-west-1.amazonaws.com`
- `FunctionAssociations` has exactly the one viewer-request entry
- `TargetOriginId` matches `Origins.Items[0].Id`
- nothing else changed (certificate, aliases, price class, behaviors)

### C3. Apply

```bash
aws cloudfront update-distribution \
  --id <PROD_DIST_ID> \
  --distribution-config file:///tmp/prod-new.json \
  --if-match "$ETAG"

aws cloudfront wait distribution-deployed --id <PROD_DIST_ID>

aws cloudfront create-invalidation --distribution-id <PROD_DIST_ID> --paths "/*"
```

`--if-match` guarantees nobody else changed the distribution between C1 and C3; a mismatch
aborts the call harmlessly — re-run from C1.

---

## Phase D — Verify production

```bash
for u in "/" "/home.html" "/kimon.html" "/irida.html" "/location.html" "/contact.html"; do
  printf "%-16s " "$u"
  curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" "https://www.marinos-aparts.gr$u"
done
for u in "/en/" "/gr/" "/en/kimon" "/gr/kimon" "/en/irida" "/gr/irida" "/en/location" "/gr/location" "/en/contact" "/gr/contact"; do
  printf "%-16s " "$u"
  curl -s -o /dev/null -w "%{http_code}\n" "https://www.marinos-aparts.gr$u"
done
```

Expected: the first group 301s (`/` and `/home.html` → `/en/`, the rest → their `/en/…`
clean URL); the second group is all 200.

Then in a browser, on the live domain:

- [ ] All 5 pages × 2 locales render; language switch works and persists
- [ ] Galleries open (PhotoSwipe), maps render (Leaflet), weather widget loads in both locales
- [ ] **Contact form — full submit end to end.** This is the only part never tested in any
      environment: it was skipped on staging over the API Gateway CORS restriction. It is
      same-origin on prod so it should pass, but confirm an actual message arrives before
      declaring the cutover done.
- [ ] No console errors; no mixed-content or blocked-request warnings

---

## Rollback

Reverse the atomic swap with the config captured in A2/C1:

```bash
CUR=$(aws cloudfront get-distribution-config --id <PROD_DIST_ID> --query 'ETag' --output text)
jq '.DistributionConfig' /tmp/prod-current.json > /tmp/prod-rollback.json
aws cloudfront update-distribution \
  --id <PROD_DIST_ID> \
  --distribution-config file:///tmp/prod-rollback.json \
  --if-match "$CUR"
aws cloudfront wait distribution-deployed --id <PROD_DIST_ID>
aws cloudfront create-invalidation --distribution-id <PROD_DIST_ID> --paths "/*"
```

`marinos-test-bucket` is untouched throughout, so the legacy site returns intact. **Do not
delete it until after the soak (Task 8).**

### Rollback is not fully symmetric — read before Phase C

The redirect function returns **301 Moved Permanently**. Browsers cache a 301 indefinitely
and stop asking CloudFront. Any visitor who loads `/kimon.html` after the cutover will keep
being sent to `/en/kimon` **even after a rollback**, where the legacy bucket has no such
key — they get a 404 that the rollback cannot reach.

Rollback restores the site for everyone who has not yet hit a 301. It does not fully
restore those who have.

**Recommended:** serve 302 through the soak period, then flip to 301 once prod is settled.
It costs one line plus a function republish, and it makes the rollback genuinely complete:

```
infra/cloudfront/redirects.js
-            statusCode: 301,
-            statusDescription: 'Moved Permanently',
+            statusCode: 302,
+            statusDescription: 'Found',
```

`infra/cloudfront/redirects.test.ts` asserts the status code, so update it in the same
commit, then republish the function (`aws cloudfront update-function` + `publish-function`)
before A6. Flipping back to 301 after the soak is the same edit in reverse, plus a republish
and an invalidation.

Taking the 302 path is a judgement call about how much rollback confidence is worth one
extra function republish — it is not required for a correct cutover.

---

## Phase E — Finalize (Task 8; only after a clean soak)

1. **(CODE, via PR into `astro-migration`)** Delete `.github/workflows/main.yml`; change the
   `deploy-staging.yml` trigger branch from `astro-migration` to `master`. If the 302 option
   was taken, flip `redirects.js` back to 301 in this PR and republish the function.
2. **(OPERATOR)** Merge `astro-migration` → `master`. Per the project's review rule: open the
   PR, wait for review, resolve comments, never auto-merge.
3. **(OPERATOR)** After the soak, decommission `marinos-test-bucket`.
4. Re-run the perf benchmark once the higher-res image backlog item lands — the current
   kimon/irida weight numbers in `docs/astro-migration-results.md` are inflated by
   low-res placeholders and are not a like-for-like win.

---

## Ledger

Fill in as you go.

| Item | Value | Confirmed |
|---|---|---|
| PROD_DIST_ID | | |
| PROD_DIST_ARN | | |
| Legacy origin shape (Variant 1 / 2) | | |
| Origin `Id` (unchanged) | | |
| OAC_ID | | |
| FUNCTION_ARN | | |
| `marinos-aparts-prod` bucket | pre-existing / created | |
| `PROD_DISTRIBUTION_ID` secret set | | |
| Phase B deploy run | | |
| Phase C swap applied (ETag used) | | |
| Phase D verification | | |
| 302-during-soak taken? | | |
| Cutover date | | |

**Known state carried in:** staging `<STAGING_DIST_ID>` / `<STAGING_DOMAIN>`,
function `marinos-redirects` published (`cloudfront-js-2.0`), `STAGING_DISTRIBUTION_ID`
secret set, staging CORS on the contact form still unaddressed.

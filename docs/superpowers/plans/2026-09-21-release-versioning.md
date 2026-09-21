# Release Versioning & Deploy Provenance — Decision + Plan

**Status:** TODO, not started. Raised 2026-09-21 after the Astro cutover.

**Ask:** "add release-please versions instead of deploying the master branch."

**Short answer:** worth doing, but the valuable half is **deploy provenance**, not
semantic versioning. Do the provenance work first — it is small, and it delivers the
safety on its own. release-please then sits on top and gets better with it.

---

## What is actually wrong today

`deploy-prod.yml` runs `actions/checkout@v7` with **no `ref`**, so it builds whatever the
dispatch ref resolves to — `master` HEAD at the moment someone clicks the button.

Two things follow:

1. **Nothing records what is in production.** The only evidence is the workflow run
   history. During the cutover we had to reason from `x-cache` headers and content hashes
   to establish whether production was serving a CI build or a laptop build. That is not a
   position to be in during an incident.
2. **There is nothing good to deploy *to*.** `workflow_dispatch` already accepts a ref —
   `gh workflow run "Deploy Production" --ref <something>` works today. But the repository
   has **no tags and no releases**, so there is nothing stable to point at. Re-deploying
   "what was live last Tuesday" means finding a SHA by hand.

Note what is *not* wrong: the deploy is already manual, already gated on the full test and
parity suite, and already atomic from the viewer's perspective. The pipeline is fine. The
bookkeeping around it is missing.

## Does release-please fit?

**In its favour:**

- Conventional-commit adherence is already **38 of the last 40** non-merge commits. It
  would work essentially out of the box.
- A CHANGELOG has real value here — the site just went through a migration whose reasoning
  lives in commit messages and PR bodies.
- Tags give `deploy-prod` something meaningful to take as a ref.

**Against, honestly:**

- **The version number is ceremony.** Nothing consumes a version of a marketing website.
  There is no such thing as a breaking change to a hotel site's five pages. `v2.0.0` would
  communicate nothing to anyone.
- It **versions the source, not the artifact**. Rolling back still means rebuilding from a
  tag and re-syncing. It does not retain previous builds. If genuine artifact rollback is
  the goal, that is S3 versioning on the bucket, not release-please.
- It adds a **permanently-open bot PR**, immediately after we cut Dependabot noise with
  grouping.
- It expects **squash merges with conventional PR titles**. This repo has been using merge
  commits for feature PRs, so the merge strategy would need to change.

## Recommended order

### 1. Deploy provenance (small, do this first)

Independent of release-please, and the part that actually buys safety.

- Add a `ref` input to `deploy-prod.yml` (default `master`) and pass it to `checkout`, so a
  specific tag or SHA can be deployed and re-deployed deliberately.
- Record what was deployed. Cheapest useful version: write the deployed SHA and timestamp
  to a small object in the bucket (e.g. `.build-info.json`, excluded from the sitemap and
  ignored by the parity gates), so production can always be asked what it is running.
- Consider a GitHub **Environment** for production, which gives a deployment history in the
  UI for free. Protection rules are of limited use with a single maintainer — self-approval
  is theatre — but the history is not.

### 2. release-please (optional polish, after the above)

- `release-type: node` bumps `package.json`; that is harmless but meaningless here.
  `simple` is the more honest choice for a site that publishes nothing.
- Switch to **squash merges** with conventional PR titles so the changelog stays readable.
- Point `deploy-prod` at the release tag rather than `master`.

### 3. Unrelated but adjacent, worth folding in

- **Add `"private": true` to `package.json`.** The repo is public and the manifest has no
  private flag, so nothing prevents an accidental `npm publish` of the whole site source.
  One line, no downside.

## What this does *not* solve

Artifact rollback. Today the rollback story is "repoint the CloudFront origin at the legacy
bucket", and that expires when `marinos-test-bucket` is decommissioned. After that, rolling
back means rebuilding from a tag — which works, but is a *rebuild*, not a restore, and
depends on the build being reproducible from source at that tag.

If restore-not-rebuild is wanted, enable **S3 versioning** on `marinos-aparts-prod`. That is
a separate, cheaper decision than any of the above and arguably matters more.

## Decision needed

Whether to do step 1 only (provenance, ~30 lines, most of the value), or steps 1 and 2
(provenance plus tags and a changelog, plus a workflow change to squash merges).

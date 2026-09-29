# Runbook record — contact endpoint split

Operator record for `docs/superpowers/plans/2026-09-21-prod-contact-endpoint.md`, Tasks 5 to 7.

**No account IDs, function ARNs, email addresses or secrets in this file.** The repository is
public. Values are named, not printed; read them back with the AWS CLI when needed.

---

## Task 5 — functions, versions, aliases. DONE 2026-09-25

| Item | Outcome |
|---|---|
| `marinos-contact-form` | created, `nodejs22.x`, handler `contact/index.handler`, timeout 10s, memory 256MB |
| `marinos-recaptcha-verify` | created, `nodejs22.x`, handler `index.handler`, timeout 10s, memory 128MB |
| Execution roles | reused from the two predecessor functions, unchanged, so SES and logging permissions carry over |
| Published version | `1` on both |
| Aliases | `dev` and `prod`, both pointing at version `1` on both functions |
| Env on `marinos-contact-form` | `RECEIVER_PROD`, `RECEIVER_DEV`, `SENDER`, `RECAPTCHA_SECRET` |
| Env on `marinos-recaptcha-verify` | `RECAPTCHA_SECRET` |
| Recipients | prod = the business gmail; staging = the longer-local-part hotmail identity, chosen by the operator on 2026-09-24 |
| SES verification | no action needed. All four identities already reported `Success`; the sandbox prerequisite was already met |

### Packaging

`marinos-contact-form` imports `../shared/alias-env.mjs`, so the zip preserves that layout:

```
contact/index.mjs
shared/alias-env.mjs
```

which is why the handler is `contact/index.handler` and not `index.handler`. **Do not flatten this
zip** (`zip -j`), or the import fails at cold start. `marinos-recaptcha-verify` has no local imports
and packages flat.

The layout was verified before upload by importing `contact/index.mjs` from the staged directory
with the repo's `node_modules` symlinked in, confirming both the relative import and the SDK import
resolve. Note a bare import test outside the Lambda runtime fails on `@aws-sdk/client-ses`, which is
expected: the runtime provides it and it is a devDependency here precisely so the unit tests can
import it without it shipping in the zip.

### Smoke test (Step 5)

Direct invoke of each alias with a deliberately invalid captcha token:

```
contact-form   dev  -> {"statusCode":403,"body":"{\"error\":\"captcha rejected\"}"}
contact-form   prod -> {"statusCode":403,"body":"{\"error\":\"captcha rejected\"}"}
recaptcha      dev  -> {"statusCode":200,"body":"{\"success\":false}"}
recaptcha      prod -> {"statusCode":200,"body":"{\"success\":false}"}
SES SentLast24Hours: 0.0
```

**A 403 rather than a 502 is the meaningful result.** 502 is what the handler returns when it cannot
reach or parse Google. A 403 means it made the round trip, got a real verdict, and refused. So this
single probe confirms the `nodejs22.x` runtime starts, the AWS SDK v3 import resolves, the
`../shared/` relative import survives packaging, the environment variables are readable, and the
function has working network egress. No mail was sent.

**What it does NOT confirm:** the per-alias recipient split. Both aliases refuse before reaching SES,
so `RECEIVER_DEV` versus `RECEIVER_PROD` is not exercised. That is verified in Task 7 by a real
submission against each environment, which is the only way to see it.

---

## Task 6 — integrations, prod stage, throttling. DONE 2026-09-25

| Step | Outcome |
|---|---|
| Integration type | **Recorded: `AWS`, non-proxy.** This was previously inferred, never verified. It is why API Gateway discards the Lambda `statusCode` and returns HTTP 200 with the envelope in the body, and why the client parses `data.body`. |
| Integrations | Both repointed to `${stageVariables.lambdaAlias}`. Originals captured first as the rollback. |
| Alias permissions | API Gateway granted invoke on all four function/alias combinations. |
| Stage variable | `lambdaAlias=dev` set on `dev` **before** deploying, so no deployed integration ever referenced an unset variable. |
| Deployment | Created, which is the moment the change went live. |
| `prod` stage | Created from the same deployment with `lambdaAlias=prod`. |
| Throttling | 5 rps / burst 10 on both stages. Reserved concurrency 5 on both functions. |
| Alarm | `marinos-contact-invocations-high`, threshold 50/hour. |

### Two things that cost time, worth knowing in advance

**Integration edits do not reach a stage until a deployment.** API Gateway serves the last deployed snapshot. That is what makes the safe ordering possible: rewrite integrations, set the stage variable, *then* deploy. Nothing is live in between.

**Propagation lag is real and looks like failure.** Immediately after `create-deployment`, `/dev` still served the *old* handler's responses. A newly created `prod` stage returned `Forbidden`. Both resolved within a minute. Verifying once and concluding the change had failed would have led to rolling back something that was working. **Wait and re-probe before drawing conclusions.**

## Task 7 — rebuild and verify end to end. DONE 2026-09-29

Production deployed against `/prod` and verified by a real browser submission, which logged `sent PROD` and arrived in the business inbox.

Confirmed in production: the site posts to `/prod`; that stage resolves the `prod` alias; the handler selects `RECEIVER_PROD`; SES accepts; and a POST with no token returns 400 without sending. `/validaterecaptcha` has had **zero invocations** since the cutover, which is the single-verify fix proving itself.

## The email delivery bug, and how it was actually found

Mail landed in junk at Outlook and did not arrive at all at gmail, even though SES reported successful delivery attempts with no bounces.

**Root cause: the messages were completely unauthenticated.** A verified SES domain identity for `marinos-aparts.gr` with DKIM, an SPF `include:amazonses.com`, and a DMARC record were all put in place on 2026-09-25 — and the Lambda was never changed to use them. `SENDER` remained an `@hotmail.com` address, so every message claimed a domain SES had no authority to send for, and none of the DNS work was in the sending path.

**Fix: `SENDER=noreply@marinos-aparts.gr`.** A production submission immediately afterwards arrived in the inbox rather than junk.

Two process lessons, both earned the hard way:

- **Configuring authentication is not the same as using it.** Verify the *sending identity actually changed*, not merely that DNS verified.
- **One probe is not evidence.** This was first mis-diagnosed as sender reputation needing time, on the strength of a single message from a domain with no sending history, minutes after DKIM verified.

## Still open

- Retire `test-function-contact-form` and `test-function-for-recpatch` after a soak. They are orphaned but intact, and they are the rollback: restore the two integration URIs and redeploy.
- The alarm has no SNS action, so it changes state but notifies nobody.
- DMARC aggregate reports now arrive at the business inbox and give real authentication data.

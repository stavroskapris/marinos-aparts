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

## Task 6 — integrations, prod stage, throttling. NOT STARTED

Nothing below has been done. See the plan for the steps.

Carry forward into it:

- **Capture each integration's JSON before changing it.** Task 6 Step 1 also records the integration
  type; the whole client contract depends on proxy versus non-proxy and it is currently inferred
  rather than verified.
- **Step 2 rewrites the integrations on the live `dev` stage**, which production uses right now. That
  is the one step in this runbook that can break the live contact form. The captured JSON is the
  rollback.
- **Set `PROD_CONTACT_API_BASE` only after the prod stage exists** (Step 6, with the warning added to
  the plan). `STAGING_CONTACT_API_BASE` is already set, pointing at `/dev`.

## Task 7 — rebuild and verify end to end. NOT STARTED

The final step submits the real contact form, which sends a genuine enquiry to the business inbox.
That is an operator action.

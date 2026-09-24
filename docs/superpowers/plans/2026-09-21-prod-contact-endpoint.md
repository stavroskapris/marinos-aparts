# Production Contact Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give production its own contact-form endpoint and recipient, leave the existing `dev` stage to staging, and close the unauthenticated-relay hole while both Lambdas are being ported off end-of-life runtimes.

**Architecture:** One REST API (`test-api-contact-form`) gains a second stage. Each stage sets a `lambdaAlias` stage variable, integration URIs resolve the Lambda through `${stageVariables.lambdaAlias}`, and each function carries `dev` + `prod` aliases. Both aliases point at the **same published version**; the handler reads its alias out of `context.invokedFunctionArn` and selects environment-specific config from suffixed env vars, so a code change needs one publish rather than two. The Lambda source moves into this repo so it is reviewable and unit-testable.

**Tech Stack:** AWS Lambda (Node.js 22.x), AWS SDK v3 (`@aws-sdk/client-ses`), API Gateway REST (stages + stage variables), Amazon SES, Vitest, Astro build-time env vars.

**Spec:** No separate spec document — the decisions this plan implements are recorded in **Background & Decisions** below, which serves as the spec. Cutover context: `docs/superpowers/runbook-cutover.md`.

## Global Constraints

- **Runtime: `nodejs22.x`** for both functions. The current `nodejs10.x`/`nodejs12.x` are past end of life.
- **AWS SDK v3 only.** Node 18+ Lambda runtimes do **not** bundle `aws-sdk` v2. The existing contact handler's `require('aws-sdk')` will throw at cold start on 22.x. Use `@aws-sdk/client-ses`.
- **Region `eu-west-1`** for every AWS call; the admin profile is `stavros-administrator`.
- **This repository is public.** Never commit AWS account IDs, API IDs, distribution IDs, email addresses, or the reCAPTCHA secret. Config values are env vars set out-of-band; tests use fixtures.
- **SES is in sandbox** (200 msg/24h, 1 msg/s). Every recipient *and* sender must be a verified SES identity. The staging recipient must be verified before Task 5, or staging sends will fail.
- **Do not break the live form.** Production is serving the Astro build as of 2026-09-21. The `dev` stage stays functional throughout; the prod stage is additive until Task 7 switches the front-end over.
- Existing repo conventions: local TS imports without a file extension, `.astro` imports with it, JSON without import assertions. Unit tests are Vitest (`npm run test:unit`), which already includes `infra/**/*.test.ts`.

---

## Background & Decisions

### Current state (verified 2026-09-21)

| Thing | Value |
|---|---|
| REST API | `test-api-contact-form`, one stage `dev`, no stage variables |
| `/contact` POST | → Lambda `test-function-contact-form` (`nodejs12.x`, env `receiver`, `sender`) |
| `/validaterecaptcha` POST | → Lambda `test-function-for-recpatch` (`nodejs10.x`, env `SECRET`, `VERIFY_HOST`, `VERIFY_PATH`) |
| Integration URIs | hardcode the function ARN — **no** stage variable, so a new stage alone would hit the same function |
| CORS | `access-control-allow-origin: *`, `OPTIONS,POST` |
| Front-end | `src/config.ts`, baked at build time; staging and prod build identical config |

### Decisions

1. **Separation via stage + Lambda aliases.** One API, one codebase, real routing separation, per-environment config. Chosen over a stage-only change (cosmetic — same function, same recipient) and over a fully separate API + functions (maximum isolation, but duplicates everything).
2. **Separate recipients.** Production delivers to the business inbox; staging delivers to a test inbox, so test submissions stop reaching the business. This is the main functional reason to split.
3. **Runtime upgrade included.** Both handlers move to `nodejs22.x` in this plan. AWS blocks code/config updates on deprecated runtimes, so leaving them would block every future handler change — including the security fix below.
4. **Per-alias config via alias-suffixed env vars, not per-version env vars.** Lambda environment variables are captured in the published version, so giving aliases different values the naive way forces two publishes per change and lets them drift. Instead both aliases point at one version and the handler resolves `RECEIVER_DEV` / `RECEIVER_PROD` from its own invoked ARN.

### Scope addition, and why

Tasks 1–2 also fix a live security defect. Flagging it explicitly because it is **wider than the endpoint split that was asked for**, and it is included only because the alternative is duplicating the defect into a brand-new production stage:

- **`/contact` verifies nothing.** The front-end checks the captcha against `/validaterecaptcha`, then makes a *separate* call to `/contact` carrying only `{name, email, subject, message}`. No token reaches `/contact`, and it does not ask for one. With CORS `*` and no auth, anything that can reach the URL can send mail through the SES identity, choosing the subject and the reply-to address.
- **The verify Lambda always reports success.** `verify()` resolves `'Success'` from inside the `https.request` response callback, before any body is read, and Google's `success` field is never parsed. A wrong or replayed captcha verifies clean, so even the front-end gate is decorative.
- **Severity is bounded by the SES sandbox:** delivery is limited to already-verified identities (so third parties cannot be spammed) and to 200 messages/24h. The realistic impact is up to 200 attacker-authored emails a day into the business inbox, each with an attacker-chosen reply-to — a phishing vector aimed at whoever reads that inbox, plus exhaustion of the daily quota so genuine enquiries silently fail.
- **Fix:** `/contact` takes the token and verifies it server-side against Google before sending, rejecting on failure. **`/contact` is the sole verifier.** reCAPTCHA response tokens are single-use — Google's `siteverify` consumes a token on first verification and returns `{"success":false,"error-codes":["timeout-or-duplicate"]}` for every later attempt — so a pre-submit check against `/validaterecaptcha` cannot coexist with it: the pre-check would burn the token and the real check would then reject every legitimate submission, while the attacker path (post a fresh token straight to `/contact`) would be unaffected. The front-end therefore only checks that a token is *present* before submitting, which does not consume it, and distinguishes "captcha rejected" from "send failed" by reading the `403` in the response envelope. `/validaterecaptcha` stays deployed as the runbook's routing probe and as the rollback surface, with no front-end consumer.

If you would rather ship the endpoint split alone, cut Task 1 Steps 5–8 and Task 2 entirely — but then the new prod endpoint inherits the relay, and the runtime upgrade still has to happen before it can ever be fixed.

---

## File Structure

```
infra/lambda/contact-form/
  index.mjs                  # NEW: SES send + server-side captcha verification
  index.test.ts              # NEW: unit tests (SES + fetch injected)
infra/lambda/recaptcha-verify/
  index.mjs                  # NEW: Google verify, parses the real verdict
  index.test.ts              # NEW: unit tests (fetch injected)
infra/lambda/shared/
  alias-env.mjs              # NEW: resolve alias from invoked ARN -> env suffix
  alias-env.test.ts          # NEW: unit tests
src/config.ts                # MODIFY: derive endpoints from a build-time base
.github/workflows/deploy-staging.yml   # MODIFY: set the staging API base
.github/workflows/deploy-prod.yml      # MODIFY: set the production API base
docs/superpowers/runbook-contact-split.md  # NEW (Task 5): operator record
```

`.mjs` because the Lambda `nodejs22.x` runtime treats `.mjs` as an ES module regardless of any `package.json`, and there is no `package.json` inside these function directories. `@aws-sdk/client-ses` is provided by the runtime, so nothing needs bundling.

---

## Task 1: Contact Lambda — SDK v3, alias-aware config, server-side verification

**Files:**
- Create: `infra/lambda/shared/alias-env.mjs`
- Create: `infra/lambda/shared/alias-env.test.ts`
- Create: `infra/lambda/contact-form/index.mjs`
- Create: `infra/lambda/contact-form/index.test.ts`

**Interfaces:**
- Produces: `aliasEnv(invokedFunctionArn)` → `'DEV' | 'PROD'`, from `infra/lambda/shared/alias-env.mjs`. Task 2 consumes it.
- Produces: `handler(event, context)` in `infra/lambda/contact-form/index.mjs`, returning `{ statusCode, body }` where `body` is a JSON string. Task 3's front-end consumes that shape.
- Produces: `makeHandler({ ses, fetchImpl })` from the same file — the injectable factory the tests drive. `handler` is `makeHandler()` with real dependencies.

- [ ] **Step 1: Write the failing test for alias resolution**

Create `infra/lambda/shared/alias-env.test.ts`:

```ts
import { test, expect } from 'vitest';
import { aliasEnv } from './alias-env.mjs';

test('reads the alias suffix from a qualified invoked ARN', () => {
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form:prod')).toBe('PROD');
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form:dev')).toBe('DEV');
});

test('defaults to DEV for an unqualified ARN', () => {
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form')).toBe('DEV');
});

test('defaults to DEV for a numeric version rather than an alias', () => {
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form:7')).toBe('DEV');
});

test('defaults to DEV when the ARN is missing entirely', () => {
  expect(aliasEnv(undefined)).toBe('DEV');
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run infra/lambda/shared/alias-env.test.ts`
Expected: FAIL — cannot resolve `./alias-env.mjs`.

- [ ] **Step 3: Implement the minimal code to make the test pass**

Create `infra/lambda/shared/alias-env.mjs`:

```js
// Both aliases point at the same published version, so per-version environment
// variables cannot differ. The handler instead resolves which environment it is
// running as from its own invoked ARN and reads the matching suffixed variable.
export function aliasEnv(invokedFunctionArn) {
  if (!invokedFunctionArn) return 'DEV';
  const parts = invokedFunctionArn.split(':');
  // Unqualified: arn:aws:lambda:region:acct:function:name        (7 parts)
  // Qualified:   arn:aws:lambda:region:acct:function:name:alias  (8 parts)
  if (parts.length < 8) return 'DEV';
  const qualifier = parts[7];
  if (qualifier === 'prod') return 'PROD';
  return 'DEV';
}
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run infra/lambda/shared/alias-env.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Write the failing tests for the contact handler**

Create `infra/lambda/contact-form/index.test.ts`:

```ts
import { test, expect, vi } from 'vitest';
import { makeHandler } from './index.mjs';

const ctx = (alias = 'prod') => ({
  invokedFunctionArn: `arn:aws:lambda:eu-west-1:1:function:contact-form:${alias}`,
});

const validEvent = {
  name: 'Ada',
  email: 'ada@example.com',
  subject: 'Booking enquiry',
  message: 'Do you have a room free in June?',
  captchaResponse: 'token-abc',
};

function deps({ captchaOk = true, sendOk = true } = {}) {
  const send = vi.fn(() => (sendOk ? Promise.resolve({}) : Promise.reject(new Error('ses down'))));
  const fetchImpl = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ success: captchaOk }) }),
  );
  return { ses: { send }, fetchImpl, send };
}

function env() {
  process.env.RECEIVER_PROD = 'prod-inbox@example.com';
  process.env.RECEIVER_DEV = 'staging-inbox@example.com';
  process.env.SENDER = 'noreply@example.com';
  process.env.RECAPTCHA_SECRET = 'shhh';
}

test('sends to the PROD recipient when invoked through the prod alias', async () => {
  env();
  const d = deps();
  const res = await makeHandler(d)(validEvent, ctx('prod'));
  expect(res.statusCode).toBe(200);
  const cmd = d.send.mock.calls[0][0];
  expect(cmd.input.Destination.ToAddresses).toEqual(['prod-inbox@example.com']);
});

test('sends to the DEV recipient when invoked through the dev alias', async () => {
  env();
  const d = deps();
  await makeHandler(d)(validEvent, ctx('dev'));
  expect(d.send.mock.calls[0][0].input.Destination.ToAddresses).toEqual([
    'staging-inbox@example.com',
  ]);
});

test('rejects with 403 and sends nothing when the captcha fails', async () => {
  env();
  const d = deps({ captchaOk: false });
  const res = await makeHandler(d)(validEvent, ctx());
  expect(res.statusCode).toBe(403);
  expect(d.send).not.toHaveBeenCalled();
});

test('rejects with 400 when the captcha token is absent', async () => {
  env();
  const d = deps();
  const { captchaResponse, ...noToken } = validEvent;
  const res = await makeHandler(d)(noToken, ctx());
  expect(res.statusCode).toBe(400);
  expect(d.send).not.toHaveBeenCalled();
  expect(d.fetchImpl).not.toHaveBeenCalled();
});

test('rejects with 400 on a missing or malformed field', async () => {
  env();
  for (const bad of [
    { ...validEvent, name: '' },
    { ...validEvent, email: 'not-an-email' },
    { ...validEvent, subject: '' },
    { ...validEvent, message: '' },
  ]) {
    const d = deps();
    const res = await makeHandler(d)(bad, ctx());
    expect(res.statusCode).toBe(400);
    expect(d.send).not.toHaveBeenCalled();
  }
});

test('strips CR and LF from the subject so headers cannot be injected', async () => {
  env();
  const d = deps();
  await makeHandler(d)({ ...validEvent, subject: 'Hi\r\nBcc: victim@example.com' }, ctx());
  expect(d.send.mock.calls[0][0].input.Message.Subject.Data).toBe('Hi Bcc: victim@example.com');
});

test('returns 502 when SES rejects the send', async () => {
  env();
  const d = deps({ sendOk: false });
  const res = await makeHandler(d)(validEvent, ctx());
  expect(res.statusCode).toBe(502);
});

test('accepts a JSON string body, as API Gateway proxy integrations deliver it', async () => {
  env();
  const d = deps();
  const res = await makeHandler(d)({ body: JSON.stringify(validEvent) }, ctx());
  expect(res.statusCode).toBe(200);
  expect(d.send).toHaveBeenCalled();
});
```

- [ ] **Step 6: Run them to make sure they fail**

Run: `npx vitest run infra/lambda/contact-form/index.test.ts`
Expected: FAIL — cannot resolve `./index.mjs`.

- [ ] **Step 7: Implement the handler**

Create `infra/lambda/contact-form/index.mjs`:

```js
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { aliasEnv } from '../shared/alias-env.mjs';

const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// CR/LF in a header field lets a caller append arbitrary headers. The subject is
// the only caller-controlled value that reaches a header, but strip both it and
// the reply-to address for good measure.
const oneLine = (s) => String(s).replace(/[\r\n]+/g, ' ').trim();

function readPayload(event) {
  // Direct (non-proxy) integrations deliver the parsed body as the event itself;
  // a proxy integration delivers it as event.body, a JSON string.
  if (event && typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch {
      return {};
    }
  }
  return event || {};
}

function validate(p) {
  if (!p.captchaResponse || typeof p.captchaResponse !== 'string') return 'captcha-missing';
  if (!p.name || String(p.name).trim().length < 3) return 'name';
  if (!p.email || !EMAIL_RE.test(String(p.email))) return 'email';
  if (!p.subject || String(p.subject).trim().length < 5) return 'subject';
  if (!p.message || String(p.message).trim().length < 10) return 'message';
  return null;
}

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

export function makeHandler({ ses, fetchImpl }) {
  return async function handler(event, context) {
    const env = aliasEnv(context && context.invokedFunctionArn);
    const receiver = process.env[`RECEIVER_${env}`];
    const sender = process.env.SENDER;
    const secret = process.env.RECAPTCHA_SECRET;

    if (!receiver || !sender || !secret) {
      console.error(`misconfigured: env=${env} receiver=${!!receiver} sender=${!!sender} secret=${!!secret}`);
      return reply(500, { error: 'misconfigured' });
    }

    const payload = readPayload(event);
    const bad = validate(payload);
    if (bad === 'captcha-missing') return reply(400, { error: 'captcha required' });
    if (bad) return reply(400, { error: `invalid ${bad}` });

    // Verify server-side. This is the only gate that counts: the endpoint is
    // reachable without going through the form at all.
    let verdict;
    try {
      const res = await fetchImpl(VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: payload.captchaResponse }).toString(),
      });
      verdict = await res.json();
    } catch (err) {
      console.error(`captcha verify failed: ${err && err.message}`);
      return reply(502, { error: 'captcha verify unavailable' });
    }
    if (!verdict || verdict.success !== true) {
      console.warn(`captcha rejected: ${JSON.stringify(verdict && verdict['error-codes'])}`);
      return reply(403, { error: 'captcha rejected' });
    }

    const command = new SendEmailCommand({
      Destination: { ToAddresses: [receiver] },
      Message: {
        Subject: { Data: oneLine(payload.subject) },
        Body: {
          Text: {
            Data: `Name: ${payload.name}\nEmail: ${payload.email}\n\n${payload.message}`,
          },
        },
      },
      Source: sender,
      ReplyToAddresses: [oneLine(payload.email)],
    });

    try {
      await ses.send(command);
    } catch (err) {
      console.error(`ses send failed: ${err && err.message}`);
      return reply(502, { error: 'send failed' });
    }
    return reply(200, { ok: true });
  };
}

export const handler = makeHandler({
  ses: new SESClient({}),
  fetchImpl: globalThis.fetch,
});
```

- [ ] **Step 8: Run the tests and make sure they pass**

Run: `npx vitest run infra/lambda/contact-form/index.test.ts infra/lambda/shared/alias-env.test.ts`
Expected: PASS — 8 contact tests + 4 alias tests.

- [ ] **Step 9: Confirm the whole unit suite still passes**

Run: `npm run test:unit`
Expected: PASS. The existing 13 tests plus the 12 new ones.

- [ ] **Step 10: Commit**

```bash
git add infra/lambda/shared infra/lambda/contact-form
git commit -m "feat(lambda): contact handler on SDK v3 with server-side captcha verification"
```

---

## Task 2: reCAPTCHA Lambda — parse the real verdict, drop shared mutable state

**Files:**
- Create: `infra/lambda/recaptcha-verify/index.mjs`
- Create: `infra/lambda/recaptcha-verify/index.test.ts`

**Interfaces:**
- Consumes: nothing from Task 1 at runtime. (It deliberately does **not** use `aliasEnv` — the secret is the same in both environments, so there is no per-alias config here.)
- Produces: `handler(event)` — **one parameter, no `context`**, because there is no per-alias config to resolve here. It returns `{ statusCode, body }` with `body` a JSON string of `{ success: boolean }`. Keep the single-parameter signature in the tests too; calling `handler(event, {})` is a type error (`ts(2554)`) and `npx astro check` will fail on it.
- Consumed by: **nothing in the front-end.** `/contact` is the sole captcha verifier (see *Scope addition*), because reCAPTCHA tokens are single-use. This function exists as the runbook's routing probe and as the rollback surface.

- [ ] **Step 1: Write the failing tests**

Create `infra/lambda/recaptcha-verify/index.test.ts`:

```ts
import { test, expect, vi } from 'vitest';
import { makeHandler } from './index.mjs';

const fetchReturning = (body, ok = true) =>
  vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }));

test('reports success only when Google says success', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({ fetchImpl: fetchReturning({ success: true }) })(
    { captchaResponse: 'tok' },
  );
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ success: true });
});

test('reports failure when Google rejects the token', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({
    fetchImpl: fetchReturning({ success: false, 'error-codes': ['invalid-input-response'] }),
  })({ captchaResponse: 'bad' });
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ success: false });
});

test('rejects a request with no token without calling Google', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const fetchImpl = fetchReturning({ success: true });
  const res = await makeHandler({ fetchImpl })({});
  expect(res.statusCode).toBe(400);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('does not leak verdicts between invocations', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const h1 = makeHandler({ fetchImpl: fetchReturning({ success: true }) });
  const h2 = makeHandler({ fetchImpl: fetchReturning({ success: false }) });
  await h1({ captchaResponse: 'a' });
  const second = await h2({ captchaResponse: 'b' });
  expect(JSON.parse(second.body)).toEqual({ success: false });
});

test('surfaces a transport failure as 502', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({
    fetchImpl: vi.fn(() => Promise.reject(new Error('network'))),
  })({ captchaResponse: 'tok' });
  expect(res.statusCode).toBe(502);
});

test('accepts a JSON string body', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({ fetchImpl: fetchReturning({ success: true }) })(
    { body: JSON.stringify({ captchaResponse: 'tok' }) },
  );
  expect(JSON.parse(res.body)).toEqual({ success: true });
});
```

- [ ] **Step 2: Run them to make sure they fail**

Run: `npx vitest run infra/lambda/recaptcha-verify/index.test.ts`
Expected: FAIL — cannot resolve `./index.mjs`.

- [ ] **Step 3: Implement the handler**

Create `infra/lambda/recaptcha-verify/index.mjs`:

```js
const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

function readPayload(event) {
  if (event && typeof event.body === 'string') {
    try {
      return JSON.parse(event.body);
    } catch {
      return {};
    }
  }
  return event || {};
}

const reply = (statusCode, body) => ({ statusCode, body: JSON.stringify(body) });

export function makeHandler({ fetchImpl }) {
  // No module-scope response object: the previous implementation mutated one
  // shared across invocations in a warm container, so a verdict could leak from
  // one request into the next.
  return async function handler(event) {
    const secret = process.env.RECAPTCHA_SECRET;
    if (!secret) {
      console.error('misconfigured: RECAPTCHA_SECRET unset');
      return reply(500, { error: 'misconfigured' });
    }

    const { captchaResponse } = readPayload(event);
    if (!captchaResponse || typeof captchaResponse !== 'string') {
      return reply(400, { error: 'captcha required' });
    }

    let verdict;
    try {
      const res = await fetchImpl(VERIFY_URL, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        // The secret goes in the body, not the query string, so it stays out of
        // intermediary access logs.
        body: new URLSearchParams({ secret, response: captchaResponse }).toString(),
      });
      verdict = await res.json();
    } catch (err) {
      console.error(`captcha verify failed: ${err && err.message}`);
      return reply(502, { error: 'captcha verify unavailable' });
    }

    return reply(200, { success: verdict && verdict.success === true });
  };
}

export const handler = makeHandler({ fetchImpl: globalThis.fetch });
```

- [ ] **Step 4: Run the tests and make sure they pass**

Run: `npx vitest run infra/lambda/recaptcha-verify/index.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Confirm the whole unit suite still passes**

Run: `npm run test:unit`
Expected: PASS — 13 existing + 18 new.

- [ ] **Step 6: Commit**

```bash
git add infra/lambda/recaptcha-verify
git commit -m "fix(lambda): verify the real reCAPTCHA verdict, drop shared response state"
```

---

## Task 3: Front-end — per-environment endpoint and send the token to `/contact`

**Files:**
- Modify: `src/config.ts`
- Modify: `src/components/ContactForm.astro:78-128`
- Create: `src/config.test.ts`

**Interfaces:**
- Consumes: the `{ success: boolean }` body shape from Task 2 and the `{ ok: true }` / `{ error }` shape from Task 1.
- Produces: `API_BASE` and `API_ENDPOINTS` from `src/config.ts`, where `API_BASE` comes from `import.meta.env.PUBLIC_CONTACT_API_BASE` and falls back to the existing `dev` URL so a local `npm run dev` keeps working with no env file.

- [ ] **Step 1: Write the failing test for config derivation**

Create `src/config.test.ts`:

```ts
import { test, expect } from 'vitest';
import { buildEndpoints } from './config';

test('derives both endpoints from a base url', () => {
  expect(buildEndpoints('https://api.example.com/prod')).toEqual({
    contact: 'https://api.example.com/prod/contact',
    recaptcha: 'https://api.example.com/prod/validaterecaptcha',
  });
});

test('tolerates a trailing slash on the base', () => {
  expect(buildEndpoints('https://api.example.com/prod/').contact).toBe(
    'https://api.example.com/prod/contact',
  );
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL — `buildEndpoints` is not exported.

- [ ] **Step 3: Rewrite `src/config.ts`**

Replace the whole file with:

```ts
// The API base is baked at build time. Each deploy workflow sets
// PUBLIC_CONTACT_API_BASE so staging and production build different endpoints
// from identical source. The fallback is the staging stage, so `npm run dev`
// works with no env file.
const FALLBACK_BASE = 'https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/dev';

export function buildEndpoints(base: string) {
  const b = base.replace(/\/+$/, '');
  return {
    contact: `${b}/contact`,
    recaptcha: `${b}/validaterecaptcha`,
  };
}

export const API_BASE = import.meta.env.PUBLIC_CONTACT_API_BASE || FALLBACK_BASE;
export const API_ENDPOINTS = buildEndpoints(API_BASE);

export const RECAPTCHA_SITE_KEY = '6LcglLUUAAAAAF_UyVCnbs1Jv4aLFlrDigWo0Y28';
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/config.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 5: Make `/contact` the sole verifier and send it the token**

**Delete `verifyCaptcha` and its call entirely.** reCAPTCHA response tokens are single-use, so there can be exactly one verifier, and it is `/contact` — the endpoint that decides whether mail is sent. Calling `/validaterecaptcha` first would consume the token, and `/contact` would then reject every legitimate submission with a 403 while the attacker path stayed open. All the client may do is check the token is **present**, which does not consume it:

```js
      const token = (window.grecaptcha && window.grecaptcha.getResponse()) || '';
      if (!token) { flash('recaptcha_message'); return; }

      show('generic-loader', true);
      try {
        const payload = {
          name: $('contact_name').value,
          email: $('contact_email').value,
          subject: $('contact_subject').value,
          message: $('contact_message').value,
          captchaResponse: token,
        };
```

Then replace the success check after the contact fetch. The handler now returns `{ ok: true }` or `{ error }`, and the "captcha rejected" / "send failed" distinction the user sees comes from the status code **inside the envelope**, not from `res.status` — the integration is non-proxy, so API Gateway answers HTTP 200 and hands back `{"statusCode":403,"body":"{\"error\":\"captcha rejected\"}"}`:

```js
        const data = await res.json().catch(() => ({}));
        const parsed = typeof data.body === 'string' ? JSON.parse(data.body) : data;
        if (parsed.ok !== true) {
          if (data.statusCode === 403 || res.status === 403) { flash('recaptcha_message'); return; }
          throw new Error('send rejected');
        }
```

`endpoints.recaptcha` stays in `src/config.ts` — the runbook curls it as a routing probe and it is the rollback surface — but nothing in the component uses it.

> Keep the `Content-Type: application/x-www-form-urlencoded; charset=UTF-8` header on the remaining fetch. It is deliberate — it keeps the request CORS-simple so no preflight is needed, and the body stays a JSON string, which is what `readPayload` in Tasks 1–2 parses.

- [ ] **Step 6: Run the e2e suite**

Run: `npm test`
Expected: PASS, 32 tests. `tests/contact.spec.ts` exercises validation and the captcha gate; it must still pass because the field validation and error-message behaviour are unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/config.test.ts src/components/ContactForm.astro
git commit -m "feat(contact): per-environment api base, send captcha token to /contact"
```

---

## Task 4: Point the deploy workflows at the right stage

**Files:**
- Modify: `.github/workflows/deploy-staging.yml`
- Modify: `.github/workflows/deploy-prod.yml`

**Interfaces:**
- Consumes: `PUBLIC_CONTACT_API_BASE` as read by `src/config.ts` from Task 3.
- Produces: nothing consumed by later tasks. Task 5's runbook depends on these being in place before the production build is re-run.

> **Set it at JOB scope, never on the build step alone.** Two later steps rebuild `dist/`: `npm run test:unit` runs `infra/cloudfront/no-stub.test.ts`, which shells out to `npm run build`, and `npm test` rebuilds through `playwright.config.ts`'s `webServer.command` (`npm run build && npm run preview`, with `reuseExistingServer: !process.env.CI`, i.e. always rebuilding in CI). `astro build` empties `outDir` first, so a step-scoped variable leaves the artifact that reaches `aws s3 sync` built with it **unset** — the whole task becomes a silent no-op and production enquiries go to the staging inbox.

- [ ] **Step 1: Add the env var at job scope in the staging workflow**

In `.github/workflows/deploy-staging.yml`, on the `deploy` job (alongside `environment:`, not replacing it), and remove any `env:` from the `npm run build` step:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: staging
    env:
      PUBLIC_CONTACT_API_BASE: ${{ vars.STAGING_CONTACT_API_BASE }}
```

- [ ] **Step 2: Add the env var at job scope in the production workflow**

Same shape in `.github/workflows/deploy-prod.yml`, keeping the existing `environment:` block:

```yaml
jobs:
  deploy:
    runs-on: ubuntu-latest
    environment:
      name: production
      url: https://www.marinos-aparts.gr
    env:
      PUBLIC_CONTACT_API_BASE: ${{ vars.PROD_CONTACT_API_BASE }}
```

These are repository **variables**, not secrets — the URL is public, it ships in the client bundle. Using `vars` keeps it visible and diffable.

- [ ] **Step 2b: Verify the final artifact, immediately before the sync**

Add this to **both** workflows, after `npm run build:info` and directly before `aws s3 sync`, so it observes the artifact that is actually uploaded rather than an earlier build a later step overwrote:

```yaml
      - name: Verify the built bundle targets the intended contact API
        run: |
          test -n "$PUBLIC_CONTACT_API_BASE" || { echo "PUBLIC_CONTACT_API_BASE is unset"; exit 1; }
          grep -q "${PUBLIC_CONTACT_API_BASE%/}/contact" dist/en/contact/index.html
```

The first line matters on its own: GitHub substitutes an **empty string** for an undefined `vars.*`, so a missing or misspelled repository variable would otherwise produce a perfectly valid production build silently pointing at the fallback stage, with nothing failing.

- [ ] **Step 3: Verify the YAML parses**

Run: `npx --yes yaml-lint .github/workflows/deploy-staging.yml .github/workflows/deploy-prod.yml`
Expected: no errors.

- [ ] **Step 4: Confirm the fallback still builds with no variable set**

Run: `npm run build && grep -rc "execute-api" dist/en/contact/index.html`
Expected: build succeeds; the count is at least 1 (the fallback staging base is baked in, since no env var is set locally).

Then prove the verification step would catch a clobbered build — the defect it exists for:

```bash
rm -rf dist
PUBLIC_CONTACT_API_BASE="https://EXAMPLE-PROD.execute-api.eu-west-1.amazonaws.com/prod" npm run build >/dev/null
npm run test:unit >/dev/null 2>&1   # rebuilds dist without the variable
PUBLIC_CONTACT_API_BASE="https://EXAMPLE-PROD.execute-api.eu-west-1.amazonaws.com/prod" \
  grep -q "${PUBLIC_CONTACT_API_BASE%/}/contact" dist/en/contact/index.html; echo "grep exit=$?"
```
Expected: `grep exit=1` — the clobbered artifact is rejected. Re-run with the variable `export`ed for the whole shell (which is what job scope produces) and it exits 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy-staging.yml .github/workflows/deploy-prod.yml
git commit -m "ci: build each environment against its own contact api base"
```

---

## Task 5: [RUNBOOK] Deploy the functions, publish versions, create aliases

> **Operator steps — run with AWS credentials (`--profile stavros-administrator --region eu-west-1`). Not agent-dispatchable.** Record every id and decision in `docs/superpowers/runbook-contact-split.md` as you go.

**Files:** Create `docs/superpowers/runbook-contact-split.md` to log ids, ARNs and decisions.

Set `export AWS="aws --profile stavros-administrator --region eu-west-1"` for these steps.

- [ ] **Step 1: Verify the staging recipient is an SES-verified identity**

SES is in sandbox, so an unverified recipient silently fails.

```bash
$AWS ses list-identities --query 'Identities' --output table
$AWS ses get-identity-verification-attributes --identities "<staging-inbox>" \
  --query 'VerificationAttributes.*.VerificationStatus' --output text
```
Expected: `Success`. If not, verify it (`$AWS ses verify-email-identity --email-address "<staging-inbox>"`) and click the confirmation link before continuing.

- [ ] **Step 2: Package and create the two new functions on nodejs22.x**

New functions rather than in-place updates: AWS blocks updates to deprecated-runtime functions, and leaving the originals untouched keeps rollback trivial.

The contact handler imports `../shared/alias-env.mjs`, so the zip must preserve
that relative layout — **do not** use `zip -j`, which flattens paths and would
break the import at cold start.

```bash
cd infra/lambda
rm -rf /tmp/pkg && mkdir -p /tmp/pkg/contact /tmp/pkg/shared
cp contact-form/index.mjs   /tmp/pkg/contact/index.mjs
cp shared/alias-env.mjs     /tmp/pkg/shared/alias-env.mjs
rm -f /tmp/contact.zip && (cd /tmp/pkg && zip -qr /tmp/contact.zip contact shared)
unzip -l /tmp/contact.zip    # expect: contact/index.mjs and shared/alias-env.mjs
```

Because `index.mjs` sits at `contact/index.mjs` inside the archive, the handler
is `contact/index.handler`.

The verify function has no local imports, so it packages flat:

```bash
rm -f /tmp/recaptcha.zip && (cd infra/lambda/recaptcha-verify && zip -q /tmp/recaptcha.zip index.mjs)
unzip -l /tmp/recaptcha.zip  # expect: index.mjs
```

```bash
$AWS lambda create-function \
  --function-name marinos-contact-form \
  --runtime nodejs22.x \
  --role "<existing execution role arn of test-function-contact-form>" \
  --handler contact/index.handler \
  --timeout 10 --memory-size 256 \
  --zip-file fileb:///tmp/contact.zip

$AWS lambda create-function \
  --function-name marinos-recaptcha-verify \
  --runtime nodejs22.x \
  --role "<existing execution role arn of test-function-for-recpatch>" \
  --handler index.handler \
  --timeout 10 --memory-size 128 \
  --zip-file fileb:///tmp/recaptcha.zip
```

Read the existing roles first, so SES and logging permissions carry over:
```bash
$AWS lambda get-function-configuration --function-name test-function-contact-form --query Role --output text
$AWS lambda get-function-configuration --function-name test-function-for-recpatch --query Role --output text
```
Verification: `$AWS lambda get-function-configuration --function-name marinos-contact-form --query '[Runtime,Handler]' --output text` → `nodejs22.x  contact/index.handler`.

- [ ] **Step 3: Set the environment variables**

Both aliases share one version, so all values live here at once.

```bash
$AWS lambda update-function-configuration --function-name marinos-contact-form \
  --environment "Variables={RECEIVER_PROD=<business-inbox>,RECEIVER_DEV=<staging-inbox>,SENDER=<verified-sender>,RECAPTCHA_SECRET=<secret>}"

$AWS lambda update-function-configuration --function-name marinos-recaptcha-verify \
  --environment "Variables={RECAPTCHA_SECRET=<secret>}"
```

Read the current secret and sender off the old functions rather than hunting for them:
```bash
$AWS lambda get-function-configuration --function-name test-function-for-recpatch --query 'Environment.Variables.SECRET' --output text
$AWS lambda get-function-configuration --function-name test-function-contact-form --query 'Environment.Variables.sender' --output text
```
Verification: `$AWS lambda get-function-configuration --function-name marinos-contact-form --query 'Environment.Variables | keys(@)' --output text` lists all four keys. **Do not paste any of these values into the repo, a PR, or a commit message.**

- [ ] **Step 4: Publish a version and create both aliases**

```bash
for fn in marinos-contact-form marinos-recaptcha-verify; do
  V=$($AWS lambda publish-version --function-name $fn --query Version --output text)
  echo "$fn version $V"
  $AWS lambda create-alias --function-name $fn --name dev  --function-version "$V"
  $AWS lambda create-alias --function-name $fn --name prod --function-version "$V"
done
```
Verification: `$AWS lambda list-aliases --function-name marinos-contact-form --query 'Aliases[].[Name,FunctionVersion]' --output text` shows `dev` and `prod` on the same version.

- [ ] **Step 5: Smoke-test each alias directly, before API Gateway is involved**

This sends real email to each recipient — expected, and the point of the test.

```bash
cat > /tmp/probe.json <<'JSON'
{"name":"Alias probe","email":"<your-address>","subject":"Alias smoke test","message":"Direct invoke, ignore this message.","captchaResponse":"deliberately-invalid"}
JSON

for alias in dev prod; do
  echo "--- $alias ---"
  $AWS lambda invoke --function-name "marinos-contact-form:$alias" \
    --payload fileb:///tmp/probe.json /tmp/out.json >/dev/null
  cat /tmp/out.json; echo
done
```
Expected: **`{"statusCode":403,...}` for both** — the token is invalid, so verification correctly refuses and no mail is sent. That single result proves the runtime loads, the SDK v3 import resolves, the env is readable, and the captcha gate is live. A `502` means the function could not reach Google; a `500` means an env var is missing.

To prove delivery end to end you need a real token, which only the browser can mint — that happens in Task 6 Step 4.

- [ ] **Step 6: Record everything in the runbook**

Write `docs/superpowers/runbook-contact-split.md` with: the two function names, the execution role ARNs, the published version number, both alias names, which env keys are set (**keys only, never values**), and the date. This is the file the next operator reads.

- [ ] **Step 7: Commit the runbook**

```bash
git add docs/superpowers/runbook-contact-split.md
git commit -m "docs: record the contact endpoint split runbook"
```

---

## Task 6: [RUNBOOK] Convert the integrations to stage variables and add the prod stage

> **Operator steps. This is the part that can break the live form — the `dev` stage's integrations change in place.** Rollback is documented at the end of this task.

- [ ] **Step 1: Capture the current integrations so a rollback is possible**

```bash
API=8vgfxd8lde
for path in contact validaterecaptcha; do
  ID=$($AWS apigateway get-resources --rest-api-id $API \
        --query "items[?path=='/$path'].id" --output text)
  echo "$path -> $ID"
  $AWS apigateway get-integration --rest-api-id $API --resource-id "$ID" \
    --http-method POST > "/tmp/integration-$path.json"
done
cat /tmp/integration-contact.json
```
Keep both files. They hold the exact `uri` to restore.

**Record the integration type in the runbook before going further.** The whole client contract hangs on it and nothing in the repo pins it down: under a **non-proxy** (`AWS`) integration API Gateway discards the Lambda's `statusCode` and returns HTTP 200 with the function's entire return value as the body, so the front-end reads the verdict from `data.statusCode` inside the envelope; under a **proxy** (`AWS_PROXY`) integration the Lambda's `statusCode` becomes the HTTP status and `body` becomes the response body. The code in this repo — `src/components/ContactForm.astro` parsing a nested `data.body` JSON string, and the `tests/contact.spec.ts` fixtures — assumes **non-proxy**.

```bash
for path in contact validaterecaptcha; do
  echo "$path: $(jq -r '.type' "/tmp/integration-$path.json")"
done
```
Expected: `AWS` for both (non-proxy). Append the two lines verbatim to `docs/superpowers/runbook-contact-split.md` under a heading "Integration type (verified <date>)", together with a note that the front-end's envelope parsing and the e2e fixtures depend on this answer. **If it reads `AWS_PROXY` instead, stop** — the acceptance criteria in Steps 4–5 below and in Task 7 Step 6 are written for non-proxy and must be re-read, and `ContactForm.astro` would be parsing a body that is no longer nested.

- [ ] **Step 2: Repoint each integration at the aliased function via a stage variable**

```bash
ACCT=$($AWS sts get-caller-identity --query Account --output text)
CONTACT_ID=$($AWS apigateway get-resources --rest-api-id $API --query "items[?path=='/contact'].id" --output text)
CAPTCHA_ID=$($AWS apigateway get-resources --rest-api-id $API --query "items[?path=='/validaterecaptcha'].id" --output text)

NEW_CONTACT="arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-1:$ACCT:function:marinos-contact-form:\${stageVariables.lambdaAlias}/invocations"
NEW_CAPTCHA="arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-1:$ACCT:function:marinos-recaptcha-verify:\${stageVariables.lambdaAlias}/invocations"

$AWS apigateway update-integration --rest-api-id $API --resource-id "$CONTACT_ID" --http-method POST \
  --patch-operations "op=replace,path=/uri,value=$NEW_CONTACT"
$AWS apigateway update-integration --rest-api-id $API --resource-id "$CAPTCHA_ID" --http-method POST \
  --patch-operations "op=replace,path=/uri,value=$NEW_CAPTCHA"
```
The `\${stageVariables.lambdaAlias}` escaping matters — it must reach API Gateway literally, not be expanded by the shell.

- [ ] **Step 3: Grant API Gateway permission to invoke each alias**

Without this every call returns 500. Permission is per-alias, so this is four statements.

```bash
for fn in marinos-contact-form marinos-recaptcha-verify; do
  for alias in dev prod; do
    $AWS lambda add-permission \
      --function-name "$fn:$alias" \
      --statement-id "apigw-$alias" \
      --action lambda:InvokeFunction \
      --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:eu-west-1:$ACCT:$API/*/POST/*"
  done
done
```
Verification: `$AWS lambda get-policy --function-name marinos-contact-form:prod --query Policy --output text | python3 -m json.tool | head -30` shows the statement.

- [ ] **Step 4: Set the stage variable on `dev`, then deploy and test staging first**

`dev` is staging, and it is the safer of the two to break.

```bash
$AWS apigateway update-stage --rest-api-id $API --stage-name dev \
  --patch-operations op=replace,path=/variables/lambdaAlias,value=dev
$AWS apigateway create-deployment --rest-api-id $API --stage-name dev \
  --description "route via stageVariables.lambdaAlias" --query id --output text
```
Verification:
```bash
curl -s -X POST "https://$API.execute-api.eu-west-1.amazonaws.com/dev/validaterecaptcha" \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -d '{"captchaResponse":"invalid"}'
```
Expected — and this is a **non-proxy** integration, so read it carefully: **HTTP 200**, with the Lambda's whole envelope as the body:

```json
{"statusCode":200,"body":"{\"success\":false}"}
```

The verdict is the escaped `\"success\":false` **inside** `body` — there is no `"success": false` with a space after the colon anywhere in the response, so grep for `success` and read the value, or use `jq -r '.body' | jq '.success'`. Seeing `success` false is proof that the request reached the new function, resolved the `dev` alias, called Google and parsed a real verdict. The old implementation would have answered `"Success"`.

**Rollback if this fails:** restore the `uri` from `/tmp/integration-contact.json` and `/tmp/integration-validaterecaptcha.json` with the same `update-integration --patch-operations op=replace,path=/uri,value=<old uri>`, then `create-deployment --stage-name dev`. The old functions were never touched.

- [ ] **Step 5: Create the `prod` stage from the same deployment**

```bash
DEP=$($AWS apigateway get-stage --rest-api-id $API --stage-name dev --query deploymentId --output text)
$AWS apigateway create-stage --rest-api-id $API --stage-name prod \
  --deployment-id "$DEP" --variables lambdaAlias=prod
```
Verification:
```bash
$AWS apigateway get-stage --rest-api-id $API --stage-name prod --query '[stageName,variables]' --output json
curl -s -X POST "https://$API.execute-api.eu-west-1.amazonaws.com/prod/validaterecaptcha" \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -d '{"captchaResponse":"invalid"}'
```
Expected: `lambdaAlias=prod`, and — again non-proxy — **HTTP 200** with the envelope `{"statusCode":200,"body":"{\"success\":false}"}`. Read the verdict out of the nested `body`, as in Step 4.

- [ ] **Step 5b: Throttle both stages and cap Lambda concurrency**

Both stages currently sit at the AWS account default — **10,000 req/sec, 5,000 burst** — which is
unlimited for a site serving roughly 2,000 requests a day in total. Nothing rate-limits the contact
endpoints.

Server-side captcha verification (Task 1) is the primary gate, but it does not cover everything:
`/validaterecaptcha` has no gate at all and makes an outbound call to Google per request, which is a
free amplification vector; and even a rejected `/contact` costs an invocation plus a Google
round-trip. The realistic harm is not spam reaching the inbox — the SES sandbox caps that at 200/day
— it is that a modest flood **exhausts the daily quota and silently breaks legitimate enquiries**.

```bash
for stage in dev prod; do
  $AWS apigateway update-stage --rest-api-id $API --stage-name $stage --patch-operations \
    op=replace,path=/*/*/throttling/rateLimit,value=5 \
    op=replace,path=/*/*/throttling/burstLimit,value=10
done
```

Verification:
```bash
$AWS apigateway get-stage --rest-api-id $API --stage-name prod \
  --query 'methodSettings."*/*".{rate:throttlingRateLimit,burst:throttlingBurstLimit}' --output json
```
Expected: `rate: 5.0`, `burst: 10`.

> **This is a global cap, not per-IP.** During an attack it throttles legitimate visitors too. At
> 5/sec it sits roughly two orders of magnitude above this site's normal contact traffic, so the
> trade is worth taking — but it is not equivalent to a per-IP limit. See the follow-up below.

Then cap the cost blast radius, so a flood cannot scale out concurrency:

```bash
for fn in marinos-contact-form marinos-recaptcha-verify; do
  $AWS lambda put-function-concurrency --function-name $fn --reserved-concurrent-executions 5
done
```
Verification: `$AWS lambda get-function-concurrency --function-name marinos-contact-form` → 5.

- [ ] **Step 5c: Alarm when the contact endpoints are being hammered**

Without this the failure mode is silent: the quota is exhausted, enquiries stop arriving, and nobody
knows until a guest complains. An alarm is what makes it visible.

```bash
$AWS cloudwatch put-metric-alarm \
  --alarm-name marinos-contact-invocations-high \
  --namespace AWS/Lambda --metric-name Invocations \
  --dimensions Name=FunctionName,Value=marinos-contact-form \
  --statistic Sum --period 3600 --evaluation-periods 1 --threshold 50 \
  --comparison-operator GreaterThanThreshold \
  --alarm-description "Contact form invocations unusually high — possible abuse or a quota-exhaustion attack"
```

Set `--alarm-actions <SNS topic ARN>` if a topic exists, or add one; an alarm with no action still
shows state in the console but will not notify. Threshold 50/hour is far above normal for this site
— tune it after a week of real data rather than guessing twice.

- [ ] **Step 6: Set the two repository variables**

```bash
gh variable set STAGING_CONTACT_API_BASE --body "https://$API.execute-api.eu-west-1.amazonaws.com/dev"
gh variable set PROD_CONTACT_API_BASE    --body "https://$API.execute-api.eu-west-1.amazonaws.com/prod"
gh variable list
```

- [ ] **Step 7: Append the results to the runbook and commit**

Record the stage names, the deployment id, the four `add-permission` statement ids, and both base URLs.

```bash
git add docs/superpowers/runbook-contact-split.md
git commit -m "docs: record the prod stage and alias routing"
```

---

## Task 7: [RUNBOOK] Rebuild both environments and verify end to end

> **Operator steps.** Until this task runs, production is still serving a bundle that points at `/dev` — the prod stage exists but nothing uses it.

- [ ] **Step 1: Land Tasks 1–4 through a pull request**

Per this project's review rule: open the PR, wait for review, resolve comments, never auto-merge.

```bash
gh pr create --base astro-migration --title "Production contact endpoint: prod stage, alias routing, runtime upgrade" --body "<summary of Tasks 1-4>"
```

- [ ] **Step 2: Deploy staging and confirm it uses the `dev` stage**

Merging to the integration branch fires `deploy-staging.yml`.

```bash
gh run watch
curl -s https://<STAGING_DOMAIN>/en/contact | grep -o 'execute-api[^"]*/dev' | head -1
```
Expected: the staging bundle references `/dev`.

- [ ] **Step 3: Submit the form on staging and confirm delivery to the staging inbox**

In a browser on the staging site, complete the form with a real captcha and submit.
Expected: the success message appears, and the mail arrives at the **staging** inbox — not the business inbox. That is the whole point of the split; confirm the business inbox receives nothing.

- [ ] **Step 4: Deploy production and confirm it uses the `prod` stage**

```bash
gh workflow run "Deploy Production"   # only once deploy-prod.yml is on the default branch; see the note below
gh run watch
curl -s https://www.marinos-aparts.gr/en/contact | grep -o 'execute-api[^"]*/prod' | head -1
```
Expected: the production bundle references `/prod`.

> **`workflow_dispatch` requires the workflow file to exist on the default branch.** `deploy-prod.yml` currently lives only on `astro-migration`, so "Deploy Production" is not dispatchable and does not appear in `gh workflow list`. Until the Task 8 finalize in the cutover runbook merges to `master`, deploy production the way the cutover did:
> **`export` the variable — do not prefix a single command with it.** `npm run test:unit` shells out to `npm run build` (the no-stub edge-function test) and `npm test` rebuilds through Playwright's `webServer` command, and `astro build` empties `outDir` first. A one-command prefix would leave those rebuilds with the variable unset, and the `dist/` that reaches S3 would fall back to the staging stage — silently, with production enquiries then landing in the staging inbox. Build **last**, and verify the artifact immediately before the sync:
> ```bash
> export PUBLIC_CONTACT_API_BASE="https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/prod"
> npm ci
> npm run test:unit && npm test && npm run parity:text && npm run parity:images
> npm run build && npm run build:info
> grep -q "${PUBLIC_CONTACT_API_BASE%/}/contact" dist/en/contact/index.html \
>   || { echo "dist targets the wrong contact API - do NOT sync"; exit 1; }
> $AWS s3 sync ./dist s3://marinos-aparts-prod --delete
> $AWS cloudfront create-invalidation --distribution-id <PROD_DIST_ID> --paths "/*"
> ```
> The `grep` is the same assertion `deploy-prod.yml` runs before its own sync. It is the only thing that catches this class of mistake, because a wrongly-targeted build is a perfectly valid site.

- [ ] **Step 5: Submit the form on production and confirm delivery to the business inbox**

Expected: success message, and the mail arrives at the **business** inbox with the sender's address as reply-to. This is also the first genuine end-to-end test the contact form has ever had.

- [ ] **Step 6: Confirm the relay is closed**

From a terminal, POST to `/prod/contact` with a well-formed body and no valid captcha token.

**The integration is non-proxy (confirmed in Task 6 Step 1), so API Gateway discards the Lambda's status code.** Every one of these calls comes back as **HTTP 200**; the real verdict is the `statusCode` field *inside* the body. Do not read HTTP 200 here as "the relay is still open" — that misreading would look like a regression and invite a rollback of a working fix.

```bash
BASE="https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/prod"
# invalid token
curl -s -o /dev/stderr -w '\nHTTP %{http_code}\n' -X POST "$BASE/contact" \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -d '{"name":"Probe","email":"probe@example.com","subject":"Relay probe","message":"Checking the relay is closed.","captchaResponse":"not-a-real-token"}'
# token omitted entirely
curl -s -o /dev/stderr -w '\nHTTP %{http_code}\n' -X POST "$BASE/contact" \
  -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
  -d '{"name":"Probe","email":"probe@example.com","subject":"Relay probe","message":"Checking the relay is closed."}'
```

Expected, in both cases `HTTP 200` at the transport level and:

| probe | body | meaning |
|---|---|---|
| invalid token | `{"statusCode":403,"body":"{\"error\":\"captcha rejected\"}"}` | Google rejected the token; nothing sent |
| token omitted | `{"statusCode":400,"body":"{\"error\":\"captcha required\"}"}` | rejected before Google was called; nothing sent |

And **no email delivered** for either — that is the actual acceptance criterion. Before this work the same requests would have sent mail. (If the two probes instead return HTTP 403 and HTTP 400 with a bare `{"error":...}` body, the integration is proxy, not non-proxy — go back to Task 6 Step 1, because `ContactForm.astro` is then parsing the wrong shape.)

- [ ] **Step 7: Retire the old functions once both environments are confirmed**

Leave them in place for a soak — they are the rollback path and cost nothing idle. After the soak:

```bash
$AWS lambda delete-function --function-name test-function-contact-form
$AWS lambda delete-function --function-name test-function-for-recpatch
```
Then delete `sitemap.xml`-era leftovers only per the cutover runbook — unrelated to this plan.

- [ ] **Step 8: Close out the runbook**

Record the verification results, the date, and which inbox received which message. Commit.

---

## Open items not covered here

- **SES is in sandbox.** 200 messages/24h across both environments, and every recipient must be verified. Moving to production access is an AWS support request and a separate piece of work; until then a burst of form traffic can exhaust the quota and genuine enquiries will fail silently. Consider a CloudWatch alarm on SES `Reputation`/send count.
- **CORS is `*`** on both endpoints. Now that the captcha is verified server-side this is much less dangerous, but narrowing it to the two site origins is cheap defence in depth — and it is free.
- **Per-IP rate limiting is NOT planned.** The only mechanism that does it properly here is AWS WAF, which is billed (~$5/month per web ACL plus ~$1 per rule per month). The project constraint is to add nothing paid, so Task 6 Steps 5b/5c use the free levers instead: global stage throttling, reserved concurrency, and a CloudWatch alarm (the account has 0 alarms and 0 SNS topics, so one of each sits inside the free tier). Accept that stage throttling is global rather than per-IP.
- **There is already a WAF web ACL in this account, attached to STAGING, not production.** `CreatedByCloudFront-72c774cb` with three AWS managed rule groups, auto-created by the CloudFront "create distribution" wizard when staging was provisioned. It is billed monthly and it is protecting a `noindex` mirror of a public site while production has none. Either detach it from staging to stop the charge, or move it to production to get per-IP protection for money already being spent — but that is an operator decision about existing spend, not part of this plan.
- **The API is still named `test-api-contact-form`.** Renaming means recreating it and changing both base URLs; not worth it while the stage names carry the meaning.

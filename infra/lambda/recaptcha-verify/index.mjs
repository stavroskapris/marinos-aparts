// NO FRONT-END CONSUMER. Do not wire this back into the contact form.
//
// reCAPTCHA response tokens are single-use: Google's siteverify consumes a token
// on first verification and returns {"success":false,"error-codes":
// ["timeout-or-duplicate"]} for every later attempt with the same value. There
// can therefore be exactly one verifier per submission, and that verifier is the
// contact handler (`infra/lambda/contact-form`), because it is the thing that
// decides whether mail is sent. A "pre-submit UX check" against this endpoint
// would burn the token and make the real check fail for every legitimate
// submission while leaving the attacker path — posting a fresh token straight to
// /contact — untouched.
//
// This function is kept deliberately, for two reasons:
//   1. It is the routing probe the runbook curls to prove a stage resolves its
//      `lambdaAlias` stage variable and reaches the new code.
//   2. It is the rollback surface: /validaterecaptcha still exists on both
//      stages, so nothing breaks if an older bundle is restored.
const VERIFY_URL = 'https://www.google.com/recaptcha/api/siteverify';

// JSON.parse accepts far more than objects: `null`, arrays, bare strings and
// numbers are all valid JSON documents. `JSON.parse('null')` returned null,
// which the caller below then dereferenced - an unhandled TypeError on a public
// endpoint instead of the documented 400. So normalise: readPayload always
// hands back a plain object.
//
// Arrays are collapsed to {} as well, deliberately. They already produced a
// clean 400 by accident (`[].captchaResponse` is undefined), but an array can
// never carry the named fields a payload needs, and a single "always a plain
// object" contract means no call site has to reason about exotic shapes.
//
// NOTE: duplicated in the sibling handler rather than shared. this handler
// is deployed as a lone index.mjs (`zip -q ... index.mjs`), so an import from
// ../shared/ would break its package. Keep the two copies in step.
const asObject = (v) => (v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {});

function readPayload(event) {
  if (event && typeof event.body === 'string') {
    try {
      return asObject(JSON.parse(event.body));
    } catch {
      return {};
    }
  }
  return asObject(event);
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

    return reply(200, { success: !!(verdict && verdict.success === true) });
  };
}

export const handler = makeHandler({ fetchImpl: globalThis.fetch });

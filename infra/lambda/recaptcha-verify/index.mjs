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

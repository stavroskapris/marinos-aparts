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

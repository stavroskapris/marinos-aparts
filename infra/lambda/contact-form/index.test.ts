import { test, expect, vi } from 'vitest';
import type { SendEmailCommand } from '@aws-sdk/client-ses';
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
  // The parameter is declared (rather than `vi.fn(() => ...)`) so the mock's
  // call tuple carries the real argument type: that is what lets sentCommand
  // below hand back a genuine SendEmailCommand instead of `any`.
  const send = vi.fn((_command: SendEmailCommand) =>
    sendOk ? Promise.resolve({}) : Promise.reject(new Error('ses down')),
  );
  const fetchImpl = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ success: captchaOk }) }),
  );
  return { ses: { send }, fetchImpl, send };
}

// Reading d.send.mock.calls[0][0] directly is a type error (the tuple may be
// absent) and, when the handler never sent, fails with an unhelpful
// "cannot read properties of undefined". This narrows it once and says what
// actually went wrong, while still handing back a real SendEmailCommand so the
// assertions below check its genuine .input shape.
const sentCommand = (d: ReturnType<typeof deps>) => {
  const call = d.send.mock.calls[0];
  if (!call) throw new Error('expected ses.send to have been called');
  return call[0] as SendEmailCommand;
};

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
  expect(sentCommand(d).input.Destination?.ToAddresses).toEqual(['prod-inbox@example.com']);
});

test('sends to the DEV recipient when invoked through the dev alias', async () => {
  env();
  const d = deps();
  await makeHandler(d)(validEvent, ctx('dev'));
  expect(sentCommand(d).input.Destination?.ToAddresses).toEqual(['staging-inbox@example.com']);
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
  expect(sentCommand(d).input.Message?.Subject?.Data).toBe('Hi Bcc: victim@example.com');
});

test('returns 502 when SES rejects the send', async () => {
  env();
  const d = deps({ sendOk: false });
  const res = await makeHandler(d)(validEvent, ctx());
  expect(res.statusCode).toBe(502);
});

// `null`, arrays, bare strings and numbers are all syntactically valid JSON, so
// a public endpoint receives them. Every one must produce the documented 400
// rather than an unhandled TypeError: before readPayload normalised its result,
// a body of "null" crashed the invocation.
test.each([
  ['null', 'null'],
  ['an array', '[]'],
  ['a bare string', '"nope"'],
  ['a number', '5'],
])('rejects a %s body with 400 instead of crashing', async (_label, body) => {
  env();
  const d = deps();
  const res = await makeHandler(d)({ body }, ctx());
  expect(res.statusCode).toBe(400);
  expect(d.send).not.toHaveBeenCalled();
  expect(d.fetchImpl).not.toHaveBeenCalled();
});

test('accepts a JSON string body, as API Gateway proxy integrations deliver it', async () => {
  env();
  const d = deps();
  const res = await makeHandler(d)({ body: JSON.stringify(validEvent) }, ctx());
  expect(res.statusCode).toBe(200);
  expect(d.send).toHaveBeenCalled();
});

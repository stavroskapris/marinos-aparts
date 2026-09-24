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

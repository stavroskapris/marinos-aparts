import { test, expect, vi } from 'vitest';
import { makeHandler } from './index.mjs';

const fetchReturning = (body, ok = true) =>
  vi.fn(() => Promise.resolve({ ok, json: () => Promise.resolve(body) }));

test('reports success only when Google says success', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({ fetchImpl: fetchReturning({ success: true }) })(
    { captchaResponse: 'tok' },
    {},
  );
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ success: true });
});

test('reports failure when Google rejects the token', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({
    fetchImpl: fetchReturning({ success: false, 'error-codes': ['invalid-input-response'] }),
  })({ captchaResponse: 'bad' }, {});
  expect(res.statusCode).toBe(200);
  expect(JSON.parse(res.body)).toEqual({ success: false });
});

test('rejects a request with no token without calling Google', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const fetchImpl = fetchReturning({ success: true });
  const res = await makeHandler({ fetchImpl })({}, {});
  expect(res.statusCode).toBe(400);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('does not leak verdicts between invocations', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  // Use a single handler instance (like production does) with a stateful mock
  // that returns different verdicts on successive calls. This catches regressions
  // where verdict is hoisted out of the inner handler function scope.
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true }) })
    .mockResolvedValueOnce({ json: () => Promise.resolve({ success: false }) });
  const handler = makeHandler({ fetchImpl });

  // First invocation should get success: true
  const first = await handler({ captchaResponse: 'a' }, {});
  expect(JSON.parse(first.body)).toEqual({ success: true });

  // Second invocation should get success: false (not leak from first)
  const second = await handler({ captchaResponse: 'b' }, {});
  expect(JSON.parse(second.body)).toEqual({ success: false });
});

test('surfaces a transport failure as 502', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({
    fetchImpl: vi.fn(() => Promise.reject(new Error('network'))),
  })({ captchaResponse: 'tok' }, {});
  expect(res.statusCode).toBe(502);
});

test('accepts a JSON string body', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({ fetchImpl: fetchReturning({ success: true }) })(
    { body: JSON.stringify({ captchaResponse: 'tok' }) },
    {},
  );
  expect(JSON.parse(res.body)).toEqual({ success: true });
});

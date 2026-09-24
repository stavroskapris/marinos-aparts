import { test, expect, vi } from 'vitest';
import { makeHandler } from './index.mjs';

const fetchReturning = (body: unknown, ok = true) =>
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

test('two sequential invocations of one handler return independent results', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  // The original defect mutated a module-scope response object and resolved
  // before reading the body, so verdicts could leak between warm invocations.
  // This implementation prevents it by construction: no module-scope mutable state.
  // This test asserts that two sequential calls to the same handler closure each
  // get their own independent result. It does not (and cannot) detect a regression
  // where verdict is hoisted, because verdict = await res.json() is immediately
  // followed by reply() with no interposed await, making write-and-read atomic.
  const fetchImpl = vi.fn()
    .mockResolvedValueOnce({ json: () => Promise.resolve({ success: true }) })
    .mockResolvedValueOnce({ json: () => Promise.resolve({ success: false }) });
  const handler = makeHandler({ fetchImpl });

  const first = await handler({ captchaResponse: 'a' });
  expect(JSON.parse(first.body)).toEqual({ success: true });

  const second = await handler({ captchaResponse: 'b' });
  expect(JSON.parse(second.body)).toEqual({ success: false });
});

test('interleaved invocations each get their own verdict (forward insurance)', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  // With today's code, this cannot fail: verdict is assigned and immediately read
  // with no interposed await. However, if a future change adds an await between
  // the verdict assignment and the reply (e.g. a log line, a retry, a middleware
  // call), this test will catch the leak. It serves as forward insurance for that
  // plausible future shape.
  const slowResolve = { success: true };
  const fastResolve = { success: false };
  let slowPromise: Promise<{ success: boolean }>;
  let resolveSlowPromise: (v: { success: boolean }) => void;

  const fetchImpl = vi.fn((_url: string, _opts: RequestInit) => {
    // Determine if this is the 'slow' call (started first) or 'fast' call
    const isSlowCall = !slowPromise;
    if (isSlowCall) {
      slowPromise = new Promise((resolve) => {
        resolveSlowPromise = resolve;
      });
      return slowPromise.then((v) => ({ json: () => Promise.resolve(v) }));
    } else {
      // Fast call resolves immediately
      return Promise.resolve({ json: () => Promise.resolve(fastResolve) });
    }
  });

  const handler = makeHandler({ fetchImpl });

  // Start slow invocation (will not resolve until we call resolveSlowPromise)
  const slowInvocation = handler({ captchaResponse: 'slow' });

  // Start fast invocation while slow is pending
  const fastInvocation = handler({ captchaResponse: 'fast' });

  // Now resolve the slow invocation with its own result
  resolveSlowPromise!(slowResolve);

  // Both should get their respective results
  const slow = await slowInvocation;
  const fast = await fastInvocation;

  expect(JSON.parse(slow.body)).toEqual({ success: true });
  expect(JSON.parse(fast.body)).toEqual({ success: false });
});

test('surfaces a transport failure as 502', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({
    fetchImpl: vi.fn(() => Promise.reject(new Error('network'))),
  })({ captchaResponse: 'tok' });
  expect(res.statusCode).toBe(502);
});

// `null`, arrays, bare strings and numbers are all syntactically valid JSON, so
// a public endpoint receives them. Every one must produce the documented 400
// rather than an unhandled TypeError: before readPayload normalised its result,
// a body of "null" crashed the invocation on the destructure.
test.each([
  ['null', 'null'],
  ['an array', '[]'],
  ['a bare string', '"nope"'],
  ['a number', '5'],
])('rejects a %s body with 400 instead of crashing', async (_label, body) => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const fetchImpl = fetchReturning({ success: true });
  const res = await makeHandler({ fetchImpl })({ body });
  expect(res.statusCode).toBe(400);
  expect(fetchImpl).not.toHaveBeenCalled();
});

test('accepts a JSON string body', async () => {
  process.env.RECAPTCHA_SECRET = 'shhh';
  const res = await makeHandler({ fetchImpl: fetchReturning({ success: true }) })(
    { body: JSON.stringify({ captchaResponse: 'tok' }) },
  );
  expect(JSON.parse(res.body)).toEqual({ success: true });
});

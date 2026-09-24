import { test, expect, type Page } from '@playwright/test';

// The real API Gateway integration is NON-PROXY: it discards the Lambda's
// statusCode and answers HTTP 200 with the Lambda's whole return value as the
// body. So a fixture must carry the statusCode inside the body envelope, which
// is where the client reads the verdict from.
const envelope = (statusCode: number, body: unknown) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode, body: JSON.stringify(body) }),
});

const fillValidForm = async (page: Page) => {
  await page.fill('#contact_name', 'Jane Doe');
  await page.fill('#contact_email', 'jane@example.com');
  await page.fill('#contact_subject', 'Booking question');
  await page.fill('#contact_message', 'I would like to book a room for August.');
};

test('contact form shows validation errors on empty submit', async ({ page }) => {
  await page.goto('/en/contact');
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('.field-error').first()).toContainText('This field is required');
});

test('contact form submits with valid input (network + recaptcha stubbed)', async ({ page }) => {
  // Block the real Google reCAPTCHA script so it cannot clobber our stub below.
  await page.route('**/recaptcha/api.js*', (route) => route.abort());
  // Stub grecaptcha so the captcha check passes.
  await page.addInitScript(() => {
    (window as any).grecaptcha = { getResponse: () => 'test-token', reset: () => {} };
  });
  // Fail the run if the form calls /validaterecaptcha: reCAPTCHA tokens are
  // single-use, so /contact is the sole verifier and a pre-submit call would
  // burn the token and break every legitimate submission.
  await page.route('**/validaterecaptcha', (route) => route.abort());
  // Capture the request so this test is self-sufficient: a fixture that answers
  // {ok:true} without looking at the body would still pass if the client stopped
  // forwarding captchaResponse. The 403 retry test below also guards that, but a
  // failure here points straight at the missing field.
  let sent: Record<string, string> | undefined;
  await page.route(/amazonaws\.com.*\/contact$/, (route) => {
    sent = JSON.parse(route.request().postData() || '{}');
    return route.fulfill(envelope(200, { ok: true }));
  });

  await page.goto('/en/contact');
  await fillValidForm(page);
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#success_message')).toBeVisible();
  expect(sent?.captchaResponse).toBeTruthy();
  expect(sent).toMatchObject({
    name: 'Jane Doe',
    email: 'jane@example.com',
    subject: 'Booking question',
    captchaResponse: 'test-token',
  });
});

test('does not call /validaterecaptcha - the token is single-use and /contact verifies it', async ({ page }) => {
  await page.route('**/recaptcha/api.js*', (r) => r.abort());
  await page.addInitScript(() => { (window as any).grecaptcha = { getResponse: () => 'tok', reset: () => {} }; });
  let verifyCalls = 0;
  await page.route('**/validaterecaptcha', (r) => { verifyCalls += 1; return r.abort(); });
  await page.route(/amazonaws\.com.*\/contact$/, (r) => r.fulfill(envelope(200, { ok: true })));
  await page.goto('/en/contact');
  await fillValidForm(page);
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#success_message')).toBeVisible();
  expect(verifyCalls).toBe(0);
});

test('a 403 captcha-rejected envelope shows the captcha message, not the generic error, and the retry works', async ({ page }) => {
  await page.route('**/recaptcha/api.js*', (r) => r.abort());
  // A token that is spent until the widget is reset, which is what a real
  // rejection leaves behind. If the form does not reset the widget, the retry
  // resends the same dead token and gets another 403 - the user is stuck until
  // they reload the page.
  await page.addInitScript(() => {
    let token = 'burnt-token';
    (window as any).resetCount = 0;
    (window as any).grecaptcha = {
      getResponse: () => token,
      reset: () => { (window as any).resetCount += 1; token = 'fresh-token'; },
    };
  });
  // The real shape: the integration is non-proxy, so API Gateway answers HTTP
  // 200 and the Lambda's own 403 envelope arrives in the body.
  const tokensSeen: string[] = [];
  await page.route(/amazonaws\.com.*\/contact$/, (r) => {
    const sent = JSON.parse(r.request().postData() || '{}').captchaResponse;
    tokensSeen.push(sent);
    return r.fulfill(
      sent === 'burnt-token' ? envelope(403, { error: 'captcha rejected' }) : envelope(200, { ok: true }),
    );
  });
  await page.goto('/en/contact');
  await fillValidForm(page);

  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#recaptcha_message')).toBeVisible();
  await expect(page.locator('#error_message')).toBeHidden();
  await expect(page.locator('#success_message')).toBeHidden();
  // The rejected token is spent, so the widget must have been reset.
  await expect.poll(() => page.evaluate(() => (window as any).resetCount)).toBe(1);

  // The retry must be able to succeed: a fresh token, not the burnt one again.
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#success_message')).toBeVisible();
  expect(tokensSeen).toEqual(['burnt-token', 'fresh-token']);
});

test('an empty captcha does NOT reset the widget - there is no spent token to clear', async ({ page }) => {
  await page.route('**/recaptcha/api.js*', (r) => r.abort());
  // getResponse() is empty while the challenge is unsolved (or after grecaptcha
  // expired it and re-armed itself). Resetting there would wipe a challenge the
  // user is part-way through solving.
  await page.addInitScript(() => {
    (window as any).resetCount = 0;
    (window as any).grecaptcha = {
      getResponse: () => '',
      reset: () => { (window as any).resetCount += 1; },
    };
  });
  await page.goto('/en/contact');
  await fillValidForm(page);
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#recaptcha_message')).toBeVisible();
  expect(await page.evaluate(() => (window as any).resetCount)).toBe(0);
});

test('submitting with no captcha token shows the captcha message and sends nothing', async ({ page }) => {
  await page.route('**/recaptcha/api.js*', (r) => r.abort());
  await page.addInitScript(() => { (window as any).grecaptcha = { getResponse: () => '', reset: () => {} }; });
  let contactCalls = 0;
  await page.route(/amazonaws\.com.*\/contact$/, (r) => { contactCalls += 1; return r.fulfill(envelope(200, { ok: true })); });
  await page.goto('/en/contact');
  await fillValidForm(page);
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#recaptcha_message')).toBeVisible();
  expect(contactCalls).toBe(0);
});

test('greek contact page uses translated submit label', async ({ page }) => {
  await page.goto('/gr/contact');
  await expect(page.locator('#contact-form-submit')).toHaveText('Αποστολή');
});

test('shows per-field validation messages for too-short input', async ({ page }) => {
  await page.goto('/en/contact');
  await page.fill('#contact_name', 'Jo');                 // < 3
  await page.fill('#contact_email', 'not-an-email');      // invalid
  await page.fill('#contact_subject', 'hey');             // < 5
  await page.fill('#contact_message', 'too short');       // < 10
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('.field-error[data-for="contact_name"]')).toContainText('at least 3');
  await expect(page.locator('.field-error[data-for="contact_email"]')).toContainText('valid email');
  await expect(page.locator('.field-error[data-for="contact_subject"]')).toContainText('at least 5');
  await expect(page.locator('.field-error[data-for="contact_message"]')).toContainText('at least 10');
});

test('treats a non-success response body as an error, not success', async ({ page }) => {
  await page.route('**/recaptcha/api.js*', (r) => r.abort());
  await page.addInitScript(() => { (window as any).grecaptcha = { getResponse: () => 'tok', reset: () => {} }; });
  // Regex used instead of glob because Playwright's glob engine does not match
  // amazonaws.com when it appears in the hostname rather than the URL path.
  await page.route(/amazonaws\.com.*\/contact$/, (r) => r.fulfill(envelope(502, { error: 'rejected' })));
  await page.goto('/en/contact');
  await fillValidForm(page);
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#error_message')).toBeVisible();
  await expect(page.locator('#success_message')).toBeHidden();
});

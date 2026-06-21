import { test, expect } from '@playwright/test';

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
  // Mock the two API Gateway calls (scoped to the API host so the /en/contact page navigation is not intercepted).
  await page.route('**/validaterecaptcha', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '"Success"' }) }));
  await page.route(/amazonaws\.com.*\/contact$/, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await page.goto('/en/contact');
  await page.fill('#contact_name', 'Jane Doe');
  await page.fill('#contact_email', 'jane@example.com');
  await page.fill('#contact_subject', 'Booking question');
  await page.fill('#contact_message', 'I would like to book a room for August.');
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#success_message')).toBeVisible();
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
  await page.route('**/validaterecaptcha', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '"Success"' }) }));
  // Regex used instead of glob because Playwright's glob engine does not match
  // amazonaws.com when it appears in the hostname rather than the URL path.
  await page.route(/amazonaws\.com.*\/contact$/, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '"Error"' }) }));
  await page.goto('/en/contact');
  await page.fill('#contact_name', 'Jane Doe');
  await page.fill('#contact_email', 'jane@example.com');
  await page.fill('#contact_subject', 'Booking question');
  await page.fill('#contact_message', 'I would like to book a room for August.');
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#error_message')).toBeVisible();
  await expect(page.locator('#success_message')).toBeHidden();
});

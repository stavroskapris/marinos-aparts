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
  await page.route('**/amazonaws.com/**/contact', (route) =>
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

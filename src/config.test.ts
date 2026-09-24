import { test, expect } from 'vitest';
import { buildEndpoints } from './config';

test('derives both endpoints from a base url', () => {
  expect(buildEndpoints('https://api.example.com/prod')).toEqual({
    contact: 'https://api.example.com/prod/contact',
    recaptcha: 'https://api.example.com/prod/validaterecaptcha',
  });
});

test('tolerates a trailing slash on the base', () => {
  expect(buildEndpoints('https://api.example.com/prod/').contact).toBe(
    'https://api.example.com/prod/contact',
  );
});

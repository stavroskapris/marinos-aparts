import { test, expect } from 'vitest';
import { aliasEnv } from './alias-env.mjs';

test('reads the alias suffix from a qualified invoked ARN', () => {
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form:prod')).toBe('PROD');
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form:dev')).toBe('DEV');
});

test('defaults to DEV for an unqualified ARN', () => {
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form')).toBe('DEV');
});

test('defaults to DEV for a numeric version rather than an alias', () => {
  expect(aliasEnv('arn:aws:lambda:eu-west-1:1:function:contact-form:7')).toBe('DEV');
});

test('defaults to DEV when the ARN is missing entirely', () => {
  expect(aliasEnv(undefined)).toBe('DEV');
});

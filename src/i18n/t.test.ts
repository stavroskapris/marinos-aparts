import { test, expect } from 'vitest';
import { t } from './t';
import { LOCALES, DEFAULT_LOCALE, isLocale } from './locales';

test('locales are en and gr, default en', () => {
  expect([...LOCALES]).toEqual(['en', 'gr']);
  expect(DEFAULT_LOCALE).toBe('en');
  expect(isLocale('gr')).toBe(true);
  expect(isLocale('fr')).toBe(false);
});

test('t returns locale-specific shared and home strings', () => {
  expect(t('en').nav.home).toBe('Home');
  expect(t('gr').nav.home).toBe('Αρχική');
  expect(t('en').home.readMore).toBe('Read More');
  expect(t('en').home.welcome.startsWith('Welcome to Marinos-aparts')).toBe(true);
});

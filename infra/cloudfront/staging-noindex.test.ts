import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function loadHandler() {
  const src = readFileSync(new URL('./staging-noindex.js', import.meta.url), 'utf8');
  return new Function('event', `${src}\nreturn handler(event);`) as (e: any) => any;
}
const handler = loadHandler();

test('adds a noindex X-Robots-Tag to every response', () => {
  const res = handler({ response: { statusCode: 200, headers: {} } });
  expect(res.headers['x-robots-tag'].value).toBe('noindex, nofollow');
});

test('preserves headers the origin already set', () => {
  const res = handler({
    response: { statusCode: 200, headers: { 'content-type': { value: 'text/html' } } },
  });
  expect(res.headers['content-type'].value).toBe('text/html');
  expect(res.headers['x-robots-tag'].value).toBe('noindex, nofollow');
});

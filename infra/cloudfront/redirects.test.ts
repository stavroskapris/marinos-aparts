import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function loadHandler() {
  const src = readFileSync(new URL('./redirects.js', import.meta.url), 'utf8');
  // The file declares `function handler(event){…}`; expose it via a wrapper.
  return new Function('event', `${src}\nreturn handler(event);`) as (e: any) => any;
}
const handler = loadHandler();
const req = (uri: string) => ({ request: { uri } });

test('root and legacy .html paths 301-redirect to locale URLs', () => {
  for (const [from, to] of [
    ['/', '/en/'],
    ['/home.html', '/en/'],
    ['/kimon.html', '/en/kimon'],
    ['/irida.html', '/en/irida'],
    ['/location.html', '/en/location'],
    ['/contact.html', '/en/contact'],
  ]) {
    const res = handler(req(from));
    expect(res.statusCode).toBe(301);
    expect(res.headers.location.value).toBe(to);
  }
});

test('clean URLs are rewritten to index.html objects', () => {
  expect(handler(req('/en/')).uri).toBe('/en/index.html');
  expect(handler(req('/en/kimon')).uri).toBe('/en/kimon/index.html');
  expect(handler(req('/gr/contact')).uri).toBe('/gr/contact/index.html');
});

test('paths with a file extension pass through unchanged', () => {
  expect(handler(req('/_astro/app.abc123.css')).uri).toBe('/_astro/app.abc123.css');
  expect(handler(req('/img/nav/logo_marinos.png')).uri).toBe('/img/nav/logo_marinos.png');
});

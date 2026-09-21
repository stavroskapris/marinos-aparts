import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

function loadHandler() {
  const src = readFileSync(new URL('./redirects.js', import.meta.url), 'utf8');
  // The file declares `function handler(event){…}`; expose it via a wrapper.
  return new Function('event', `${src}\nreturn handler(event);`) as (e: any) => any;
}
const handler = loadHandler();
const req = (uri: string) => ({ request: { uri } });

test('root and legacy .html paths temporarily 302-redirect to locale URLs', () => {
  for (const [from, to] of [
    ['/', '/en/'],
    ['/home.html', '/en/'],
    ['/kimon.html', '/en/kimon'],
    ['/irida.html', '/en/irida'],
    ['/location.html', '/en/location'],
    ['/contact.html', '/en/contact'],
  ]) {
    const res = handler(req(from));
    // 302 during the cutover soak; see the comment in redirects.js.
    expect(res.statusCode).toBe(302);
    expect(res.headers.location.value).toBe(to);
  }
});

test('clean URLs are rewritten to index.html objects', () => {
  expect(handler(req('/en/')).uri).toBe('/en/index.html');
  expect(handler(req('/en/kimon')).uri).toBe('/en/kimon/index.html');
  expect(handler(req('/gr/contact')).uri).toBe('/gr/contact/index.html');
});

test('the legacy /sitemap.xml path is rewritten to the generated sitemap index', () => {
  // Astro's sitemap integration emits sitemap-index.xml; the legacy site
  // published /sitemap.xml and that URL is registered in Search Console.
  const res = handler(req('/sitemap.xml'));
  expect(res.uri).toBe('/sitemap-index.xml');
  expect(res.statusCode).toBeUndefined(); // a rewrite, not a redirect
});

test('the generated sitemap files are served as-is', () => {
  expect(handler(req('/sitemap-index.xml')).uri).toBe('/sitemap-index.xml');
  expect(handler(req('/sitemap-0.xml')).uri).toBe('/sitemap-0.xml');
  expect(handler(req('/robots.txt')).uri).toBe('/robots.txt');
});

test('paths with a file extension pass through unchanged', () => {
  expect(handler(req('/_astro/app.abc123.css')).uri).toBe('/_astro/app.abc123.css');
  expect(handler(req('/img/nav/logo_marinos.png')).uri).toBe('/img/nav/logo_marinos.png');
});

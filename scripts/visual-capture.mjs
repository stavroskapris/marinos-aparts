/**
 * Visual parity capture script
 * Screenshots the legacy site (served on :4399) and the Astro build (on :4321)
 * for all 5 pages × 2 locales × 2 viewports, writing PNGs to
 * docs/superpowers/parity/shots/{legacy,astro}/.
 *
 * Usage:
 *   npm run build && npm run preview &   # start Astro preview first
 *   npm run visual:capture
 */

import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, resolve, sep } from 'node:path';

const LEGACY_PORT = 4399;
const ASTRO_PORT = 4321;

// ── tiny static server for the legacy site ───────────────────────────────────
const MIME = {
  '.html': 'text/html',
  '.js':   'text/javascript',
  '.css':  'text/css',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
  '.webp': 'image/webp',
  '.svg':  'image/svg+xml',
  '.gif':  'image/gif',
  '.ico':  'image/x-icon',
  '.woff': 'font/woff',
  '.woff2':'font/woff2',
  '.ttf':  'font/ttf',
  '.eot':  'application/vnd.ms-fontobject',
};

const legacyServer = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/home.html';
  const root = resolve(process.cwd());
  const file = resolve(join(root, p));
  if (file !== root && !file.startsWith(root + sep)) { res.statusCode = 403; return res.end('forbidden'); }
  if (!existsSync(file)) {
    res.statusCode = 404;
    return res.end('not found');
  }
  res.setHeader('Content-Type', MIME[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(LEGACY_PORT);

console.log(`Legacy server listening on http://localhost:${LEGACY_PORT}`);

// ── capture targets ───────────────────────────────────────────────────────────
const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'mobile',  width: 390,  height: 844 },
];

// [pageName, legacyFile, astroPathInEn]
const PAGES = [
  ['home',     'home.html',     '/en/'],
  ['kimon',    'kimon.html',    '/en/kimon/'],
  ['irida',    'irida.html',    '/en/irida/'],
  ['location', 'location.html', '/en/location/'],
  ['contact',  'contact.html',  '/en/contact/'],
];

// ── ensure output dirs ────────────────────────────────────────────────────────
mkdirSync('docs/superpowers/parity/shots/legacy', { recursive: true });
mkdirSync('docs/superpowers/parity/shots/astro',  { recursive: true });

// ── capture ───────────────────────────────────────────────────────────────────
const browser = await chromium.launch();
let legacyCount = 0;
let astroCount  = 0;
const failures  = [];

for (const lang of ['en', 'gr']) {
  for (const vp of VIEWPORTS) {
    // One context per (lang × viewport) pair.
    // addInitScript fires on every page load inside this context, so we only
    // need to register it once — it will inject localStorage.lang before every
    // DOMContentLoaded that happens within the context.
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
    });
    // Set localStorage.lang once for the whole context (legacy site reads it on load).
    await ctx.addInitScript((l) => {
      localStorage.setItem('lang', l);
    }, lang);

    const page = await ctx.newPage();

    for (const [name, legacyFile, astroPathEn] of PAGES) {
      // ── legacy ──────────────────────────────────────────────────────────────
      const legacyUrl = `http://localhost:${LEGACY_PORT}/${legacyFile}`;
      try {
        await page.goto(legacyUrl, { waitUntil: 'networkidle', timeout: 15000 });
      } catch (err) {
        console.warn(`[legacy] goto ${legacyUrl} timed-out/errored: ${err.message} — screenshotting anyway`);
        failures.push(`legacy ${name}-${lang}-${vp.name}: ${err.message}`);
      }
      const legacyShot = `docs/superpowers/parity/shots/legacy/${name}-${lang}-${vp.name}.png`;
      await page.screenshot({ path: legacyShot, fullPage: true });
      legacyCount++;
      console.log(`  [legacy] ${legacyShot}`);

      // ── astro ───────────────────────────────────────────────────────────────
      // Replace the /en/ prefix with /<lang>/
      const astroPath = astroPathEn.replace(/^\/en\//, `/${lang}/`);
      const astroUrl  = `http://localhost:${ASTRO_PORT}${astroPath}`;
      try {
        await page.goto(astroUrl, { waitUntil: 'networkidle', timeout: 15000 });
      } catch (err) {
        console.warn(`[astro]  goto ${astroUrl} timed-out/errored: ${err.message} — screenshotting anyway`);
        failures.push(`astro ${name}-${lang}-${vp.name}: ${err.message}`);
      }
      const astroShot = `docs/superpowers/parity/shots/astro/${name}-${lang}-${vp.name}.png`;
      await page.screenshot({ path: astroShot, fullPage: true });
      astroCount++;
      console.log(`  [astro]  ${astroShot}`);
    }

    await ctx.close();
  }
}

await browser.close();
legacyServer.close();

console.log('\n── capture complete ──────────────────────────────────────────────────');
console.log(`legacy shots: ${legacyCount} (expected 20)`);
console.log(`astro  shots: ${astroCount} (expected 20)`);
if (failures.length) {
  console.warn('\nCapture warnings (screenshots still written):');
  failures.forEach(f => console.warn('  ⚠', f));
} else {
  console.log('No failures.');
}

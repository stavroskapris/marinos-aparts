import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// Every <img src> / url(...) referenced by the legacy HTML + CSS.
const legacyHtml = ['home.html', 'kimon.html', 'irida.html', 'location.html', 'contact.html'];
const refs = new Set();
for (const f of legacyHtml) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:jpg|jpeg|png|gif|svg|webp))"/gi)) refs.add(basename(m[1]));
}
const css = readFileSync('css/templatemo-style.css', 'utf8'); // legacy CSS backgrounds
for (const m of css.matchAll(/url\(['"]?([^'")]+\.(?:jpg|jpeg|png|gif|svg|webp))['"]?\)/gi)) refs.add(basename(m[1]));

// Every image the new build can serve: src/assets (optimized) + public (copied as-is).
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(e.name)) acc.push(basename(e.name));
  }
  return acc;
}
const available = new Set([...walk('src/assets'), ...walk('public')]);

const missing = [...refs].filter((r) => !available.has(r));
const lines = ['# Image parity report', '', `Legacy referenced: ${refs.size}`, `Available in build: ${available.size}`, '', '## Missing (referenced by legacy, absent from build):', ...missing.map((m) => `- ${m}`)];
mkdirSync('docs/superpowers/parity', { recursive: true });
writeFileSync('docs/superpowers/parity/image-report.md', lines.join('\n'));
console.log(lines.join('\n'));
process.exit(missing.length === 0 ? 0 : 1);

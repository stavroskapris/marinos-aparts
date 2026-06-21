import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Evaluate the legacy *_lang.js files onto a SHARED stubbed `App` object, in the
// required load order. The leaf dicts (navbar/facilities/header_bottom) must be
// loaded before app_lang.js, because app_lang.js references them by value
// (e.g. App.navbar_lang.en) while assembling App.langData.
function loadLegacyApp() {
  const App = {};
  const files = [
    'js/custom/lang/navbar_lang.js',
    'js/custom/lang/facilities_lang.js',
    'js/custom/lang/header_bottom_lang.js',
    'js/custom/lang/app_lang.js', // must load LAST
  ];
  for (const rel of files) {
    const src = readFileSync(resolve(repoRoot, rel), 'utf8');
    // Run in a function scope with the shared `App` injected.
    new Function('App', src)(App);
  }
  return App;
}

// Recursively collect every string leaf value from a nested object into `out`.
function collectValues(obj, out) {
  if (obj == null) return out;
  if (typeof obj === 'string') {
    out.add(obj);
    return out;
  }
  if (typeof obj === 'object') {
    for (const v of Object.values(obj)) collectValues(v, out);
  }
  return out;
}

// Build the set of legacy translation VALUES per language from the assembled
// App.langData. langData.languages[lang].pages[page] holds the strings for each
// page, with the leaf dicts (navbar, facilities, findus, reservations) inlined
// by reference, so recursing the per-language tree captures every rendered string.
function buildLegacyValueSets() {
  const App = loadLegacyApp();
  const data = App.langData;
  if (!data || !data.languages) {
    throw new Error('App.langData.languages was not assembled — check legacy load order.');
  }
  const result = {};
  for (const lang of ['en', 'gr']) {
    const tree = data.languages[lang];
    if (!tree) throw new Error(`Legacy langData missing language "${lang}".`);
    result[lang] = collectValues(tree, new Set());
  }
  return result;
}

// Flatten a nested object to dotted-key -> string-value pairs.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const en = JSON.parse(readFileSync(resolve(repoRoot, 'src/i18n/en.json'), 'utf8'));
const gr = JSON.parse(readFileSync(resolve(repoRoot, 'src/i18n/gr.json'), 'utf8'));
const astro = { en: flatten(en), gr: flatten(gr) };

const legacy = buildLegacyValueSets();

const lines = ['# Text parity report', ''];
let unexplained = 0;
for (const lang of ['en', 'gr']) {
  const astroValues = new Set(Object.values(astro[lang]));
  const missing = [...legacy[lang]].filter((v) => !astroValues.has(v));
  lines.push(`## ${lang}: ${missing.length} legacy string(s) not found in the Astro build`);
  for (const m of missing) {
    lines.push(`- ${JSON.stringify(m)}`);
    unexplained++;
  }
  lines.push('');
}

mkdirSync(resolve(repoRoot, 'docs/superpowers/parity'), { recursive: true });
writeFileSync(resolve(repoRoot, 'docs/superpowers/parity/text-report.md'), lines.join('\n'));
console.log(lines.join('\n'));
process.exit(unexplained === 0 ? 0 : 1);

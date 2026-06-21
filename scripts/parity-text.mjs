import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

// Differences from the legacy site that have been reviewed and signed off as intentional.
// Each entry is a legacy string value that intentionally differs in the Astro build.
// See docs/superpowers/parity/parity-signoff.md for the rationale.
const APPROVED_DIFFERENCES = {
  gr: [
    "Τα Σύβοτα αποτελούν ένα ιδιαίτερο προορισμό, ως ένα από τα γραφικότερα χωριά της Ηπείρου. Πρόκειται για ιδανικό συνδυασμό γαλάζιου και πράσινου, καθώς οι λόφοι ενώνονται με τα κρυστάλλινα νερά του ιονίου. Το χωριό των Συβότων διαθέτει ένα μοναδικό σύμπλεγμα νησίδων με τις ονομασίες ‘’Μαύρο Όρος’’, ‘’Αγ. Νικόλαος’’, και ‘’Μουρτεμένο’’, τα οποία αποτελούνται από ακρογιαλιές και μικρούς κολπίσκους που ξεχωρίζουν για την διαφορετικότητα τους.Η τοποθεσία που βρίσκονται τα Σύβοτα είναι επίσης ιδανική για εξορμήσεις στις γύρω περιοχές. Σε πολύ κοντινή απόσταση (μόλις 25km) βρίσκεται η πόλη της Ηγουμενίτσας, η οποία αποτελεί και πρωτεύουσα του νομού καθώς και το μεγαλύτερο τουριστικό θέρετρο της περιοχής. Εκεί υπάρχει και το ομώνυμο λιμάνι, από όπου μπορείτε να οργανώσετε εκδρομές προς τα νησιά της Κέρκυρας, της Ιθάκης και τους Παξούς.Σε απόσταση 60km υπάρχει το διεθνές αεροδρόμιο Ακτίου με πτήσεις από και προς χώρες της Ευρώπης. Επίσης σε κοντινή απόσταση βρίσκεται και η Εγνατία Οδός, συνδέοντας έτσι την περιοχή με τη Βόρεια Ελλάδα.Πρόκειται για μια περιοχή με αμέτρητες δραστηριότητες για όλα τα γούστα και τις απαιτήσεις των ανθρώπων που επιλέγουν να περάσουν τις διακοπές τους στα Σύβοτα. Οι πανέμορφες και πεντακάθαρες παραλίες (Μικρή και Μεγάλη Άμμος, Πισίνα, Γαλλικός, Μώλος, Ζάβια, Μέγα Tράφος, Ζέρη, Δ.Ε.Η., Αγία Παρασκευή), είναι παραλίες οι οποίες καλύπτουν τις ανάγκες και τις απαιτήσεις όλων.Το οργανωμένο λιμανάκι για τα σκάφη και οι άριστες τουριστικές υποδομές προσελκύουν Έλληνες και ξένους τουρίστες, προσφέροντας πολλές επιλογές αναψυχής, όπως καταδύσεις, ιστιοπλοΐα και εκδρομές.",
  ],
  en: [],
};

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
const approvedLines = [];

for (const lang of ['en', 'gr']) {
  const astroValues = new Set(Object.values(astro[lang]));
  const allMissing = [...legacy[lang]].filter((v) => !astroValues.has(v));
  const approved = allMissing.filter((v) => (APPROVED_DIFFERENCES[lang] ?? []).includes(v));
  const unapproved = allMissing.filter((v) => !(APPROVED_DIFFERENCES[lang] ?? []).includes(v));

  lines.push(`## ${lang}: ${unapproved.length} non-approved legacy string(s) not found in the Astro build`);
  for (const m of unapproved) {
    lines.push(`- ${JSON.stringify(m)}`);
    unexplained++;
  }
  lines.push('');

  if (approved.length > 0) {
    approvedLines.push(`### ${lang}`);
    for (const m of approved) {
      approvedLines.push(`- ${JSON.stringify(m)}`);
    }
    approvedLines.push('');
  }
}

if (approvedLines.length > 0) {
  lines.push('## Approved differences (signed off)');
  lines.push('');
  lines.push(...approvedLines);
}

mkdirSync(resolve(repoRoot, 'docs/superpowers/parity'), { recursive: true });
writeFileSync(resolve(repoRoot, 'docs/superpowers/parity/text-report.md'), lines.join('\n'));
console.log(lines.join('\n'));
process.exit(unexplained === 0 ? 0 : 1);

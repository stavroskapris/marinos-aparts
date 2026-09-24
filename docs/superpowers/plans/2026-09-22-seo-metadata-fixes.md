# SEO Metadata Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the metadata defects found auditing the live site after the Astro cutover — Greek pages serving English metadata, titles too long to survive truncation, no `<h1>`, structured data that contradicts the page, and a logo used as the social share image.

**Architecture:** All changes are in `src/layouts/BaseLayout.astro`, the five page files under `src/pages/[lang]/`, the two i18n JSON files, and the two resort page files. Per-page `title`/`description` move out of hardcoded frontmatter literals and into the i18n dictionaries, which is where every other piece of translatable copy already lives. No routing, build or infrastructure change.

**Tech Stack:** Astro 4.16 static output, the existing `t(lang)` i18n lookup, `getImage()` from `astro:assets`, Vitest, Playwright.

**Spec:** No separate spec — the findings this plan fixes are recorded in **Audit findings** below, each verified against the live site on 2026-09-22.

## Global Constraints

- **Every new key must exist in both `src/i18n/en.json` and `src/i18n/gr.json`.** `src/i18n/pages.test.ts` enforces key parity and will fail the build otherwise.
- **Greek copy must be written in Greek.** The entire point of Task 1 is that `/gr/` currently serves English. A machine-translated placeholder is not acceptable; if a Greek string is not available, stop and ask rather than inventing marketing copy.
- **Titles: aim for ≤60 characters** so they survive Google's truncation. Descriptions: 120–160.
- **Do not change visible page copy.** This plan touches `<head>` metadata, one heading level, and `alt` attributes. Body text is out of scope and belongs to the redesign.
- Import local TS without a file extension, `.astro` with it, JSON without import assertions.
- Node ≥ 22 (`nvm use 22`); the system Node is 18 and `npm ci` will refuse.
- Run the gates from the repo root: `npm run test:unit`, `npm test`, `npm run parity:text`, `npm run parity:images`.

---

## Audit findings (verified against the live site, 2026-09-22)

| # | Finding | Evidence |
|---|---|---|
| 1 | **All five Greek pages serve English `title` and `description`** | `curl https://www.marinos-aparts.gr/gr/kimon` → `description` is `"Completely renovated in 2015, KIMON RESORT..."`. Cause: hardcoded literals in page frontmatter, e.g. `src/pages/[lang]/kimon.astro:27`, passed to the layout regardless of `lang`. |
| 2 | **Titles are ~110 chars and near-identical** | Every page is `<Page> \| Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota \| Ενοικιαζόμενα δωμάτια Σύβοτα`. Google truncates ~60, so only the first word distinguishes them. |
| 3 | **No `<h1>` on any page** | `grep -c '<h1'` = 0 on all pages; they start at `<h2>`. |
| 4 | **Structured data contradicts the page** | JSON-LD says `+30-6936-772-821`; the page says `+30 6909 025 820`. JSON-LD `sameAs` is `facebook.com/marinosaparts`; the footer links `facebook.com/marinosaparts.sivota/`. Typed `Organization` rather than `LodgingBusiness`. |
| 5 | **`og:image` is the logo** | `og:image` = `/img/nav/logo_marinos.png` — a 23KB logo, byte-identical to `favicon.ico`. No `og:locale`. |
| 6 | **20 identical gallery `alt`s** | `src/pages/[lang]/kimon.astro` sets `alt: 'Kimon Resort'` for every image. (`location.astro` already uses translated beach names — only the resort pages are affected.) |

Not in scope, deferred to the redesign: copy rewriting for search intent, information architecture, image art direction.

---

## File Structure

```
src/i18n/en.json               # MODIFY: add a `meta` block per page
src/i18n/gr.json               # MODIFY: same keys, Greek copy
src/i18n/meta.test.ts          # NEW: asserts title/description length + locale sanity
src/layouts/BaseLayout.astro   # MODIFY: og:locale, og:image prop, LodgingBusiness JSON-LD
src/pages/[lang]/index.astro    # MODIFY: title/description from i18n, add <h1>
src/pages/[lang]/kimon.astro    # MODIFY: title/description from i18n, per-image alt
src/pages/[lang]/irida.astro    # MODIFY: same
src/pages/[lang]/location.astro # MODIFY: title/description from i18n, add <h1>
src/pages/[lang]/contact.astro  # MODIFY: title/description from i18n, add <h1>
src/components/ResortPage.astro # MODIFY: render the <h1>
tests/seo.spec.ts              # NEW: e2e assertions across both locales
```

---

## Task 1: Move page titles and descriptions into i18n

**Files:**
- Modify: `src/i18n/en.json`, `src/i18n/gr.json`
- Create: `src/i18n/meta.test.ts`
- Modify: `src/pages/[lang]/{index,kimon,irida,location,contact}.astro`

**Interfaces:**
- Produces: a `meta` object on every page block in both locales, shaped `{ title: string, description: string }`, read in pages as `s.<page>.meta.title`. Tasks 2 and 3 consume the same values.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/meta.test.ts`:

```ts
import { test, expect } from 'vitest';
import en from './en.json';
import gr from './gr.json';

const PAGES = ['home', 'kimon', 'irida', 'location', 'contact'] as const;
const locales = { en, gr } as Record<string, any>;

test('every page has meta.title and meta.description in both locales', () => {
  for (const [name, dict] of Object.entries(locales)) {
    for (const page of PAGES) {
      expect(dict[page]?.meta?.title, `${name}.${page}.meta.title`).toBeTruthy();
      expect(dict[page]?.meta?.description, `${name}.${page}.meta.description`).toBeTruthy();
    }
  }
});

test('titles survive search-result truncation and descriptions are a useful length', () => {
  for (const [name, dict] of Object.entries(locales)) {
    for (const page of PAGES) {
      const { title, description } = dict[page].meta;
      expect(title.length, `${name}.${page} title too long`).toBeLessThanOrEqual(60);
      expect(description.length, `${name}.${page} description too short`).toBeGreaterThanOrEqual(120);
      expect(description.length, `${name}.${page} description too long`).toBeLessThanOrEqual(160);
    }
  }
});

test('greek metadata is actually written in greek', () => {
  const greek = /[Ͱ-Ͽ]/;
  for (const page of PAGES) {
    expect(greek.test(gr[page as keyof typeof gr].meta.title), `gr.${page} title`).toBe(true);
    expect(greek.test(gr[page as keyof typeof gr].meta.description), `gr.${page} description`).toBe(true);
  }
});

test('each page has a distinct title within its locale', () => {
  for (const [name, dict] of Object.entries(locales)) {
    const titles = PAGES.map((p) => dict[p].meta.title);
    expect(new Set(titles).size, `${name} has duplicate titles`).toBe(titles.length);
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx vitest run src/i18n/meta.test.ts`
Expected: FAIL — `en.home.meta.title` is undefined.

- [ ] **Step 3: Add the English metadata**

In `src/i18n/en.json`, add a `meta` object to each of the five page blocks. These keep the existing keyword focus (Sivota, rooms/studios) while fitting the length budget:

```json
"home":     { "meta": { "title": "Marinos Aparts — Rooms & Studios in Sivota",
                        "description": "Family-run apartments in Sivota, Thesprotia, 30 years of hospitality. Kimon and Irida Resort: refurbished studios with balconies, minutes from the port." } },
"kimon":    { "meta": { "title": "Kimon Resort — Studios in Sivota, Greece",
                        "description": "Kimon Resort sits among olive groves, 200m from Sivota port and the beach. Refurbished apartments with kitchen, air conditioning, balcony and parking." } },
"irida":    { "meta": { "title": "Irida Resort — Studios by Sivota Port",
                        "description": "Irida Resort stands 30m from Sivota port. Bright first-floor studios with private balconies, air conditioning and a full kitchen, steps from the waterfront." } },
"location": { "meta": { "title": "Sivota Beaches & How to Reach Us",
                        "description": "Sivota in Epirus: Mega Ammos, Mikri Ammos, Pisina, Gallikos and more. Igoumenitsa 25km, Aktion airport 60km, with boat trips to Corfu, Paxos and Ithaca." } },
"contact":  { "meta": { "title": "Contact Marinos Aparts, Sivota",
                        "description": "Ask about availability at Kimon and Irida Resort in Sivota. Send us your dates and we will reply as soon as possible with options and prices." } }
```

Merge these into the existing blocks — do not replace them; each block already holds `title`, `main` and other keys used by the page body.

- [ ] **Step 4: Add the Greek metadata**

Add the same `meta` keys to `src/i18n/gr.json`, written in Greek. Base the wording on the Greek body copy already in that file (`gr.home.main`, `gr.kimon.main`, and so on) so the phrasing matches the site's voice.

**If you are an agent and cannot write natural Greek marketing copy, stop here and ask.** A machine-translated title is worse than the current state, because it looks deliberate. The length budget is the same: title ≤60, description 120–160.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run src/i18n/meta.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Read the metadata from i18n in every page**

In each of `src/pages/[lang]/{index,kimon,irida,location,contact}.astro`, delete the hardcoded literals:

```js
const title = 'Kimon Resort | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα';
const description = 'Completely renovated in 2015, KIMON RESORT is set in an idyllic location, surrounded by olive groves, offering tranquility and beauty to holidaymakers';
```

and replace with the i18n lookup (`s` is already in scope in every one of these files):

```js
const title = s.kimon.meta.title;
const description = s.kimon.meta.description;
```

Use the matching block per file: `s.home.meta` in `index.astro`, `s.kimon.meta`, `s.irida.meta`, `s.location.meta`, `s.contact.meta`.

- [ ] **Step 7: Verify both locales differ in the built output**

Run:
```bash
npm run build
grep -o '<title>[^<]*</title>' dist/en/kimon/index.html dist/gr/kimon/index.html
grep -o '<meta name="description"[^>]*>' dist/gr/index.html
```
Expected: the two titles differ, and the Greek description contains Greek characters.

- [ ] **Step 8: Commit**

```bash
git add src/i18n src/pages
git commit -m "fix(seo): serve per-locale titles and descriptions"
```

---

## Task 2: Correct the structured data and the social image

**Files:**
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `lang`, `title`, `description`, `canonicalPath` — already props on `BaseLayout`.
- Produces: an optional `ogImage?: string` prop (absolute URL). Pages that do not pass it fall back to the site-wide default, so no page needs changing in this task.

- [ ] **Step 1: Write the failing test**

Create `tests/seo.spec.ts` (Playwright, so it asserts against rendered pages in both locales):

```ts
import { test, expect } from '@playwright/test';

const ROUTES = ['/en/', '/gr/', '/en/kimon', '/gr/kimon', '/en/location', '/gr/contact'];

for (const route of ROUTES) {
  test(`${route} has consistent, complete metadata`, async ({ page }) => {
    await page.goto(route);

    // Exactly one h1.
    await expect(page.locator('h1')).toHaveCount(1);

    // og:image must not be the logo, and must be absolute.
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    expect(ogImage).toMatch(/^https:\/\//);
    expect(ogImage).not.toContain('logo_marinos');

    // og:locale matches the document language.
    const lang = await page.locator('html').getAttribute('lang');
    const ogLocale = await page.locator('meta[property="og:locale"]').getAttribute('content');
    expect(ogLocale).toContain(lang === 'el' ? 'el' : 'en');
  });
}

test('structured data agrees with the page and describes a lodging business', async ({ page }) => {
  await page.goto('/en/');
  const raw = await page.locator('script[type="application/ld+json"]').innerText();
  const data = JSON.parse(raw);

  expect(data['@type']).toBe('LodgingBusiness');
  // The number and social link shown in the footer, not a stale pair.
  expect(JSON.stringify(data)).toContain('+306909025820');
  expect(JSON.stringify(data)).toContain('marinosaparts.sivota');
  expect(data.address?.addressLocality).toBe('Sivota');
  expect(data.geo?.latitude).toBeCloseTo(39.41, 1);
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npx playwright test tests/seo.spec.ts`
Expected: FAIL — no `h1`, `og:image` contains `logo_marinos`, `@type` is `Organization`.

- [ ] **Step 3: Add `og:locale` and an `ogImage` prop**

In `src/layouts/BaseLayout.astro`, extend the `Props` interface and the destructure:

```ts
interface Props {
  lang: Locale;
  title: string;
  description: string;
  canonicalPath: string; // e.g. "/kimon" or "" for home
  ogImage?: string;      // absolute URL; defaults to the site-wide share image
}

const { lang, title, description, canonicalPath, ogImage } = Astro.props;
```

Add below the existing `altHref` definition:

```ts
// Open Graph wants a landscape photograph, not a logo. 1200x630 is the size
// Facebook, LinkedIn and Slack all crop to.
const OG_LOCALES: Record<Locale, string> = { en: 'en_GB', gr: 'el_GR' };
const shareImage = ogImage ?? `${site}/img/og-default.jpg`;
```

Replace the `og:image` line and add the locale tags:

```astro
    <meta property="og:image" content={shareImage} />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:locale" content={OG_LOCALES[lang]} />
    {LOCALES.filter((l) => l !== lang).map((l) => (
      <meta property="og:locale:alternate" content={OG_LOCALES[l]} />
    ))}
```

- [ ] **Step 4: Produce the share image**

`public/img/home-sivota.jpg` is 7000×1843 — a hero banner, far too wide for a share card, which crops to roughly 1.91:1. Generate a correctly-proportioned file once and commit it:

```bash
npx --yes sharp-cli -i public/img/home-sivota.jpg -o public/img/og-default.jpg resize 1200 630 --fit cover
```

Verify: the file exists and is a reasonable size (under ~300KB).
If the crop loses the subject, pick a different source from `src/assets/kimon/` or `src/assets/irida/` and re-run — this is a judgement call about which photograph represents the property, so look at the result rather than accepting the first crop.

- [ ] **Step 5: Replace the JSON-LD**

Substitute the whole `<script type="application/ld+json">` block in `src/layouts/BaseLayout.astro` with:

```astro
    <script type="application/ld+json" is:inline set:html={JSON.stringify({
      '@context': 'https://schema.org',
      // LodgingBusiness rather than Organization: it is what the business is,
      // and it carries address, geo and amenity fields that Organization has no
      // slot for.
      '@type': 'LodgingBusiness',
      name: 'Marinos-Aparts',
      url: 'https://www.marinos-aparts.gr',
      // Must match what the footer shows. The previous values were a different
      // phone number and a different Facebook handle, and inconsistent
      // structured data is discounted.
      telephone: '+306909025820',
      email: 'marinosaparts@gmail.com',
      sameAs: [
        'https://www.facebook.com/marinosaparts.sivota/',
        'https://www.instagram.com/marinosaparts/',
      ],
      logo: 'https://www.marinos-aparts.gr/img/nav/logo_marinos.png',
      image: 'https://www.marinos-aparts.gr/img/og-default.jpg',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Sivota',
        addressRegion: 'Thesprotia',
        addressCountry: 'GR',
      },
      // The coordinates the Leaflet map already uses for the Kimon marker
      // (src/components/Map.astro).
      geo: { '@type': 'GeoCoordinates', latitude: 39.410685, longitude: 20.239593 },
      availableLanguage: ['en', 'el'],
    })} />
```

- [ ] **Step 6: Run the tests**

Run: `npx playwright test tests/seo.spec.ts`
Expected: the structured-data test PASSES; the per-route tests still fail on `h1` count (Task 3 adds it).

- [ ] **Step 7: Commit**

```bash
git add src/layouts/BaseLayout.astro public/img/og-default.jpg tests/seo.spec.ts
git commit -m "fix(seo): correct structured data, add a real share image and og:locale"
```

---

## Task 3: Add one `<h1>` per page, and per-image gallery alt text

**Files:**
- Modify: `src/components/ResortPage.astro`
- Modify: `src/pages/[lang]/{index,location,contact}.astro`
- Modify: `src/pages/[lang]/{kimon,irida}.astro`

**Interfaces:**
- Consumes: `s.<page>.title` — the existing visible heading copy, already translated in both locales. No new i18n keys.

- [ ] **Step 1: Confirm the current heading structure**

Run:
```bash
npm run build
grep -o '<h[12][^>]*>' dist/en/kimon/index.html | head -3
```
Expected: `<h2 ...>` first, no `<h1>`. This is the state the next step changes.

- [ ] **Step 2: Promote the page's leading heading to `<h1>`**

Each page already renders its main heading as `<h2 class="tm-gold-text tm-title">`. Change the **first one on each page only** to `<h1>` with the same classes, so the rendered appearance is unchanged:

- `src/components/ResortPage.astro` — the resort name heading (covers kimon and irida)
- `src/pages/[lang]/index.astro` — the "Marinos Aparts" heading
- `src/pages/[lang]/location.astro` — the "Sivota" heading
- `src/pages/[lang]/contact.astro` — the form heading

```diff
- <h2 class="tm-gold-text tm-title">{s.kimon.title}</h2>
+ <h1 class="tm-gold-text tm-title">{s.kimon.title}</h1>
```

If `h1` inherits a different size from the template CSS, add a rule to `src/styles/templatemo-style.css` making `h1.tm-title` match `h2.tm-title` rather than changing the markup back. Verify visually with `npm run preview`.

- [ ] **Step 3: Give each gallery image its own alt**

In `src/pages/[lang]/kimon.astro`, replace:

```js
const items: GalleryItem[] = images.map((img) => ({ thumb: img, full: img, alt: 'Kimon Resort' }));
```

with an indexed alt, so the twenty images are distinguishable to image search and to screen readers:

```js
const items: GalleryItem[] = images.map((img, i) => ({
  thumb: img,
  full: img,
  alt: `${s.kimon.title} (${i + 1}/${images.length})`,
}));
```

The page title is already translated, so the alt text is per-locale without adding
an i18n key.

Apply the same change in `src/pages/[lang]/irida.astro` with `s.irida.title`.
`location.astro` already uses translated beach names (`alt: s.location.beaches[key]`) and needs no change.

- [ ] **Step 4: Run the full gate set**

```bash
npm run build
npm run test:unit
npm test
npm run parity:text
npm run parity:images
npx astro check
```
Expected: unit and e2e all pass including the new `tests/seo.spec.ts`; both parity gates exit 0; `astro check` 0 errors.

> `parity:text` compares the built copy against the legacy `*.html` reference. Promoting `h2` to `h1` changes an element name, not text, so it should not register — if it does, read the diff before assuming the gate is wrong.

- [ ] **Step 5: Commit**

```bash
git add src/components/ResortPage.astro src/pages src/styles
git commit -m "fix(seo): one h1 per page and distinct gallery alt text"
```

---

## Task 4: Verify against the live site after deploy

**Files:** none — verification only.

- [ ] **Step 1: Open a PR and let CI run the gates**

Per the project's review rule: open the PR, wait for review, resolve comments, never auto-merge.

- [ ] **Step 2: After merge, deploy and re-check what the audit found**

Once the production deploy has run:

```bash
for p in en/ gr/ en/kimon gr/kimon gr/contact; do
  echo "--- $p"
  curl -s "https://www.marinos-aparts.gr/$p" \
    | grep -oE '<title>[^<]*|<meta name="description" content="[^"]{0,70}|<h1|og:image" content="[^"]*' \
    | head -4
done
```

Expected, per finding:
1. Greek routes show Greek titles and descriptions
2. Titles under 60 characters and distinct per page
3. One `<h1>` present on every route
4. `og:image` is `og-default.jpg`, not the logo

- [ ] **Step 3: Validate the structured data externally**

Paste `https://www.marinos-aparts.gr/en/` into Google's Rich Results Test and confirm `LodgingBusiness` parses with no errors, and that the phone and social links match the footer.

- [ ] **Step 4: Resubmit the sitemap**

In Google Search Console, resubmit `https://www.marinos-aparts.gr/sitemap.xml` so the re-crawl picks up the corrected metadata while the post-migration re-evaluation is still in progress.

---

## Deferred to the redesign

Recorded here so it is not lost, and so nobody does it twice:

- **Copy rewriting for search intent.** The descriptions in Task 1 keep the current positioning; deciding what the site should actually rank for is a content exercise.
- **Information architecture.** Per-beach pages, an FAQ, and booking-intent landing pages would all plausibly earn traffic, but they are new pages, not metadata.
- **Image art direction**, including the higher-resolution sources already on the backlog for the beaches and `kimon11`/`kimon12`. Better images help image search and would also let the perf benchmark in `docs/astro-migration-results.md` be re-run honestly.
- **`aggregateRating` / `Review` structured data**, if real reviews are ever surfaced on the site. Marking up ratings that are not visible on the page violates Google's guidelines, so this cannot be done from review-site data alone.

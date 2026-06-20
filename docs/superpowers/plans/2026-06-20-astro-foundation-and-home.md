# Astro Foundation, i18n & Home Page — Implementation Plan (Phase 1, Plan 1 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an Astro static site that renders the existing home page bilingually at `/en/` and `/gr/`, on the new component + build-time-i18n architecture, building and testing locally.

**Architecture:** Astro in fully static mode (`output: 'static'`). Shared chrome (head, navbar, header-bottom, footer, map, weather, scroll-to-top, language switcher) becomes components consumed by a per-locale dynamic route `src/pages/[lang]/index.astro`. Translations move from the runtime `App.langData` JS object into build-time JSON (`src/i18n/en.json`, `src/i18n/gr.json`) read by a `t()` helper. jQuery is not used; the few interactive pieces are vanilla-JS Astro islands. Output deploys to S3+CloudFront later (Plan 4).

**Tech Stack:** Astro (latest 4.x), TypeScript, Leaflet (npm) for the footer map, Playwright for smoke tests, linkinator for link checking. No jQuery, no Bootstrap JS, no tether.

## Global Constraints

- Output must be fully static (`output: 'static'`) — same cheap S3+CloudFront hosting.
- Two locales only: `en` (default) and `gr`. Per-locale URLs: `/en/...`, `/gr/...`.
- Lift-and-shift: visible text and appearance must match the current site. No copy changes, no redesign.
- No jQuery, no Bootstrap JS, no tether in the shipped output.
- Keep GA4 id `G-7PRPXQ745M`, the okairos weather widget (per-locale ids), Leaflet/OSM maps, the existing Facebook/Instagram links, and the JSON-LD Organization block.
- Translation values are copied **verbatim** from the current `js/custom/lang/*.js` files. The home page keys live under each locale's `pages.home`; shared keys (navbar, reservations, findus) are shared across pages.
- Site origin: `https://www.marinos-aparts.gr`.
- Node 18+ (Astro 4 requirement).

---

## File Structure

```
package.json                 # modified: Astro project manifest + scripts
astro.config.mjs             # new: static config, site, redirects
tsconfig.json                # new: Astro strict TS config
.gitignore                   # modified: add dist/, .astro/
src/
  i18n/
    locales.ts               # locale list + types + helpers
    t.ts                     # translation lookup helper
    en.json                  # English strings (shared + home)
    gr.json                  # Greek strings (shared + home)
  layouts/
    BaseLayout.astro         # <head>, GA4, fonts, JSON-LD, hreflang, slot
  components/
    Navbar.astro
    HeaderBottom.astro
    Footer.astro
    LangSwitcher.astro
    ScrollToTop.astro
    Map.astro                # Leaflet island
    WeatherWidget.astro      # okairos embed island
  pages/
    [lang]/
      index.astro            # home page
  styles/
    bootstrap.min.css        # ported (CSS only)
    photoswipe.css           # ported
    default-skin.css         # ported
    templatemo-style.css     # ported
public/
  img/                       # all current images, copied as-is
  favicon.ico
tests/
  home.spec.ts               # Playwright smoke tests
playwright.config.ts         # new
```

Existing legacy files (`*.html`, `js/`, `css/`) are **left in place** for now — they are the parity source of truth and are removed in Plan 3/4 at cutover. The Astro build ignores them.

---

## Task 1: Scaffold the Astro project

**Files:**
- Modify: `package.json`
- Create: `astro.config.mjs`, `tsconfig.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: an Astro project where `npm run build` and `npm run preview` work; `npm run dev` serves locally. Scripts: `dev`, `build`, `preview` (Astro), `test` (Playwright), `check:links` (linkinator).

- [ ] **Step 1: Write the failing test (build smoke)**

Create `tests/home.spec.ts` with a placeholder that asserts the dev server serves *something* at the default locale. (Full home assertions come in Task 8; this first check proves the toolchain runs.)

```ts
import { test, expect } from '@playwright/test';

test('site builds and serves the english home route', async ({ page }) => {
  const response = await page.goto('/en/');
  expect(response?.status()).toBe(200);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx playwright test tests/home.spec.ts`
Expected: FAIL — no Astro project / no `/en/` route yet (connection refused or 404).

- [ ] **Step 3: Replace `package.json`**

```json
{
  "name": "marinos-aparts",
  "type": "module",
  "version": "1.0.0",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "test": "playwright test",
    "test:unit": "vitest run",
    "check:links": "linkinator ./dist --recurse --silent"
  },
  "dependencies": {
    "astro": "^4.15.0",
    "leaflet": "^1.9.4"
  },
  "devDependencies": {
    "@playwright/test": "^1.47.0",
    "vitest": "^2.1.0",
    "linkinator": "^6.1.0",
    "@types/leaflet": "^1.9.12"
  }
}
```

- [ ] **Step 4: Create `astro.config.mjs`**

```js
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.marinos-aparts.gr',
  output: 'static',
  trailingSlash: 'ignore',
  redirects: {
    '/': '/en/',
    '/home.html': '/en/',
    '/kimon.html': '/en/kimon',
    '/irida.html': '/en/irida',
    '/location.html': '/en/location',
    '/contact.html': '/en/contact',
  },
});
```

Note: Astro emits static redirect pages (meta-refresh + canonical) for these. True edge 301s are wired in Plan 4; this is correct for local/staging.

- [ ] **Step 5: Create `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/strict",
  "compilerOptions": {
    "resolveJsonModule": true,
    "allowJs": true
  }
}
```

- [ ] **Step 6: Update `.gitignore`**

Append these lines to the existing `.gitignore`:

```
dist/
.astro/
node_modules/
test-results/
playwright-report/
```

- [ ] **Step 7: Install and create the Playwright config**

Run: `npm install && npx playwright install --with-deps chromium`

Create `playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://localhost:4321' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321/en/',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json .gitignore playwright.config.ts tests/home.spec.ts
git commit -m "chore: scaffold Astro project with static config and Playwright"
```

(The build-smoke test still fails until the home route exists in Task 7 — that's expected. It is the running target the next tasks satisfy.)

---

## Task 2: Port static assets and global CSS

**Files:**
- Create: `public/img/**` (copy of current `img/**`), `public/favicon.ico`
- Create: `src/styles/bootstrap.min.css`, `src/styles/photoswipe.css`, `src/styles/default-skin.css`, `src/styles/templatemo-style.css` (copies of current `css/**`)

**Interfaces:**
- Produces: image paths under `/img/...` (same relative paths as today, so ported markup keeps working) and importable stylesheet modules under `src/styles/`.

- [ ] **Step 1: Copy images and favicon into `public/`**

Run:
```bash
mkdir -p public
cp -R img public/img
cp img/favicon.ico public/favicon.ico
```

Rationale: files in `public/` are served at the site root unmodified, so existing references like `img/nav/logo_marinos.png` resolve. (Astro `<Image>` optimization of these is applied per-page where `<img>` tags are converted; bulk background images in CSS continue to load from `public/`.)

- [ ] **Step 2: Copy stylesheets into `src/styles/`**

Run:
```bash
mkdir -p src/styles
cp css/bootstrap.min.css css/photoswipe.css css/default-skin.css css/templatemo-style.css src/styles/
```

- [ ] **Step 3: Verify the copy**

Run: `ls public/img/nav/logo_marinos.png src/styles/templatemo-style.css`
Expected: both paths listed (exist).

- [ ] **Step 4: Commit**

```bash
git add public src/styles
git commit -m "chore: port images, favicon, and stylesheets into Astro structure"
```

---

## Task 3: i18n core (locales, translation data, `t()` helper)

**Files:**
- Create: `src/i18n/locales.ts`, `src/i18n/t.ts`, `src/i18n/en.json`, `src/i18n/gr.json`
- Test: `src/i18n/t.test.ts` (run with Playwright's test runner is overkill; use a tiny Node test — see step 2)

**Interfaces:**
- Produces:
  - `LOCALES: readonly ['en','gr']`, `type Locale = 'en' | 'gr'`, `DEFAULT_LOCALE: Locale`, `isLocale(x): x is Locale`
  - `getStaticLocalePaths(): { params: { lang: Locale } }[]` — for `getStaticPaths`
  - `t(locale: Locale): Strings` where `Strings` is the parsed JSON shape; pages read `const s = t(lang); s.home.welcome` etc.
- Consumes: nothing (leaf module).

- [ ] **Step 1: Write the failing test**

Create `src/i18n/t.test.ts` (Vitest — runs TypeScript and JSON imports natively on Node 18):

```ts
import { test, expect } from 'vitest';
import { t } from './t.ts';
import { LOCALES, DEFAULT_LOCALE, isLocale } from './locales.ts';

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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- src/i18n/t.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `src/i18n/locales.ts`**

```ts
export const LOCALES = ['en', 'gr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getStaticLocalePaths(): { params: { lang: Locale } }[] {
  return LOCALES.map((lang) => ({ params: { lang } }));
}
```

- [ ] **Step 4: Create `src/i18n/en.json`** (values copied verbatim from `js/custom/lang/navbar_lang.js`, `header_bottom_lang.js`, and the `pages.home` block of `app_lang.js`)

```json
{
  "nav": {
    "home": "Home",
    "kimon": "Kimon Resort",
    "irida": "Irida Resort",
    "location": "Location",
    "contact": "Contact",
    "book": "Book now"
  },
  "header": {
    "reservations": "<strong>Reservations : </strong>+30 6909 025 820",
    "findus": "<strong>Find us</strong>"
  },
  "footer": {
    "menu": "Menu",
    "address": "Sivota, Thesprotia",
    "registryNo": "KIMON General Registry Number 019630328004 | IRIDA General Registry Number 019630328000"
  },
  "home": {
    "intro": "Marinos Aparts",
    "welcome": "Welcome to Marinos-aparts Rooms in Sivota, where your ultimate satisfaction is our only goal. Marinos-aparts, with 30 years of hospitality, consist of 2 separate accommodation, Kimon Resort and Irida Resort. We make sure that all our customers find exactly what suits them for their vacation. So we have single and double room apartments, ideal for couples and families, in the center of the port but also a little further, on the floor or on the ground floor.All of our apartments are spacious and fully refurbished, with stylish furnishings and a private balcony. Feel free to contact us to discuss what is ideal for you to ensure you the most beautiful and easy vacation in Sivota.",
    "kimonTitle": "Completely refurbished, Kimon Resort is set in an idyllic setting amidst olive groves, offering tranquility and beauty to holidaymakers.",
    "iridaTitle": "Completely refurbished and located only 30 meters from the port, Irida Resort is ideal for vacationers who want to enjoy the life of Sivota.",
    "kimonSubTitle": "Only 200 meters from the port and 200 meters from the beach of French Molos, Kimon Resort is ideal for anyone wishing to stay in a quiet accommodation but at the same time not be deprived of the opportunity to leave the car and do everything on foot.",
    "iridaSubTitle": "The studios, all on the first floor of the property, offer moments of relaxation and total peace of mind. Spacious, bright, cool, with elegant décor and private balconies, they feature the entire package and cater to all holiday needs.",
    "readMore": "Read More"
  }
}
```

- [ ] **Step 5: Create `src/i18n/gr.json`**

Copy the **same key structure** as `en.json`, with Greek values taken verbatim from the `gr` blocks of the source files:
- `nav.*` → from `App.navbar_lang.gr` in `js/custom/lang/navbar_lang.js` (home: `Αρχική`, kimon: `Kimon Resort`, irida: `Irida Resort`, location: `Τοποθεσία`, contact: `Επικοινωνία`, book: `Κρατήσεις`).
- `header.reservations` / `header.findus` → from `App.header_bottom_lang.gr` (`<strong>Κρατήσεις : </strong>+30 6909 025 820`, `<strong>Βρείτε μας</strong>`).
- `footer.*` and `home.*` → from the `gr.pages.home` block of `js/custom/lang/app_lang.js` (keys: `intro` is the literal "Marinos Aparts", `welcome`, `kimonTitle`, `iridaTitle`, `kimonSubTitle`, `iridaSubTitle`, `readMore`, plus `footerMenu`→`footer.menu`, `footerAddress`→`footer.address`, `footerRegistryNo`→`footer.registryNo`).

Completeness is enforced by the parity gate (Plan 3); for this task, ensure every key present in `en.json` also exists in `gr.json`.

- [ ] **Step 6: Create `src/i18n/t.ts`**

```ts
import type { Locale } from './locales.ts';
import en from './en.json' with { type: 'json' };
import gr from './gr.json' with { type: 'json' };

export type Strings = typeof en;

const DATA: Record<Locale, Strings> = { en, gr: gr as Strings };

export function t(locale: Locale): Strings {
  return DATA[locale];
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npm run test:unit -- src/i18n/t.test.ts`
Expected: PASS (both tests).

- [ ] **Step 8: Commit**

```bash
git add src/i18n
git commit -m "feat: add i18n core with en/gr data and t() helper"
```

---

## Task 4: BaseLayout component

**Files:**
- Create: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `Locale` from `src/i18n/locales.ts`.
- Produces: a layout accepting props `{ lang: Locale; title: string; description: string; canonicalPath: string }` and a default `<slot />` for page body. Renders `<html lang>`, all `<head>` tags (charset, viewport, GA4, fonts, the four stylesheets, Font Awesome kit, favicon), per-page `hreflang` alternates for both locales + `x-default`, and the JSON-LD Organization block.

- [ ] **Step 1: Write the failing test**

Add to `tests/home.spec.ts`:

```ts
test('html lang attribute and GA4 are present on english home', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  const ga = page.locator('script[src*="googletagmanager.com/gtag/js?id=G-7PRPXQ745M"]');
  await expect(ga).toHaveCount(1);
});

test('hreflang alternates point to per-locale urls', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('link[rel="alternate"][hreflang="gr"]')).toHaveAttribute('href', /\/gr\/$/);
  await expect(page.locator('link[rel="alternate"][hreflang="en"]')).toHaveAttribute('href', /\/en\/$/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/home.spec.ts -g "html lang"`
Expected: FAIL — no home page yet.

- [ ] **Step 3: Create `src/layouts/BaseLayout.astro`**

```astro
---
import type { Locale } from '../i18n/locales.ts';
import { LOCALES } from '../i18n/locales.ts';
import '../styles/bootstrap.min.css';
import '../styles/photoswipe.css';
import '../styles/default-skin.css';
import '../styles/templatemo-style.css';

interface Props {
  lang: Locale;
  title: string;
  description: string;
  canonicalPath: string; // e.g. "/kimon" or "" for home
}

const { lang, title, description, canonicalPath } = Astro.props;
const site = 'https://www.marinos-aparts.gr';
const altHref = (l: Locale) => `${site}/${l}${canonicalPath}/`;
---

<!DOCTYPE html>
<html lang={lang}>
  <head>
    <script async src="https://www.googletagmanager.com/gtag/js?id=G-7PRPXQ745M"></script>
    <script is:inline>
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', 'G-7PRPXQ745M');
    </script>

    <meta charset="utf-8" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="application-name" content="Marinos-Aparts" />

    <title>{title}</title>
    <meta property="og:url" content={`${site}/${lang}${canonicalPath}/`} />
    <meta property="og:image" content={`${site}/img/nav/logo_marinos.png`} />
    <meta property="og:site_name" content="Marinos-Aparts" />
    <meta property="og:title" content={title} />
    <meta property="og:type" content="website" />
    <meta name="description" content={description} />
    <meta property="og:description" content={description} />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />

    {LOCALES.map((l) => (
      <link rel="alternate" href={altHref(l)} hreflang={l} />
    ))}
    <link rel="alternate" href={altHref('en')} hreflang="x-default" />

    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:300,400" />
    <script src="https://kit.fontawesome.com/3fad1b2de2.js" crossorigin="anonymous"></script>
  </head>
  <body>
    <slot />

    <script type="application/ld+json" is:inline set:html={JSON.stringify({
      '@context': 'http://schema.org',
      '@type': 'Organization',
      name: 'Marinos-Aparts',
      url: 'https://www.marinos-aparts.gr',
      sameAs: ['https://www.facebook.com/marinosaparts'],
      logo: 'https://www.marinos-aparts.gr/img/nav/logo_marinos.png',
      contactPoint: [
        { '@type': 'ContactPoint', telephone: '+30-6936-772-821', contactType: 'customer service' },
        { '@type': 'ContactPoint', telephone: '+30-6936-772-821', contactType: 'reservations' },
      ],
    })} />
  </body>
</html>
```

- [ ] **Step 4: Run tests**

These still fail until the home page (Task 7) renders the layout. Proceed; they are re-run in Task 7. No commit gate here other than `astro check`.

Run: `npx astro check`
Expected: no type errors in `BaseLayout.astro`.

- [ ] **Step 5: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: add BaseLayout with head, GA4, hreflang, and JSON-LD"
```

---

## Task 5: Shared chrome — Navbar, HeaderBottom, LangSwitcher, ScrollToTop

**Files:**
- Create: `src/components/Navbar.astro`, `src/components/HeaderBottom.astro`, `src/components/LangSwitcher.astro`, `src/components/ScrollToTop.astro`

**Interfaces:**
- Consumes: `t`, `Locale`. Each component takes `{ lang: Locale }` (and `LangSwitcher` also `{ canonicalPath: string }`).
- Produces: navbar (logo + nav links pointing to `/{lang}/...`), header-bottom reservations/find-us block, language switcher (plain links to the other locale of the same page), scroll-to-top button with vanilla JS.

- [ ] **Step 1: Write the failing tests**

Add to `tests/home.spec.ts`:

```ts
test('navbar links are locale-prefixed', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a.tm-site-logo')).toHaveAttribute('href', '/en/');
  await expect(page.getByRole('link', { name: 'Kimon Resort' }).first()).toHaveAttribute('href', '/en/kimon');
});

test('language switcher links to the same page in the other locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a[data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/');
  await page.locator('a[data-lang-switch="gr"]').click();
  await expect(page).toHaveURL(/\/gr\/$/);
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
});

test('scroll-to-top button exists', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('a.scroll-top')).toHaveCount(1);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/home.spec.ts -g "navbar links"`
Expected: FAIL — components/page not rendered yet.

- [ ] **Step 3: Create `src/components/Navbar.astro`**

```astro
---
import type { Locale } from '../i18n/locales.ts';
import { t } from '../i18n/t.ts';
import LangSwitcher from './LangSwitcher.astro';

interface Props { lang: Locale; canonicalPath: string; }
const { lang, canonicalPath } = Astro.props;
const s = t(lang);
const base = `/${lang}`;
---

<div class="tm-header">
  <div class="container-fluid">
    <div class="tm-header-inner">
      <a href={`${base}/`} class="navbar-left tm-site-logo"><img src="/img/nav/logo_marinos.png" alt="Marinos-Aparts" /></a>
      <nav class="navbar tm-main-nav">
        <button class="navbar-toggler hidden-md-up" type="button" data-toggle="collapse" data-target="#tmNavbar">&#9776;</button>
        <div class="collapse navbar-toggleable-sm" id="tmNavbar">
          <ul class="nav navbar-nav">
            <li class="nav-item active"><a href={`${base}/`} class="nav-link">{s.nav.home}</a></li>
            <li class="nav-item"><a href={`${base}/kimon`} class="nav-link">{s.nav.kimon}</a></li>
            <li class="nav-item"><a href={`${base}/irida`} class="nav-link">{s.nav.irida}</a></li>
            <li class="nav-item"><a href="https://reservations.bookoncloud.com/welcome/kimon" target="_blank" class="nav-link">{s.nav.book}</a></li>
            <li class="nav-item"><a href={`${base}/location`} class="nav-link">{s.nav.location}</a></li>
            <li class="nav-item"><a href={`${base}/contact`} class="nav-link">{s.nav.contact}</a></li>
          </ul>
        </div>
        <ul class="languagepicker roundborders">
          <LangSwitcher lang={lang} canonicalPath={canonicalPath} />
        </ul>
      </nav>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Create `src/components/LangSwitcher.astro`**

```astro
---
import type { Locale } from '../i18n/locales.ts';
import { LOCALES } from '../i18n/locales.ts';

interface Props { lang: Locale; canonicalPath: string; }
const { lang, canonicalPath } = Astro.props;
const flag: Record<Locale, string> = { en: '/img/nav/en.png', gr: '/img/nav/gr.jpg' };
// Current locale first, then the alternate(s) — matches the old menu ordering.
const ordered: Locale[] = [lang, ...LOCALES.filter((l) => l !== lang)];
---

{ordered.map((l) => (
  <a href={`/${l}${canonicalPath}/`} data-lang-switch={l} class="js-langanchor">
    <li><img src={flag[l]} height="13" width="18" alt={l} /></li>
  </a>
))}
```

- [ ] **Step 5: Create `src/components/HeaderBottom.astro`**

```astro
---
import type { Locale } from '../i18n/locales.ts';
import { t } from '../i18n/t.ts';

interface Props { lang: Locale; }
const { lang } = Astro.props;
const s = t(lang);
---

<div class="header-bottom">
  <div class="container-fluid">
    <div class="row">
      <div class="contact-top">
        <span set:html={s.header.reservations} />
      </div>
      <div class="fb-top">
        <span set:html={s.header.findus} />
        <a href="https://www.facebook.com/marinosaparts.sivota/" target="_blank" class="facebook"><i class="fab fa-facebook"></i></a>
        <a href="https://www.instagram.com/marinosaparts/" target="_blank" class="instagram"><i class="fab fa-instagram"></i></a>
      </div>
    </div>
  </div>
</div>
```

- [ ] **Step 6: Create `src/components/ScrollToTop.astro`**

```astro
<a href="#" class="scroll-top" aria-label="Scroll to top"><i class="fa fa-angle-up"></i></a>

<script>
  const btn = document.querySelector('a.scroll-top');
  if (btn) {
    const toggle = () => {
      (btn as HTMLElement).style.display = window.scrollY > 500 ? 'block' : 'none';
    };
    toggle();
    window.addEventListener('scroll', toggle);
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }
</script>
```

- [ ] **Step 7: Type-check**

Run: `npx astro check`
Expected: no type errors. (Playwright tests for these run green after Task 7.)

- [ ] **Step 8: Commit**

```bash
git add src/components/Navbar.astro src/components/HeaderBottom.astro src/components/LangSwitcher.astro src/components/ScrollToTop.astro
git commit -m "feat: add navbar, header-bottom, language switcher, scroll-to-top"
```

---

## Task 6: Footer with Map and Weather islands

**Files:**
- Create: `src/components/Footer.astro`, `src/components/Map.astro`, `src/components/WeatherWidget.astro`

**Interfaces:**
- Consumes: `t`, `Locale`.
- Produces: `Footer` takes `{ lang: Locale }` and renders the footer columns (contact info, menu, map container, weather container, copyright with live year). `Map` renders a Leaflet map with both resort markers (home/location behavior). `WeatherWidget` renders the okairos embed for the locale.
- The Map markers default (home/location) show **both** Kimon and Irida pins; `Map` accepts an optional `{ focus?: 'kimon' | 'irida' }` for later per-page use (kimon/irida pages in Plan 2).

- [ ] **Step 1: Write the failing tests**

Add to `tests/home.spec.ts`:

```ts
test('footer shows current year and registry number', async ({ page }) => {
  await page.goto('/en/');
  const year = new Date().getFullYear().toString();
  await expect(page.locator('#current-year')).toHaveText(year);
  await expect(page.locator('.tm-copyright-text')).toContainText('General Registry Number');
});

test('leaflet map initializes in the footer', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#osm-map .leaflet-container')).toBeVisible();
});

test('weather widget container renders for the locale', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('#weather-widget')).toBeVisible();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/home.spec.ts -g "leaflet map"`
Expected: FAIL.

- [ ] **Step 3: Create `src/components/Map.astro`**

```astro
---
interface Props { focus?: 'kimon' | 'irida'; }
const { focus } = Astro.props;
---

<div id="osm-map" data-focus={focus ?? 'all'}></div>

<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />

<script>
  import L from 'leaflet';

  const el = document.getElementById('osm-map');
  if (el) {
    const focus = el.dataset.focus;
    const map = L.map(el);
    L.tileLayer('https://{s}.tile.osm.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    const kimon = L.latLng(39.410685, 20.239593);
    const irida = L.latLng(39.408755, 20.240425);

    if (focus === 'kimon') {
      map.setView(kimon, 15); L.marker(kimon).addTo(map);
    } else if (focus === 'irida') {
      map.setView(irida, 15); L.marker(irida).addTo(map);
    } else {
      map.setView(irida, 15);
      L.marker(kimon).addTo(map);
      L.marker(irida).addTo(map);
    }
  }
</script>
```

Note: a plain (non-`define:vars`) `<script>` is bundled by Astro, so `import L from 'leaflet'` resolves to the npm package (no CDN `leaflet.js`, no jQuery). `focus` is passed through the `data-focus` attribute rather than `define:vars` (which would force the script inline and break the bundled import). The CSS is loaded from CDN to match the current setup; it can be localized later.

- [ ] **Step 4: Create `src/components/WeatherWidget.astro`**

```astro
---
import type { Locale } from '../i18n/locales.ts';

interface Props { lang: Locale; }
const { lang } = Astro.props;

const widget = {
  en: { id: '228566d27061cf3918f08479a88a7daa', title: 'Sivota Weather' },
  gr: { id: 'f21dc8791fa9a5d228373b93621a21e1', title: 'Σύβοτα Καιρός' },
}[lang];
---

<div id="weather-widget">
  <div id={`c_${widget.id}`} class="completo">
    <h2 style="color:#999;margin:0 0 3px;padding:2px;font:bold 13px/1.2 Arial;text-align:center;width:100%">
      <a href="https://www.okairos.gr/%CF%83%CF%8D%CE%B2%CE%BF%CF%84%CE%B1.html"
         style="color:#999;text-decoration:none;font:bold 13px/1.2 Arial;">{widget.title}</a>
    </h2>
    <div id={`w_${widget.id}`} class="completo" style="height:100%"></div>
  </div>
  <script type="text/javascript" src={`https://www.okairos.gr/widget/loader/${widget.id}`} is:inline></script>
</div>
```

- [ ] **Step 5: Create `src/components/Footer.astro`**

```astro
---
import type { Locale } from '../i18n/locales.ts';
import { t } from '../i18n/t.ts';
import Map from './Map.astro';
import WeatherWidget from './WeatherWidget.astro';
import ScrollToTop from './ScrollToTop.astro';

interface Props { lang: Locale; mapFocus?: 'kimon' | 'irida'; }
const { lang, mapFocus } = Astro.props;
const s = t(lang);
const base = `/${lang}`;
const year = new Date().getFullYear();
---

<footer class="tm-footer">
  <div class="container-fluid">
    <div class="row">
      <div class="col-xs-12 col-sm-6 col-md-6 col-lg-3 col-xl-3">
        <div class="tm-footer-content-box tm-footer-links-container">
          <h3 class="tm-title tm-footer-content-box-title">{s.nav.contact}</h3>
          <nav><ul class="nav">
            <li class="tm-footer-link"><i class="fas fa-map-marker"></i> <span>{s.footer.address}</span></li>
            <li class="tm-footer-link"><i class="fa fa-mobile"></i> +30 6909 025 820</li>
            <li class="tm-footer-link"><i class="fa fa-envelope"></i> marinosaparts@gmail.com</li>
          </ul></nav>
        </div>
      </div>
      <div class="col-xs-12 col-sm-6 col-md-6 col-lg-4 col-xl-2">
        <div class="tm-footer-content-box tm-footer-links-container">
          <h3 class="tm-title tm-footer-content-box-title">{s.footer.menu}</h3>
          <nav><ul class="nav">
            <li><a href={`${base}/`} class="tm-footer-link">{s.nav.home}</a></li>
            <li><a href={`${base}/kimon`} class="tm-footer-link">{s.nav.kimon}</a></li>
            <li><a href={`${base}/irida`} class="tm-footer-link">{s.nav.irida}</a></li>
            <li><a href={`${base}/location`} class="tm-footer-link">{s.nav.location}</a></li>
            <li><a href={`${base}/contact`} class="tm-footer-link">{s.nav.contact}</a></li>
          </ul></nav>
        </div>
      </div>
      <div class="col-xs-12 col-sm-6 col-md-6 col-lg-5 col-xl-4">
        <div class="tm-footer-content-box tm-footer-links-container"><Map focus={mapFocus} /></div>
      </div>
      <div class="col-xs-12 col-sm-12 col-md-6 col-lg-4 col-xl-3">
        <div class="tm-footer-content-box tm-footer-links-container"><WeatherWidget lang={lang} /></div>
      </div>
    </div>
    <div class="row">
      <div class="tm-copyright-col"><p class="tm-copyright-text">{s.footer.registryNo}</p></div>
      <div class="tm-copyright-col"><p class="tm-created-text">Copyright <span id="current-year">{year}</span> Marinos-Aparts</p></div>
      <p class="tm-created-text"><small>developed by <a href="https://github.com/stavroskapris" target="_blank">stavroskapris</a></small></p>
    </div>
    <ScrollToTop />
  </div>
</footer>
```

Note: the old footer hid the menu column behind `.hide-footer-menu` and the registry number was the only copyright line; here the menu is shown. **Verify against the live site during the parity gate (Plan 3)** — if the menu must stay hidden, wrap that column in the same `hide-footer-menu` container. This is flagged, not silently decided.

- [ ] **Step 6: Type-check**

Run: `npx astro check`
Expected: no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/Footer.astro src/components/Map.astro src/components/WeatherWidget.astro
git commit -m "feat: add footer with Leaflet map and okairos weather islands"
```

---

## Task 7: Home page route + redirects verification

**Files:**
- Create: `src/pages/[lang]/index.astro`

**Interfaces:**
- Consumes: `BaseLayout`, `Navbar`, `HeaderBottom`, `Footer`, `t`, `getStaticLocalePaths`, `isLocale`.
- Produces: static pages at `/en/` and `/gr/`. Uses `Astro.params.lang`, validated with `isLocale`. `canonicalPath` for home is `''`.

- [ ] **Step 1: Write the failing test (home content)**

Add to `tests/home.spec.ts`:

```ts
test('english home renders intro, welcome, and both resort cards', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('h2.tm-title')).toContainText('Marinos Aparts');
  await expect(page.locator('p').filter({ hasText: 'Welcome to Marinos-aparts Rooms in Sivota' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Kimon Resort' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Irida Resort' })).toBeVisible();
  await expect(page.locator('img[src*="kimon-home"], img[src*="kimon/kimon-home"]')).toHaveCount(1);
});

test('greek home renders translated welcome copy', async ({ page }) => {
  await page.goto('/gr/');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Read More')).toHaveCount(0); // EN-only string absent
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/home.spec.ts -g "english home renders"`
Expected: FAIL — route missing.

- [ ] **Step 3: Create `src/pages/[lang]/index.astro`**

```astro
---
import { Image } from 'astro:assets';
import BaseLayout from '../../layouts/BaseLayout.astro';
import Navbar from '../../components/Navbar.astro';
import HeaderBottom from '../../components/HeaderBottom.astro';
import Footer from '../../components/Footer.astro';
import { getStaticLocalePaths, isLocale, DEFAULT_LOCALE } from '../../i18n/locales.ts';
import { t } from '../../i18n/t.ts';
import kimonHome from '../../../public/img/kimon/kimon-home.jpg';
import iridaHome from '../../../public/img/irida/irida-home.jpg';

export function getStaticPaths() {
  return getStaticLocalePaths();
}

const langParam = Astro.params.lang;
const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;
const s = t(lang);

const title = 'Apartments | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα';
const description = 'Welcome to Marinos-aparts Rooms in Sivota, where your ultimate satisfaction is our only goal';
---

<BaseLayout lang={lang} title={title} description={description} canonicalPath="">
  <Navbar lang={lang} canonicalPath="" />
  <div class="tm-home-img-container"></div>
  <HeaderBottom lang={lang} />

  <section class="tm-section">
    <div class="container-fluid">
      <div class="row">
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12 text-xs-center">
          <h2 class="tm-gold-text tm-title">{s.home.intro}</h2>
          <p>{s.home.welcome}</p>
        </div>
      </div>
      <div class="row tm">
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">
          <div class="tm-2-col-left">
            <h3 class="tm-gold-text tm-title">{s.nav.kimon}</h3>
            <p class="tm-margin-b-60">{s.home.kimonTitle}</p>
            <Image src={kimonHome} alt="Kimon Resort" class="tm-margin-b-40 img-fluid img-rounded" />
            <p class="text-md-left">{s.home.kimonSubTitle}</p>
            <a href={`/${lang}/kimon`} class="tm-btn">{s.home.readMore}</a>
          </div>
        </div>
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">
          <div class="tm-2-col-right">
            <h3 class="tm-gold-text tm-title">{s.nav.irida}</h3>
            <p class="tm-margin-b-40">{s.home.iridaTitle}</p>
            <Image src={iridaHome} alt="Irida Resort" class="tm-margin-b-40 img-fluid img-rounded" />
            <p class="text-md-left">{s.home.iridaSubTitle}</p>
            <a href={`/${lang}/irida`} class="tm-btn">{s.home.readMore}</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <Footer lang={lang} />
</BaseLayout>
```

Note: the two `<img>` tags become optimized `<Image>` (responsive/lazy). The hero `.tm-home-img-container` keeps its CSS background image from `templatemo-style.css`.

- [ ] **Step 4: Run the full home suite to verify it passes**

Run: `npx playwright test tests/home.spec.ts`
Expected: PASS — all home, layout, navbar, switcher, footer, map, weather tests green.

- [ ] **Step 5: Verify redirects build**

Run: `npm run build && ls dist/index.html dist/kimon.html`
Expected: `dist/index.html` (root → `/en/`) and `dist/kimon.html` (old URL → `/en/kimon`) exist as redirect stubs.

- [ ] **Step 6: Commit**

```bash
git add src/pages/[lang]/index.astro
git commit -m "feat: add bilingual home page route with optimized images"
```

---

## Task 8: Link check + test harness finalization

**Files:**
- Modify: `tests/home.spec.ts` (already populated); no new test file
- Verify: `npm run check:links`

**Interfaces:**
- Produces: a green local verification suite — `npm run build`, `npm test`, `npm run check:links` all pass. This is the gate the CI workflows (Plan 4) will run.

- [ ] **Step 1: Run the build**

Run: `npm run build`
Expected: build completes; `dist/en/index.html` and `dist/gr/index.html` exist.

- [ ] **Step 2: Run link checker against the build**

Run: `npm run check:links`
Expected: no broken internal links. (External links to okairos/fontawesome/facebook are allowed; if linkinator flags them as flaky, add `--skip` patterns for those external hosts in the `check:links` script.)

If external hosts cause noise, update the script in `package.json` to:
```json
"check:links": "linkinator ./dist --recurse --silent --skip \"^https?://(www\\.)?(okairos|kit\\.fontawesome|fonts\\.googleapis|unpkg|facebook|instagram|reservations\\.bookoncloud|googletagmanager)\""
```

- [ ] **Step 3: Run the full Playwright suite**

Run: `npm test`
Expected: all tests in `tests/home.spec.ts` PASS in chromium.

- [ ] **Step 4: Commit any script adjustment**

```bash
git add package.json
git commit -m "test: finalize link-check script and verify home suite"
```

---

## Self-Review

**Spec coverage (against `2026-06-20-astro-migration-design.md`):**
- §2 Architecture (layouts/components/i18n/pages structure) → Tasks 1–7. ✓
- §3 i18n per-locale routing + hreflang → Tasks 3, 4, 7; root + old-URL redirects → Task 1 (config) verified Task 7. ✓ (True edge 301s deferred to Plan 4, as the spec's §7 item 3 states.)
- §4 jQuery removed; vanilla islands (map, scroll-to-top, lang switch) → Tasks 5, 6. (Gallery + contact form are other pages → Plan 2.) ✓
- §5 Performance: image pipeline via `<Image>` → Task 7; jQuery/tether/Bootstrap-JS/IE-shims dropped → Tasks 1, 4. (CloudFront invalidation → Plan 4.) ✓
- §6 Testing: Playwright smoke (lang switch, map render, content) + link check → Tasks 4–8. (Contact-form + gallery smoke → Plan 2; full parity gate → Plan 3.) ✓
- §6 CI/CD + §6 buckets/cutover → **Plan 4** (out of scope here, by design). ✓
- §6 Content parity gate → **Plan 3** (out of scope here). ✓

**Placeholder scan:** No TBD/TODO. The one explicitly-flagged open item (footer menu visibility) is a parity-verification note with a concrete fallback, not a placeholder.

**Type consistency:** `Locale`, `t()`, `isLocale`, `getStaticLocalePaths`, `DEFAULT_LOCALE` defined in Task 3 and consumed with matching signatures in Tasks 4–7. `Map` prop `focus?: 'kimon'|'irida'` defined in Task 6 and consumed by `Footer`'s `mapFocus` pass-through — consistent. `BaseLayout` props `{lang,title,description,canonicalPath}` consumed identically in Task 7.

**Cross-plan handoff (interfaces Plan 2 relies on):** `BaseLayout`, `Navbar`, `HeaderBottom`, `Footer` (with `mapFocus`), `Map` (with `focus`), `WeatherWidget`, `t()`, and the i18n JSON pattern. Plan 2 adds `pages.kimon/irida/location/contact` keys to `en.json`/`gr.json`, new page routes under `[lang]/`, and `Gallery.astro` + `ContactForm.astro` islands.

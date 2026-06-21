# [marinos-aparts.gr](https://www.marinos-aparts.gr)

A static, **bilingual (English / Greek)** marketing website for Marinos Apartments (Sivota, Greece),
served from AWS [CloudFront](https://aws.amazon.com/cloudfront/) + [S3](https://aws.amazon.com/s3/),
with the contact form backed by [API Gateway](https://aws.amazon.com//api-gateway/) +
[Lambda](https://aws.amazon.com/lambda/), and DNS on [Route 53](https://aws.amazon.com/route53/).

> **Migration in progress.** The site is being rewritten from plain HTML + jQuery to
> [Astro](https://astro.build). The new app lives under `src/`; the original `*.html` files
> remain at the repo root until the migration completes. **For local development, use the Astro
> workflow below** — the root `.html` files are legacy and are not the source of truth for new work.

---

## Local development

### Prerequisites

- **Node.js 18+** (developed on 18.19) and npm.
- For end-to-end tests, the Playwright browsers (one-time):
  ```bash
  npx playwright install            # browsers only
  # on Linux you may also need system libs:
  npx playwright install --with-deps
  ```

### Install

```bash
npm install
```

### Run the dev server (live reload)

```bash
npm run dev
```

Then open **http://localhost:4321/en/** (or `/gr/`). The dev server hot-reloads on save —
this is the fastest loop for editing pages, components, styles, and translations.

### Build & preview the production output

```bash
npm run build      # outputs the static site to dist/
npm run preview     # serves dist/ at http://localhost:4321
```

`preview` is the most faithful local representation of what gets deployed (optimized images, final
HTML). Use it when verifying the image pipeline or doing a final check.

### Available scripts

| Command | What it does |
|---|---|
| `npm run dev` | Astro dev server with hot reload (http://localhost:4321) |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm test` | Run the Playwright **end-to-end** tests (auto-builds + serves, or reuses a server already on :4321) |
| `npm run test:unit` | Run the **unit** tests (Vitest) — i18n data + helpers |
| `npm run check:links` | Crawl the running site (needs a server on :4321) for broken **internal** links |
| `npm run check:links:ci` | Build, start a preview server, run the link check, then stop the server |

There is no separate lint step; type-checking runs via **`npx astro check`** (used in CI and worth
running before a PR).

### Running the tests

- **Unit (Vitest):** `npm run test:unit` — fast, no browser. Covers the i18n key-parity and helpers
  (`src/**/*.test.ts`).
- **End-to-end (Playwright):** `npm test` — renders each page in both locales and exercises the
  gallery and contact form. The Playwright config (`playwright.config.ts`) auto-runs
  `npm run build && npm run preview`; if you already have a server on :4321 it reuses it.
  - Run a single file: `npx playwright test tests/kimon.spec.ts`
  - Filter by title: `npx playwright test -g "gallery opens"`
- **Link check:** start `npm run preview` (or `npm run dev`) in one terminal, then
  `npm run check:links` in another — or just run `npm run check:links:ci`.

---

## Project structure

```
src/
  pages/[lang]/        # one file per route, rendered per locale → /en/<x>, /gr/<x>
    index.astro        #   home
    kimon.astro        #   thin page → ResortPage
    irida.astro        #   thin page → ResortPage
    location.astro     #   beaches gallery (captions)
    contact.astro      #   contact form page
  layouts/
    BaseLayout.astro   # <head>, global CSS, shared chrome wrapper
  components/
    ResortPage.astro   # shared Kimon/Irida page scaffold (props-driven)
    Gallery.astro      # PhotoSwipe v5 lightbox island
    ContactForm.astro  # vanilla validation + reCAPTCHA + fetch island
    Navbar / Footer / HeaderBottom / Map / LangSwitcher / WeatherWidget / ScrollToTop
  i18n/
    en.json, gr.json   # all translatable copy, keyed per page block
    t.ts, locales.ts   # t(lang) lookup + locale helpers (LOCALES, isLocale, DEFAULT_LOCALE)
  config.ts            # contact API endpoints + reCAPTCHA site key
  assets/              # gallery images (optimized by Astro's <Image>)
  styles/              # bootstrap + template CSS
public/                # served as-is: img/nav, backgrounds, favicon, etc.
tests/                 # Playwright e2e specs (*.spec.ts)
```

### Where to edit common things

- **Page copy / translations:** add the key under the relevant page block in **both**
  `src/i18n/en.json` and `src/i18n/gr.json`, then read it in the page via `const s = t(lang)` →
  `s.<page>.<key>`. Every key must exist in both locales (a unit test enforces parity).
- **A page's layout/markup:** the `.astro` file in `src/pages/[lang]/`. Kimon and Irida share
  `ResortPage.astro` — change the shared scaffold there; pass page-specific values as props.
- **Gallery images:** put them in `src/assets/<gallery>/` so Astro optimizes them (referenced via a
  glob in the page). Nav icons, backgrounds, and other static files go in `public/img/` and are
  referenced by absolute path (e.g. `/img/nav/...`).
- **Adding a new page:** create `src/pages/[lang]/<name>.astro` using `getStaticLocalePaths`, add its
  copy to both i18n files, and add a nav entry in `Navbar.astro` (with the matching `current` key).

### Conventions

- Locale URLs are per-page static routes (`/en/...`, `/gr/...`) — `en` is the default. (This replaces
  the legacy client-side `localStorage` language switch.)
- Import local TS modules **without** a file extension (`../i18n/t`), `.astro` imports **with** the
  extension, and JSON **without** an import assertion.
- No jQuery / Bootstrap JS — interactive bits are small vanilla `<script>` islands.

---

## Deployment

The production site is served via CloudFront + S3 (region `eu-west-1`), with the contact form hitting
API Gateway + Lambda. CI/CD for the Astro build is part of the ongoing migration; the implementation
plans live in `docs/superpowers/plans/`.

<!-- ACKNOWLEDGEMENTS -->
## Resources
* [Template](https://templatemo.com/tm-488-classic)
* [Astro](https://astro.build)
* [PhotoSwipe](https://photoswipe.com)
* [Leaflet](https://leafletjs.com)
* [Open Street Maps](https://www.openstreetmap.org)

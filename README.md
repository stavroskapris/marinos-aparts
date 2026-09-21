# [marinos-aparts.gr](https://www.marinos-aparts.gr)

A static, **bilingual (English / Greek)** marketing website for Marinos Apartments (Sivota, Greece),
served from AWS [CloudFront](https://aws.amazon.com/cloudfront/) + [S3](https://aws.amazon.com/s3/),
with the contact form backed by [API Gateway](https://aws.amazon.com//api-gateway/) +
[Lambda](https://aws.amazon.com/lambda/), and DNS on [Route 53](https://aws.amazon.com/route53/).

> **The Astro rewrite is complete; production cutover is underway.** The app lives under `src/`
> and is the source of truth for all new work — **use the Astro workflow below.**
>
> The original `*.html` files, `js/custom/`, `css/` and `img/` are still at the repo root on
> purpose: they are the **reference corpus for the parity gates** (`npm run parity:text` /
> `parity:images`), which diff the Astro build against the legacy site. They are not served and
> are not edited. They are removed once the cutover has soaked — see
> `docs/superpowers/runbook-cutover.md`.

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
| `npm run parity:text` | Diff the built pages' copy against the legacy `*.html` reference (gate) |
| `npm run parity:images` | Check every image the legacy site referenced is present in the build (gate) |
| `npm run visual:capture` | Screenshot every route for the visual sign-off record |

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
infra/
  cloudfront/          # edge redirect + clean-URL function (ES5) and its unit test
scripts/               # parity gates and the visual-capture helper
docs/superpowers/      # design spec, implementation plans, parity sign-offs, cutover runbook
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

The site is static: `npm run build` emits `dist/`, which is synced to an S3 bucket and served by
CloudFront (region `eu-west-1`). The contact form posts to API Gateway + Lambda; DNS is Route 53.

### Pipelines

| Workflow | Trigger | What it does |
|---|---|---|
| `ci.yml` | pull request | Build + unit + e2e + both parity gates. No deploy. |
| `deploy-staging.yml` | push to the integration branch | Same gates, then sync `dist/` to the staging bucket and invalidate. |
| `deploy-prod.yml` | manual (`workflow_dispatch`) | Same gates, then sync `dist/` to the production bucket and invalidate. |

Every deploy runs the full gate set first — a red test or a parity regression blocks the sync, not
just the merge.

### Clean URLs and redirects

Pages are per-locale static routes (`/en/kimon`), so there is no `index.html` at the site root and
no server to rewrite paths. A **CloudFront Function** (`infra/cloudfront/redirects.js`, attached as
*viewer-request*) does both jobs at the edge:

- redirects the legacy entry points — `/`, `/home.html`, `/kimon.html`, … → their `/en/…` equivalents
- rewrites clean URLs to their S3 object key (`/en/kimon` → `/en/kimon/index.html`), passing through
  anything with a file extension

It is plain ES5 (CloudFront Functions' runtime) and unit-tested in `infra/cloudfront/redirects.test.ts`.
Because the site depends on it, the function and the origin must be configured together — the
cutover runbook does both in a single distribution update.

### Cutover

Migrating the live domain onto the Astro build is documented step by step, with gates and a rollback,
in **`docs/superpowers/runbook-cutover.md`**. Design notes and the implementation plans live in
`docs/superpowers/specs/` and `docs/superpowers/plans/`.

<!-- ACKNOWLEDGEMENTS -->
## Resources
* [Template](https://templatemo.com/tm-488-classic)
* [Astro](https://astro.build)
* [PhotoSwipe](https://photoswipe.com)
* [Leaflet](https://leafletjs.com)
* [Open Street Maps](https://www.openstreetmap.org)

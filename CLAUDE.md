# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, bilingual (English/Greek) marketing website for Marinos Apartments (Sivota, Greece),
built with **Astro** and served from S3 + CloudFront. The contact form is the only dynamic part,
backed by API Gateway + Lambda.

The site was rewritten from plain HTML + jQuery to Astro; **production cut over on 2026-09-21**.
There is no jQuery and no Bootstrap JS — interactive bits are small vanilla `<script>` islands.

## Commands

| Command | What it does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Astro dev server, hot reload — http://localhost:4321/en/ |
| `npm run build` | Build the static site into `dist/` |
| `npm run preview` | Serve the built `dist/` (most faithful to production) |
| `npm run test:unit` | Vitest — i18n key parity, helpers, edge-function logic |
| `npm test` | Playwright e2e — auto-builds and serves, or reuses a server on :4321 |
| `npm run parity:text` | Diff built copy against the legacy `*.html` reference |
| `npm run parity:images` | Assert every legacy-referenced image exists in the build |
| `npm run check:links:ci` | Build, serve, crawl for broken internal links, stop |
| `npx astro check` | Type-check (there is no separate lint step) |

`test:unit`, `test`, `parity:text` and `parity:images` all run **before** the S3 sync in the deploy
workflows — a failure blocks the deploy, not just the merge.

## Architecture

```
src/
  pages/[lang]/        # one file per route, rendered per locale -> /en/<x>, /gr/<x>
    index.astro kimon.astro irida.astro location.astro contact.astro
  layouts/BaseLayout.astro    # <head>, canonical, hreflang, global CSS, chrome
  components/
    ResortPage.astro   # shared Kimon/Irida scaffold (props-driven)
    Gallery.astro      # PhotoSwipe v5 island
    ContactForm.astro  # vanilla validation + reCAPTCHA + fetch island
    Map.astro          # Leaflet island (CSS bundled locally, not from a CDN)
    Navbar / Footer / HeaderBottom / LangSwitcher / WeatherWidget / ScrollToTop
  i18n/
    en.json gr.json    # all translatable copy, keyed per page block
    t.ts locales.ts    # t(lang) lookup; LOCALES, DEFAULT_LOCALE, HREFLANG, isLocale
  config.ts            # contact API endpoints + reCAPTCHA site key (baked at build)
  assets/              # gallery images, optimized by Astro's <Image>
  styles/              # bootstrap + template CSS
public/                # served as-is: img/, robots.txt, favicon
infra/cloudfront/      # edge functions (ES5) + their unit tests
scripts/               # parity gates, visual-capture helper
tests/                 # Playwright specs
docs/superpowers/      # design spec, plans, parity sign-offs, cutover runbook
```

## Internationalization

Locales are **static per-locale routes** (`/en/...`, `/gr/...`), `en` default. This replaced the
legacy client-side `localStorage` language switch — there is no runtime translation step.

To add translatable text: add the key under the relevant page block in **both** `src/i18n/en.json`
and `src/i18n/gr.json`, then read it via `const s = t(lang)` -> `s.<page>.<key>`. **A unit test
enforces key parity between locales**, so a key added to only one side fails `test:unit`.

**`gr` is a URL segment, not a language tag.** The Greek pages live under `/gr/` but the BCP 47
tag is `el`; `HREFLANG` in `src/i18n/locales.ts` maps between them and feeds `<html lang>`,
`hreflang` and the sitemap. Don't "fix" `hreflang="el"` to match the path, and don't change
`data-lang-switch="gr"`, which *is* a path.

Adding a page: create `src/pages/[lang]/<name>.astro` using `getStaticLocalePaths()`, add its copy
to both i18n files, and add a nav entry in `Navbar.astro` with the matching `current` key.

## The edge layer (easy to break)

Pages are per-locale static routes, so there is **no `index.html` at the site root** and no server
to rewrite paths. Two CloudFront Functions do that work, and the site does not render correctly
without the first one:

- **`infra/cloudfront/redirects.js`** — *viewer-request*, on both distributions. Redirects legacy
  entry points (`/`, `/home.html`, `/kimon.html`, ...) to their `/en/...` equivalents; rewrites
  clean URLs to their S3 key (`/en/kimon` -> `/en/kimon/index.html`); rewrites `/sitemap.xml` to
  the generated `/sitemap-index.xml`; passes anything with a file extension through.
- **`infra/cloudfront/staging-noindex.js`** — *viewer-response*, **staging only**. Adds
  `X-Robots-Tag: noindex, nofollow` so the mirror doesn't compete with the real domain. It is a
  function rather than a response-headers policy because the staging distribution is on
  CloudFront's Free pricing plan, which rejects custom response headers policies.

Both must be **ES5** (`function handler(event){}`, no arrow functions, template literals or
`module.exports`) — that is the CloudFront Functions runtime. Both are unit-tested by loading the
file and invoking `handler`, so they stay plain functions.

Redirects currently return **302, not 301**, for the post-cutover soak: browsers cache a 301
forever, which would strand visitors on `/en/*` even after a rollback. Flip to 301 (and update the
test) once production has settled.

## Deployment

`npm run build` emits `dist/`, which is synced to S3 and served by CloudFront (`eu-west-1`).

| Workflow | Trigger | Target |
|---|---|---|
| `ci.yml` | pull request into `astro-migration` or `master` | gates only, no deploy |
| `deploy-staging.yml` | push to `master` | staging bucket |
| `deploy-prod.yml` | manual (`workflow_dispatch`) | production bucket |

The legacy `main.yml` (push to `master` → `aws s3 sync ./` of the whole repo root into the old
bucket) has been deleted. It had to go **before** `astro-migration` merges to `master`, or that
merge would have fired it and pushed the repo source — and the checkout's `.git` directory — into
the rollback bucket.

Until that merge lands, `master` is still the pre-migration site and `astro-migration` is the
trunk. Afterwards `master` is the trunk and pushes to it deploy staging; production stays manual.
Note `deploy-prod.yml` is **not dispatchable** until it exists on the default branch — that is
why the cutover deployed production by direct `aws s3 sync`.

The step-by-step cutover, with gates and rollback, is in `docs/superpowers/runbook-cutover.md`.

**Origin and function must change together.** Because the site depends on the redirect function,
repointing a distribution's origin to the Astro bucket without attaching the function (or the
reverse) serves 404s for everything. Do both in a single `update-distribution` call — the console
cannot, since Origins and Behaviors are separate saves.

This repository is **public**. Never commit AWS account IDs, distribution/OAC/OAI IDs or bucket
policies; the runbook uses placeholders for exactly this reason.

## Gotchas

- **`@astrojs/sitemap` is pinned to 3.2.1.** 3.7.x reads routes from the `astro:routes:resolved`
  hook, which only exists in Astro 5. On this repo's Astro 4.x it never fires and the build dies
  with `Cannot read properties of undefined (reading 'reduce')`. Don't bump it without upgrading
  Astro.
- **The root `*.html`, `css/`, `js/`, `img/` and `sitemap.xml` are the legacy site, kept on
  purpose** as the reference corpus for the parity gates. They are not served, not built, and not
  edited. They go away once the cutover has soaked.
- **`src/config.ts` is baked into the build.** The endpoints and reCAPTCHA key are public values,
  so there is no per-environment secret and no runtime config. (Historic note: the legacy deploy
  workflow excluded `js/custom/config/*` from its sync, but the bucket copy was identical to the
  committed one — nothing was ever overridden.)
- The contact API has exactly one API Gateway stage, named `dev`. Despite the name, **it is
  production** — there is no other stage. CORS is `*`, so reCAPTCHA is the only spam control.
- New gallery images go in `src/assets/<gallery>/` so Astro optimizes them. Nav icons, backgrounds
  and other static files go in `public/img/` and are referenced by absolute path (`/img/nav/...`).
- Import local TS **without** a file extension (`../i18n/t`), `.astro` imports **with** it, and
  JSON **without** an import assertion.
- Playwright's chromium is installed without `--with-deps` in some environments; a browser *launch*
  failure is an environment issue, not a test defect.

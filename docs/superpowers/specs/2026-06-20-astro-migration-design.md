# Phase 1: Astro Migration (Lift-and-Shift) — Design

**Date:** 2026-06-20
**Status:** Approved (pending spec review)
**Scope:** Migrate the marinos-aparts.gr static site from hand-written HTML + jQuery to the Astro static-site generator, preserving the current visual design, while landing the engineering wins (kill duplication, proper i18n, drop jQuery, automated testing, gated CI/CD).

**Out of scope (separate future specs):**
- Visual redesign / UX overhaul — this phase is a faithful lift-and-shift; the site should look the same.
- Changes to the AWS backend (API Gateway + Lambda contact endpoint, reCAPTCHA). It stays exactly as-is.

---

## 1. Goals & Non-Goals

### Goals
1. Move to a component-based SSG (Astro) so the duplicated `<head>`/nav/footer across 5 HTML files collapse into shared layouts/components.
2. Replace the client-side translation system with **per-locale pre-rendered pages** (`/en/...`, `/gr/...`) for SEO and to remove the flash-of-untranslated-content.
3. Remove jQuery entirely; rebuild interactivity as vanilla-JS Astro islands.
4. Improve performance, primarily via Astro's image optimization pipeline and by eliminating render-blocking dependencies.
5. Add right-sized automated testing (Playwright smoke tests + build checks).
6. Modernize CI/CD: PR previews, auto-deploy to staging on merge, manual gated prod deploy with CloudFront invalidation.

### Non-Goals
- No redesign. Visual parity with the current site is a success criterion.
- No backend changes. The contact form keeps posting to the existing API Gateway/Lambda endpoints.
- No new third-party services for site features (keep okairos weather widget, GA4, Leaflet/OSM, PhotoSwipe).

---

## 2. Architecture & Project Structure

Astro configured for fully static output (`output: 'static'`). Build artifacts (`dist/`) deploy to S3 + CloudFront — same hosting model as today.

```
src/
  layouts/
    BaseLayout.astro       # <head>, GA4, fonts, favicon, shared meta, structured data
  components/
    Navbar.astro
    Footer.astro
    HeaderBottom.astro     # reservations / find-us block
    Gallery.astro          # PhotoSwipe island
    Map.astro              # Leaflet island
    WeatherWidget.astro    # okairos embed (per-locale widget id)
    ContactForm.astro      # form + validation + reCAPTCHA island
    ScrollToTop.astro
    LangSwitcher.astro
  pages/
    [lang]/
      index.astro          # home
      kimon.astro
      irida.astro
      location.astro
      contact.astro
  i18n/
    en.json
    gr.json
    utils.ts               # locale helpers (t(), getStaticPaths for [lang])
  assets/                  # images imported through Astro's image pipeline
  styles/                  # ported CSS (templatemo-style, etc.)
public/
  favicon.ico, robots.txt, _redirects or equivalent, static passthrough
astro.config.mjs
```

**Duplication elimination:** the five `*_lang.js` dictionaries and the assembled `App.langData` object are replaced by two structured JSON files (`en.json`, `gr.json`) mirroring the existing key structure (pages → keys, galleryDescriptions, facilities, form error messages, navbar, reservations, findus). Components read translations at build time.

---

## 3. Internationalization & URLs

- **Routing:** dynamic `[lang]` segment with `getStaticPaths` generating `en` and `gr` variants of each page. Results in `/en/`, `/en/kimon`, `/en/irida`, `/en/location`, `/en/contact` and the `/gr/...` equivalents.
- **Default locale:** `/` redirects to the preferred/default locale (English, matching current default `'en'`).
- **hreflang:** each page emits correct per-locale `hreflang` alternates (replacing today's tags that all point at the same URL).
- **Language switch:** `LangSwitcher` renders a plain link to the same page in the other locale. No `localStorage`, no `location.reload()`, no client-side re-translation.
- **Translations:** rendered at build time from `en.json` / `gr.json`. No `.lang` / `data-key` runtime DOM rewriting.

### Redirects (preserve SEO)
Old flat URLs must redirect (301) to their new English-locale equivalents:

| Old | New |
|-----|-----|
| `/` | `/en/` (default locale) |
| `/home.html` | `/en/` |
| `/kimon.html` | `/en/kimon` |
| `/irida.html` | `/en/irida` |
| `/location.html` | `/en/location` |
| `/contact.html` | `/en/contact` |

Redirect mechanism depends on the chosen hosting/preview path (CloudFront Function / S3 routing rules, or platform-native redirects). To be finalized in the implementation plan alongside the hosting verification (Section 7).

`sitemap.xml` is regenerated (via `@astrojs/sitemap` or equivalent) to list the new per-locale URLs with correct `lastmod`.

---

## 4. Interactivity (jQuery removed)

All interactivity becomes vanilla-JS Astro islands; JS ships only on pages that use each widget. The 2015-era jQuery, tether, and jquery-validation dependencies are removed.

| Widget | Approach | Notes |
|--------|----------|-------|
| Photo gallery | Current PhotoSwipe (no jQuery dependency) | Build the items array from rendered figures; same lightbox UX. Captions sourced from i18n `galleryDescriptions`. |
| Contact form | Native HTML5 validation + small vanilla JS | Same field rules (name min 3, email, subject min 5, message min 10) and localized error messages. Same async POST to API Gateway `contact` endpoint and reCAPTCHA verify flow. |
| Map | Leaflet + OSM tiles | Same hardcoded Kimon/Irida coordinates and per-page marker logic. |
| Weather widget | okairos.gr embed | Per-locale widget id (en vs gr), kept as-is. |
| Lang switcher | Plain links | Replaces the jQuery click → localStorage → reload handlers. |
| Scroll-to-top | A few lines of vanilla JS | Show on scroll, smooth scroll to top. |

GA4 (`G-7PRPXQ745M`) is kept in the base layout. API endpoints continue to live in a config module (`App.apiEndPoints` equivalent) — kept out of the repo-to-prod sync the way the current `js/custom/config/*` exclusion works, or via build-time env. Exact handling finalized in the plan.

---

## 5. Performance

Primary lever: **images**. The `img/` tree is many full-size JPEGs served as-is. Astro's image pipeline provides responsive `srcset`, modern formats (WebP/AVIF) with fallbacks, lazy-loading, and explicit width/height (eliminating layout shift).

Secondary wins:
- Remove jQuery + tether (render-blocking, ~large legacy payload).
- Remove/replace render-blocking `<script>` tags currently in `<head>` (html5shiv, respond.js, externally-hosted tether) — html5shiv/respond.js target IE and can be dropped.
- Scope per-page JS via islands so the home page doesn't ship gallery/map/form code it doesn't use.
- **Add CloudFront cache invalidation on deploy** (currently missing — deploys can serve stale assets).

A Lighthouse comparison (before vs after) is captured as evidence but performance budgets/CI gating are deferred to the redesign phase.

---

## 6. Testing & CI/CD

### Testing
- **Playwright smoke tests** covering the things that can actually break:
  - Language switch navigates to the correct locale page.
  - Photo gallery opens (PhotoSwipe lightbox).
  - Map renders (Leaflet container initialized).
  - Contact form validates (rejects bad input) and submits the expected payload (network mocked).
- **Build checks:** link checker (no broken internal links) + HTML validation, run in CI.

### CI/CD pipeline
Three environments: ephemeral **preview** (per PR), long-lived **staging**, and **prod**.

| Trigger | Steps |
|---------|-------|
| PR opened/updated | install → build → test → deploy ephemeral **preview** → comment preview URL |
| Merge to `master` | install → build → test → **auto-deploy to staging** |
| Manual `workflow_dispatch` | install → build → test → **deploy prod** → **invalidate CloudFront** |

Notes:
- Prod is intentionally **manual** so staging can be eyeballed before release.
- Tests gate every path — a failing build or test blocks the deploy.

### Buckets & cutover (decided)
Production today is `marinos-test-bucket` (misleading name). S3 buckets cannot be renamed, so we create two new, clearly-named buckets and retire the legacy one:

- `marinos-aparts-prod` — new production bucket. The **existing** prod CloudFront distribution has its origin **repointed** to this bucket, preserving the domain, ACM certificate, and Route 53 config.
- `marinos-aparts-staging` — new staging bucket with its **own** CloudFront distribution/URL, fully independent of prod.
- `marinos-test-bucket` — **decommissioned** after prod cutover is verified.

Cutover sequence (detailed in the implementation plan):
1. Create both new buckets.
2. Build + deploy to `marinos-aparts-prod`; repoint the prod distribution origin; verify on the live domain.
3. Stand up the staging bucket + distribution; wire merge-to-master auto-deploy to it.
4. Once prod is confirmed serving from the new bucket, decommission `marinos-test-bucket`.

PR previews still use the mechanism chosen in Section 7 item 2 (separate from these two long-lived buckets).

---

## 7. To Verify During Implementation (not assumed)

These are explicit unknowns to resolve in the implementation plan, not silently assumed:

1. **CloudFront distribution details** — production is confirmed to be `marinos-test-bucket` (being replaced — see Section 6 "Buckets & cutover"). Still need to obtain the prod CloudFront distribution ID and confirm it fronts the bucket, so we can repoint its origin and wire cache invalidation into the manual prod deploy.
2. **Preview & staging hosting mechanism** — choose between:
   - All-AWS: preview/staging as separate S3 prefixes/buckets behind CloudFront.
   - Hybrid: ephemeral PR previews on Cloudflare Pages/Netlify (native preview support) while staging + prod stay on AWS S3/CloudFront.
   Pick is made in the plan; prod stays on AWS S3 + CloudFront regardless.
3. **Redirect mechanism** — CloudFront Function vs S3 routing rules vs platform redirects, depending on (2).
4. **Secrets/config** — how API endpoints and AWS credentials are provided to each environment (build-time env vs committed config excluded from sync, as today).

---

## 8. Success Criteria

- Site builds with Astro to static output and deploys through the new pipeline.
- Visual parity: pages look the same as the current site (lift-and-shift).
- `/en/...` and `/gr/...` pages render correctly in both languages with correct `hreflang`; old flat URLs 301-redirect to new ones.
- No jQuery in the shipped bundle.
- Playwright smoke tests + build checks pass in CI.
- PR previews deploy automatically; merge to master auto-deploys staging; prod deploys only via manual `workflow_dispatch` and invalidates CloudFront.
- Measurable performance improvement (Lighthouse before/after), driven mainly by image optimization and dependency removal.

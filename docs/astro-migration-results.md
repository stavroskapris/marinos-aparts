# Astro Migration — Results

The Marinos Apartments site was rewritten from a static HTML + jQuery + Bootstrap
brochure into a static **Astro 4** build, on the same AWS S3 + CloudFront hosting.
This file is a record of what the migration achieved.

## What changed

- **No more jQuery / Bootstrap runtime.** Pages are pre-rendered static HTML with
  small, targeted islands (Leaflet map, PhotoSwipe gallery, okairos weather, the
  contact form). Bundling is done at build time by Astro/Vite.
- **Per-locale static URLs** (`/en/…`, `/gr/…`) replace the client-side
  `localStorage` + full-page-reload translation scheme.
- **Redirects + clean URLs moved to the edge** — a CloudFront Function
  (`infra/cloudfront/redirects.js`) 301s the legacy `*.html` URLs to their new
  clean equivalents and rewrites directory URLs to `index.html`.
- **CI/CD via GitHub Actions** — PR gate (build + unit + e2e + parity), auto-deploy
  to staging, manual-dispatch deploy to prod; both gated on the parity scripts.
- **Last CDN dependency removed** — Leaflet CSS is now bundled locally instead of
  loaded from unpkg.

## Performance: legacy prod vs Astro staging

Measured in headless Chromium (Playwright), empty cache per run, median of 5 runs
per page, both sites served behind CloudFront. Negative = staging faster/lighter.

| Metric (median across 5 pages) | Legacy prod | Astro staging | Δ |
|---|---:|---:|---:|
| TTFB | 81 ms | 37 ms | −54% |
| First Contentful Paint | 308 ms | 292 ms | −5% |
| Largest Contentful Paint | 556 ms | 484 ms | −13% |
| DOMContentLoaded | 579 ms | 389 ms | −33% |
| Full Load | 956 ms | 672 ms | −30% |
| Requests | 54 | 42 | −22% |
| Page weight | 5.6 MB | 1.4 MB | −74% |

Per-page Load time and weight:

| Page | Load (prod → stg) | Weight (prod → stg) |
|---|---|---|
| home | 1024 → 614 ms (−40%) | 5559 → 2903 KB (−48%) |
| kimon | 956 → 691 ms (−28%) | 37696 → 1447 KB (−96%) |
| irida | 839 → 601 ms (−28%) | 46062 → 1004 KB (−98%) |
| location | 952 → 672 ms (−29%) | 4672 → 1174 KB (−75%) |
| contact | 1533 → 1220 ms (−20%) | 2125 → 2079 KB (−2%) |

### Caveats (read these before quoting the numbers)

- **kimon/irida weight (−96% / −98%) is not a pure win.** Legacy prod front-loads
  ~37–46 MB of full-resolution gallery images; staging currently ships *low-res*
  placeholder images (a known deferred content task). Some of that gap is degraded
  image quality, not optimisation. When higher-res sources are added, staging
  weight on those pages will rise — though it should stay well below the legacy
  figures, since the gallery lazy-loads instead of front-loading every image.
  **Re-run the benchmark after the image fix.**
- **TTFB (−54%)** is directionally real but partly infra/cache-warmth (fresh
  staging edge vs the legacy origin); don't quote the exact percentage.
- Single machine, modest sample — directional, not lab-grade.

The load/DCL/LCP improvements (~13–33%) are the trustworthy, repeatable wins from
dropping the jQuery/Bootstrap runtime for Astro's static output.

Benchmark methodology is reproducible; the script measures Navigation Timing + a
largest-contentful-paint observer + summed `transferSize` across resources.

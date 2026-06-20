# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A static, serverless bilingual (English/Greek) marketing website for Marinos Apartments (Sivota, Greece). Plain HTML + jQuery — **no build step, no bundler, no framework, no tests**. Files are served as-is. The contact form is the only dynamic part, backed by AWS API Gateway + Lambda.

## Commands

- `npm install` — installs the two runtime deps (`animate.css`, `jquery-validation`). The vendored libs in `js/` (jQuery, Bootstrap, PhotoSwipe) and CSS are committed directly, not pulled from npm.
- There is no build, lint, test, or local-dev command. To preview, open the `.html` files directly or serve the repo root with any static server (e.g. `python3 -m http.server`).
- **Deploy is automatic**: pushing to `master` triggers `.github/workflows/main.yml`, which runs `aws s3 sync` to the S3 bucket (region `eu-west-1`). Infra is CloudFront + S3 + API Gateway + Lambda + Route 53.

## Page model

Pages are standalone HTML files (`home.html`, `kimon.html`, `irida.html`, `location.html`, `contact.html`). There is no `index.html` in the repo — the site root resolves via CloudFront. Each page declares its identity with a hidden input:

```html
<input type="hidden" id="whichPage" value="home">
```

`js/custom/app.js` reads `#whichPage` into the global `page` variable on load and branches on it for translation, map markers, and contact-form setup. **Any new page must set `#whichPage` and be wired into the language data (below), or it will render untranslated and the map/gallery will break.**

## Internationalization (the core system to understand)

Language is stored in `localStorage['lang']` (defaults to `'en'`). Switching language sets the value and calls `location.reload()` — translation happens client-side on every page load, not via separate localized pages.

Translatable DOM nodes carry `class="lang"` and `data-key="<key>"`. On load, `App.translate(page)` looks each key up in `App.langData` and replaces the node's HTML.

`App.langData` is **assembled** in `js/custom/lang/app_lang.js` from the smaller dictionaries, so script load order matters. The required order (as in the HTML files) is:

1. `js/custom/app.js` (defines the global `App`)
2. `js/custom/lang/navbar_lang.js`, `facilities_lang.js`, `header_bottom_lang.js` (leaf dictionaries)
3. `js/custom/lang/app_lang.js` (references the leaf dicts — must load **last**)

Lookup path is `App.langData.languages[lang].pages[page][key]`. To add translatable text: add the element with `class="lang" data-key="..."`, then add that key under **both** `en` and `gr` for the relevant page in `app_lang.js` (and/or the leaf dict it pulls from).

## Other client behavior (all in `js/custom/app.js`)

- **Maps**: Leaflet + OpenStreetMap tiles. GPS coordinates for the Kimon and Irida resorts are hardcoded in `App.initializeMap()` and chosen by `page`.
- **Gallery**: PhotoSwipe, initialized from `<figure>` elements inside `#gallery`; captions come from the translation data (`galleryDescriptions`).
- **Weather widget**: third-party okairos.gr embed, with separate EN/GR widget IDs swapped by language.
- **Contact form**: client-side validation via `jquery-validation`, Google reCAPTCHA, then AJAX POST to API Gateway. Endpoints live in `js/custom/config/config.js` as `App.apiEndPoints` (`contact`, `recaptcha`).

## Gotchas

- The deploy workflow excludes `js/custom/config/*` from the S3 sync (`--exclude "./js/custom/config/*"`), even though `config.js` is committed. Production keeps its own config; editing `config.js` locally will not change production endpoints.
- New images go under the structured `img/` subfolders (`img/kimon/`, `img/irida/`, `img/beaches/`, `img/nav/`); reference them with relative paths.
- Header/footer markup is duplicated across the HTML files — changes to nav, footer, or script tags must be applied to every page.

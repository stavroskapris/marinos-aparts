# Modern Redesign — Design

**Date:** 2026-09-29
**Status:** Approved (pending spec review)
**Scope:** Replace the 2017 `tm-488-classic` template with a modern, motion-rich design across all five existing pages, keeping the same URLs and using only the existing photography. Rewrite the site copy in both locales. Retire the parity gates and the legacy reference corpus they depend on.

This is the "visual redesign / UX overhaul" that `2026-06-20-astro-migration-design.md` deferred as a separate future spec.

**Out of scope:**
- The contact form's behaviour. Validation, reCAPTCHA, the fetch and its error branches are not touched. Only markup classes and styling change. The production endpoint split completed and was verified end to end on 2026-09-29; a redesign is no reason to re-risk it.
- Any AWS or backend change. No Lambda, API Gateway, SES, CloudFront distribution or edge function changes.
- New photography. The existing image set is a hard constraint.
- New paid services or dependencies with a cost.

---

## 1. Goals and Non-Goals

### Goals
1. The site reads as built this year, not as a 2017 template.
2. Motion is part of the design: a hero slider, scroll reveals, hover states, a nav that reacts to scroll.
3. Both locales look like one brand. Every typeface ships Greek.
4. Copy is rewritten in both languages, keeping the facts and the family tone.
5. The Greek pages stop serving English metadata.
6. The CSS payload drops substantially and the end-of-life Bootstrap dependency goes away.

### Non-Goals
- No new pages, no URL changes, no change to the `/en/` and `/gr/` routing model.
- No CMS, no framework, no component library.
- No redesign of the lightbox. PhotoSwipe v5 stays.

---

## 2. Visual language

### 2.1 Typography

**Display: EB Garamond. Body and UI: Manrope.** Both are self-hosted, both ship Greek.

This choice is constrained, not stylistic preference. Only 118 of Google's 1946 families include Greek glyphs. Playfair Display, Cormorant, Fraunces, Prata, Bodoni Moda, Marcellus, Lora, Spectral, Jost, DM Sans and Montserrat all have none. Any of them would leave the `/gr/` pages falling back to a system font, silently, and the two languages would stop looking related. EB Garamond's Greek descends from types cut for Greek in the sixteenth century, so the two scripts genuinely share a design rather than one being retrofitted.

EB Garamond gives weights 400 to 800 with italics; Manrope gives 200 to 800. Both have a variable `wght` axis.

Rejected: **GFS Didot** is more distinctive and is Greek-first, drawn by the Greek Font Society, but ships a single weight with no italic, which is not enough for five pages. **Alegreya with Alegreya Sans** is harmonious but reads bookish rather than boutique.

**Type scale** (custom properties in `tokens.css`):

| Token | Value | Use |
|---|---|---|
| `--fs-display-xl` | `clamp(2.75rem, 6vw, 5rem)` / 1.03 | Hero h1, EB Garamond 500 |
| `--fs-display-l` | `clamp(2rem, 3.5vw, 3rem)` / 1.1 | Section h2 |
| `--fs-display-m` | `clamp(1.5rem, 2.2vw, 2rem)` / 1.15 | h3, card titles |
| `--fs-lead` | `1.1875rem` / 1.62 | Hero subline, intro paragraphs, Manrope 300 |
| `--fs-body` | `1.0625rem` / 1.7 | Body text, Manrope 400 |
| `--fs-small` | `0.8125rem` / 1.55 | Captions, footer |
| `--fs-eyebrow` | `0.6875rem`, `0.22em` tracking, uppercase, Manrope 600 | Section labels |

### 2.2 Palette: "Ionian"

| Token | Hex | Role |
|---|---|---|
| `--c-deep-sea` | `#0B3C53` | Headings, footer, hero scrim |
| `--c-sivota-blue` | `#006994` | Links, buttons, active nav. Carried unchanged from the current site. |
| `--c-olive` | `#5A6639` | Second accent: section labels, rules |
| `--c-ink` | `#1B2A32` | Body text |
| `--c-sand` | `#E9E1D5` | Cards, alternating bands |
| `--c-limestone` | `#F7F4EF` | Page ground |

Every foreground and background combination in use clears WCAG AA for **body text at 4.5:1**, not merely large text. Measured: Ink on Limestone 13.44, Deep Sea on Limestone 10.72, Sivota Blue on Limestone 5.55, Olive on Limestone 5.64, white on Deep Sea 11.76, white on Olive 6.19.

The olive was darkened from an initial `#6F7D4A`, which failed at 4.07 and 4.46. Any future change to these values must be re-measured, not eyeballed.

White text over a photograph cannot be guaranteed by a palette, so the hero carries a fixed Deep Sea scrim rather than depending on the image being dark enough.

### 2.3 Spacing, radii, easing

Spacing scale on a 4px base: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128. Section block padding `clamp(4rem, 8vw, 8rem)`. Radii stay tight: 2px on buttons, 3px on cards, nothing pill-shaped. Easing `--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`; durations 200ms, 400ms, 800ms. Breakpoints at 640, 900 and 1200px.

---

## 3. Photo policy

The image set is uneven, and the design must respect that rather than upscale. Measured inventory:

- **Hero-grade, 3648px wide or more:** all 15 Irida photos; Kimon 1 to 7, 13, 17, 18 and 20. Twenty-seven images. These can carry full-viewport heroes, full-bleed bands and slider slides.
- **Card-grade only, 1280 to 2048px:** Kimon 8, 9, 10, 11, 12, 14, 15, 16 and 19. Never used full-bleed.
- **Beaches, 600×400 to 1317×500:** card grid only, displayed at 400px or less. Never a hero, never a large slide.
- **Legacy banner strips** (`public/img/*-sivota.jpg`, 4000×1053 to 7000×1843, up to 1.6MB and unoptimised): **retired.** At roughly 3.8:1 they cannot fill a tall viewport, and they are currently served raw from `public/`. Their only reference anywhere in `src/` is `templatemo-style.css`, which this work deletes, so nothing points at them once the foundation slice lands. The five files are then deleted in the polish slice. This is the one exception to "`public/img/` stays" in section 8, and it is safe precisely because it is verified to be the last reference.

**`src/assets/kimon-home.jpg` is 645×484 and must be replaced** by a crop from a high-resolution Kimon photo. Today the home page shows Kimon at 645px beside Irida at 3648px, which is why that side of the page looks weaker.

Home hero slider uses `irida5`, `kimon20`, `irida10`, `kimon3`, all 4608×3456.

Three defects in the current CSS that this work removes: heroes use `background-size: 100% 100%`, a non-uniform stretch, so every hero is distorted; below the `md` breakpoint `templatemo-style.css:456` sets `background: none; height: auto`, so **there is no hero image on mobile at all**; and `col-xs-*` classes throughout the markup are inert, having been removed in Bootstrap 4.

---

## 4. Page designs

**Home.** Full-viewport hero slider, four slides, Ken Burns drift, headline, subline, two calls to action, transparent nav. Then a short intro band on Limestone. Then the two houses as alternating split sections, Kimon photo-left, Irida photo-right, photos zooming on hover, copy revealing on scroll, each linking to its page. Then a three-fact row (distance to harbour, family-run, private balconies) with inline SVG icons. Then a full-bleed Sivota band linking to the location page, then a booking band, then the footer.

**Kimon and Irida.** Both keep the shared `ResortPage` scaffold. Hero at 80vh with that property's strongest photo. Intro plus a key-facts row. Facilities become a responsive grid with inline check icons, replacing the two bare `<ul>` columns. Gallery grid gains varied tile sizes, hover zoom and caption reveal; PhotoSwipe itself is unchanged. Then map and booking band.

**Location.** Shaped around the photo constraint rather than fighting it. **No full-viewport hero:** a typographic opening on Limestone with one wide photo band beneath, at a height the source can actually fill. The twelve beaches become a card grid at roughly 400px per card, which those files serve at or above native size. Hover lifts and zooms; click opens the existing lightbox. Then a full-width map, larger than the footer instance.

**Contact.** Short hero band. Form left, contact details and map right. Form JavaScript untouched.

**The okairos weather widget stays**, contained in a styled card rather than sitting in the footer grid. It injects its own inline styles (`font: bold 13px/1.2 Arial`) which we cannot control, so it is boxed rather than blended. If it proves unstylable during staging review, we revisit then.

---

## 5. Motion

| Name | Behaviour |
|---|---|
| `reveal` | Fade in and rise 16px on entering the viewport. One shared `IntersectionObserver`, driven by `data-reveal`, optional stagger via `data-reveal-delay`. |
| `ken-burns` | Scale 1.00 to 1.08 over 8s, active hero slide only. |
| `hover-zoom` | Image scale to 1.05 over 400ms, on hover **and focus**. |
| `nav-solidify` | Transparent nav gains a Deep Sea background and shadow past 80px of scroll. |
| `slider` | Crossfade, 6s autoplay, dots and arrow keys, pauses on hover, on `focus-within`, and on `visibilitychange` when the tab is hidden. |

Three rules that are part of the design, not implementation detail:

1. **Reveal must not hide content when JavaScript fails.** A `js` class goes on `<html>` before first paint, and the hidden starting state applies only under that class. Without it, a script error leaves a blank page.
2. **`prefers-reduced-motion: reduce` disables all of the above,** including slider autoplay, not merely the transforms.
3. **The hero reserves its height before the slider initialises,** so it cannot cause layout shift.

---

## 6. Architecture

```
src/styles/
  tokens.css     # colour, type scale, spacing, easing, durations
  base.css       # reset, element defaults, typography
  layout.css     # container and section primitives
  motion.css     # reveal, ken-burns, hover, reduced-motion
                 # bootstrap.min.css and templatemo-style.css are DELETED
src/components/
  Hero.astro          # slider or static band, props-driven
  Section.astro       # band wrapper: ground colour, padding
  SplitFeature.astro  # alternating photo and copy block
  FactGrid.astro      # fact trio and facilities grid
  Icon.astro          # inline SVG by name
  Navbar / Footer / Gallery / ContactForm / Map / HeaderBottom
                      # restyled, not rebuilt
src/scripts/
  reveal.ts  slider.ts  nav.ts
```

Current CSS is roughly 125KB, of which `bootstrap.min.css` is 95KB. Target after replacement is 15 to 20KB.

**Icons.** The seven icons in use (`fa-map-marker`, `fa-mobile`, `fa-envelope`, `fa-angle-up`, `fa-spinner`, `fa-facebook`, `fa-instagram`) become inline SVG, and the Font Awesome Kit script is removed from `BaseLayout`. It is currently a render-blocking third-party script loaded to draw seven glyphs. The spinner's `fa-spin` animation is replaced by a CSS keyframe that respects `prefers-reduced-motion`.

**Fonts.** Self-hosted via Fontsource, replacing the Google Fonts `<link>`. This removes a third-party request that has drawn GDPR enforcement in the EU, and the site's visitors are largely EU.

---

## 7. Copy and i18n

Full rewrite of both locales in `src/i18n/en.json` and `gr.json`, keeping every fact and the family tone. The existing key-parity unit test protects the work: a key added to one locale and not the other fails `test:unit`.

Roughly 10 to 15 new short strings are required regardless, because the design needs a hero headline, sublines, call-to-action labels and section eyebrows, and the current copy's shortest string is a 130-word paragraph.

**The SEO metadata fix folds in here.** All five Greek pages currently serve English titles and descriptions because those are hardcoded literals in each page's frontmatter rather than read from i18n. This spec moves them into i18n, which supersedes the corresponding items in `docs/superpowers/plans/2026-09-22-seo-metadata-fixes.md`.

**Contact number.** The header and footer show `+30 6909 025 820`; the JSON-LD in `BaseLayout.astro` shows `+30 6936 772 821`. Two different numbers on one page. This spec makes it a **single value with one source of truth**, consumed by header, footer and JSON-LD alike, defaulted to `+30 6909 025 820` because that is the number actually displayed, in two places. The owner is confirming which is correct; when the answer arrives it is a one-line change rather than three.

---

## 8. Retiring the parity gates

`parity:text` diffs built copy against the legacy root `*.html` reference. `parity:images` asserts every legacy-referenced image exists in the build. Both run **before the S3 sync**, so a failure blocks the deploy, not merely the merge.

A full copy rewrite and a new design fail both by design, on the first commit. At that point they are not catching a regression; they are asserting the site still matches the template being deliberately replaced.

These gates existed to protect the Astro migration, which cut over on 2026-09-21 and soaked through 2026-09-24. `CLAUDE.md` already records that the legacy corpus is kept "as the reference corpus for the parity gates" and that it "goes away once the cutover has soaked."

**The first slice of this work retires them:** delete the root-level `*.html`, `css/`, `js/`, `img/` and `sitemap.xml`; remove both gates from `ci.yml`, `deploy-staging.yml` and `deploy-prod.yml`; delete `scripts/parity-*`; update `CLAUDE.md`.

**`public/img/` is not legacy and stays.** It is served, and the nav logo and locale flags live in `public/img/nav/`. Only the root-level `img/` is removed. This distinction is the single easiest thing to get wrong in this slice.

Retained gates, which carry the risk from here: `test:unit`, `npx astro check`, `check:links:ci`, and the Playwright e2e suite, extended to cover the new interactive pieces rather than merely reselected.

---

## 9. Staging review loop

`deploy-staging.yml` currently triggers only on push to `master`, so a branch cannot reach staging without merging to trunk.

The redesign branch is added to the `deploy-staging.yml` push trigger, so every push to it deploys staging automatically and review can happen continuously.

Two consequences to hold in mind:

1. **`master` and the redesign branch then share one staging bucket.** Last push wins. If someone pushes `master` mid-review, staging changes under the reviewer.
2. **The branch must be removed from the trigger** when the work merges, or it keeps deploying staging from a dead branch.

Production remains manual (`gh workflow run "Deploy Production"`) and is not touched until the review signs off.

---

## 10. Risks

| Risk | Handling |
|---|---|
| Fontsource may not serve the Greek subset from the variable package by default | Verify Greek renders from the self-hosted files before the foundation slice merges. If it does not, commit the woff2 files directly. This fails silently, so it needs an explicit check, not an assumption. |
| Playwright selectors break wholesale | Expected. Tests are rewritten alongside each slice, not retrofitted at the end. |
| Deleting the legacy corpus removes something still referenced | `check:links:ci` and the build both run in the same slice; `public/img/` is explicitly retained. |
| The location page looks thinner than the others | Accepted and designed for. The alternative is upscaling 600px images into a hero, which looks worse. |
| A half-redesigned staging confuses reviewers | Each slice is a coherent unit; the review brief says which pages are done. |

---

## 11. Sequencing

Each slice merges to the redesign branch and lands on staging for review.

1. **Foundation:** retire parity gates and the legacy corpus; add the branch to the staging trigger; `tokens.css`, `base.css`, `layout.css`, `motion.css`; self-hosted fonts with the Greek check; `Icon.astro` and Font Awesome removal; `Section`, `Hero`, `SplitFeature`, `FactGrid`; the three scripts; restyled `Navbar` and `Footer`.
2. **Home**, including the copy rewrite for it and the metadata move.
3. **Kimon and Irida**, via `ResortPage`.
4. **Location.**
5. **Contact**, styling only.
6. **Polish:** performance pass, reduced-motion audit, cross-browser check, Lighthouse.

---

## 12. Open questions

1. **Which phone number is correct?** Owner confirming. Defaulted as described in section 7; a one-line change when answered.
2. **Does the okairos weather widget survive review?** Kept and contained for now; revisited if it cannot be made to sit well.

# Astro Pages & Interactivity — Implementation Plan (Phase 1, Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the remaining four pages (Kimon, Irida, Location, Contact) onto the Astro stack built in Plan 1, including the photo gallery and the contact form, with no jQuery.

**Architecture:** Reuse Plan 1's `BaseLayout`, chrome components, i18n layer, and Footer (with `mapFocus`). Add a reusable `Gallery.astro` island (PhotoSwipe v5, the current jQuery-free version) and a `ContactForm.astro` island (native/vanilla validation + reCAPTCHA + `fetch` to the existing API Gateway Lambda). Gallery images move into `src/assets/` so Astro's image pipeline optimizes them. Each page is a per-locale route under `src/pages/[lang]/`.

**Tech Stack:** Astro 4, TypeScript, `photoswipe@^5` (npm, no jQuery), Leaflet (already installed), Playwright. No jQuery, no jquery-validation, no Bootstrap JS.

## Global Constraints

- Fully static output; two locales `en` (default) + `gr`; per-locale URLs `/en/<page>`, `/gr/<page>`.
- Lift-and-shift: all visible text + images preserved; translation VALUES copied VERBATIM from the legacy `js/custom/lang/*.js` (no copy changes, no whitespace trimming, no typo fixes).
- No jQuery, no jquery-validation, no Bootstrap JS, no tether anywhere in shipped output.
- Keep GA4 id `G-7PRPXQ745M`, okairos weather, Leaflet/OSM maps, the okairos/Facebook/Instagram links, JSON-LD Organization block (all already in Plan 1 components).
- reCAPTCHA site key `6LcglLUUAAAAAF_UyVCnbs1Jv4aLFlrDigWo0Y28`; contact form posts to the existing API Gateway endpoints (same request shape as the legacy `sendEmail`/`checkRecaptcha` in `js/custom/app.js`).
- Contact validation rules (from legacy): name required + minlength 3; email required + valid email; subject required + minlength 5; message required + minlength 10. Error messages are the localized strings in the `contact.form.errorMessages` i18n block.
- Per-page hero background container classes (lift-and-shift, styled by `templatemo-style.css`): kimon `tm-kimon-img-container`, irida `tm-irida-img-container`, location `tm-location-img-container`, contact `tm-contact-img-container`.
- Site origin `https://www.marinos-aparts.gr`. Node 18+. Import local TS modules WITHOUT file extension; `.astro` imports keep the extension; JSON imported without an import assertion.

---

## Interfaces from Plan 1 (consumed here, do not recreate)

- `src/i18n/locales` → `LOCALES`, `type Locale`, `DEFAULT_LOCALE`, `isLocale`, `getStaticLocalePaths`.
- `src/i18n/t` → `t(locale): Strings`. `Strings` is `typeof en.json`; extending the JSON in Task 1 widens this type for all consumers.
- `src/layouts/BaseLayout.astro` → props `{ lang, title, description, canonicalPath }`, default `<slot/>`.
- `src/components/Navbar.astro` → props `{ lang, canonicalPath }` (Task 2 adds `current`).
- `src/components/HeaderBottom.astro` → props `{ lang }`.
- `src/components/Footer.astro` → props `{ lang, mapFocus? }` where `mapFocus?: 'kimon' | 'irida'`.
- Home route pattern: `src/pages/[lang]/index.astro` with `getStaticPaths = getStaticLocalePaths`, `lang` validated via `isLocale` → `DEFAULT_LOCALE` fallback.

---

## File Structure

```
src/i18n/en.json, gr.json        # MODIFY: add facilities, kimon, irida, location, contact blocks
src/components/Navbar.astro       # MODIFY: add `current` prop → active nav item
src/components/Gallery.astro      # NEW: PhotoSwipe v5 island (thumbs + lightbox), optional captions
src/components/ContactForm.astro  # NEW: form + vanilla validation + reCAPTCHA + fetch island
src/config.ts                     # NEW: API_ENDPOINTS (contact, recaptcha) + RECAPTCHA_SITE_KEY
src/assets/kimon/                 # NEW: kimon1..20.jpg (moved from public/img/kimon, except kimon-home.jpg)
src/assets/irida/                 # NEW: irida1..15.jpg
src/assets/beaches/               # NEW: 12 beach jpgs
src/pages/[lang]/kimon.astro      # NEW
src/pages/[lang]/irida.astro      # NEW
src/pages/[lang]/location.astro   # NEW
src/pages/[lang]/contact.astro    # NEW
src/pages/[lang]/index.astro      # MODIFY: pass current="home" to Navbar
package.json                      # MODIFY: add photoswipe; rework check:links (Task 8)
tests/*.spec.ts                   # NEW per page + gallery + form
```

Gallery images are MOVED (not copied) from `public/img/{kimon,irida,beaches}` into `src/assets/...` so there is a single source of truth and Astro optimizes them. `public/img/kimon/kimon-home.jpg` and `public/img/irida/irida-home.jpg` STAY in public (Plan 1's home page already copied those two into `src/assets/`; the home page does not use the numbered gallery images). `img/nav/*` and any CSS-referenced backgrounds stay in `public/`.

---

## Task 1: i18n data for the four pages

**Files:**
- Modify: `src/i18n/en.json`, `src/i18n/gr.json`
- Test: `src/i18n/pages.test.ts`

**Interfaces:**
- Produces (new top-level keys in each locale JSON, consumed by later tasks via `t(lang)`):
  - `facilities`: `{ spaciousRooms, kitchen, fridge, parking, airCondition, safe, yard, hotWater, largeClosets, tv, iron, balcony, tableChairs, hairDryer, screens, wifi }` (16 strings)
  - `kimon`: `{ title, main, facilitiesTitle, gallery }`
  - `irida`: `{ title, main, facilitiesTitle, gallery }`
  - `location`: `{ title, main, beachTitle, beaches: { agiaParaskevi, zeri, zavia, dei, megaNtrafi, mpelaVraka, gallikosMolos, megaAmmos, mikriAmmos, pisina, karavostasi, arrilas }, galleryDescriptions: { <same 12 keys> } }`
  - `contact`: `{ title, main, submit, contactErrorMessage, contactSuccessMessage, captchaErrorMessage, form: { required, validEmail, minlength3, minlength5, minlength10 } }`

**Source of truth (copy values VERBATIM):**
- `facilities` → `js/custom/lang/facilities_lang.js` (`en`/`gr`). Use only the 16 keys listed above (omit `builtInClosets`, which no page renders).
- `kimon`/`irida`/`location`/`contact` EN → `js/custom/lang/app_lang.js` lines ~35–170 (the `en.pages.*` blocks). `facilities_title`→`facilitiesTitle`. Join the `+`-concatenated strings into single values, preserving every space/character.
- GR → `app_lang.js` lines ~201–345 (the `gr.pages.*` blocks).
- `location.galleryDescriptions.*` are HTML strings (contain `<h5>…</h5>`); copy including the tags. Note the GR descriptions contain runs of internal spaces from the legacy source indentation — copy them EXACTLY as they appear (the parity gate in Plan 3 will diff against the live site).

- [ ] **Step 1: Write the failing test**

Create `src/i18n/pages.test.ts`:

```ts
import { test, expect } from 'vitest';
import { t } from './t';
import { LOCALES } from './locales';

const FACILITY_KEYS = ['spaciousRooms','kitchen','fridge','parking','airCondition','safe','yard','hotWater','largeClosets','tv','iron','balcony','tableChairs','hairDryer','screens','wifi'];
const BEACH_KEYS = ['agiaParaskevi','zeri','zavia','dei','megaNtrafi','mpelaVraka','gallikosMolos','megaAmmos','mikriAmmos','pisina','karavostasi','arrilas'];

test('every locale has all page blocks with matching key sets', () => {
  for (const lang of LOCALES) {
    const s = t(lang);
    expect(Object.keys(s.facilities).sort()).toEqual([...FACILITY_KEYS].sort());
    for (const page of ['kimon','irida'] as const) {
      expect(typeof s[page].title).toBe('string');
      expect(typeof s[page].main).toBe('string');
      expect(typeof s[page].facilitiesTitle).toBe('string');
      expect(typeof s[page].gallery).toBe('string');
    }
    expect(Object.keys(s.location.beaches).sort()).toEqual([...BEACH_KEYS].sort());
    expect(Object.keys(s.location.galleryDescriptions).sort()).toEqual([...BEACH_KEYS].sort());
    expect(typeof s.contact.form.required).toBe('string');
    expect(typeof s.contact.form.minlength10).toBe('string');
    expect(typeof s.contact.submit).toBe('string');
  }
});

test('known verbatim values are present per locale', () => {
  expect(t('en').kimon.title).toBe('Kimon Resort');
  expect(t('en').contact.submit).toBe('Submit');
  expect(t('gr').contact.submit).toBe('Αποστολή');
  expect(t('en').facilities.wifi).toBe('Free wi-fi Internet');
  expect(t('gr').location.beachTitle).toBe('Παραλίες');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:unit -- src/i18n/pages.test.ts`
Expected: FAIL — new keys not present yet (`Cannot read properties of undefined` / key-set mismatch).

- [ ] **Step 3: Add the blocks to `en.json`**

Add `facilities`, `kimon`, `irida`, `location`, `contact` as new top-level keys (siblings of the existing `nav`/`header`/`footer`/`home`), with values copied verbatim from the EN sources cited above. Example shape (values abbreviated here — use the full verbatim strings):

```json
{
  "facilities": {
    "spaciousRooms": "Spacious rooms",
    "kitchen": "Fully equipped kitchen",
    "fridge": "Refrigerator and kitchenette",
    "parking": "Private parking with cover",
    "airCondition": "Αir-Condition",
    "safe": "Safe",
    "yard": "Big yard",
    "hotWater": "24h hot water (solar water heater & boiler)",
    "largeClosets": "Large closets",
    "tv": "Plasma TV",
    "iron": "Iron and ironing board",
    "balcony": "Private balcony",
    "tableChairs": "Outdoor table and chairs",
    "hairDryer": "Hair dryer",
    "screens": "Screens in the windows",
    "wifi": "Free wi-fi Internet"
  },
  "kimon": { "title": "Kimon Resort", "main": "Completely renovated, Kimon Resort ...", "facilitiesTitle": "Facilities", "gallery": "Gallery" },
  "irida": { "title": "Irida Resort", "main": "Irida Resort is completely renovated ...", "facilitiesTitle": "Facilities", "gallery": "Gallery" },
  "location": {
    "title": "Sivota",
    "main": "Sivota is a special destination ...",
    "beachTitle": "Beaches",
    "beaches": { "agiaParaskevi": "Agia Paraskevi", "zeri": "Zeri", "zavia": "Zavia", "dei": "Dei", "megaNtrafi": "Mega Ntrafi", "mpelaVraka": "Mpela Vraka", "gallikosMolos": "Gallikos Molos", "megaAmmos": "Mega Ammos", "mikriAmmos": "Mikri Ammos", "pisina": "Pisina", "karavostasi": "Karavostasi", "arrilas": "Arrilas" },
    "galleryDescriptions": { "agiaParaskevi": "<h5>Agia Paraskevi</h5>It is next to Mega Trafos beach ...", "...": "..." }
  },
  "contact": {
    "title": "Contact Form",
    "main": "Check for availability. We will contact you as soon as possible.",
    "submit": "Submit",
    "contactErrorMessage": "Unable to send",
    "contactSuccessMessage": "Thanks for contacting us",
    "captchaErrorMessage": "Captcha field is required",
    "form": { "required": "This field is required", "validEmail": "Please enter a valid email address", "minlength3": "Please enter at least 3 characters", "minlength5": "Please enter at least 5 characters", "minlength10": "Please enter at least 10 characters" }
  }
}
```

- [ ] **Step 4: Add the same blocks to `gr.json`** with the Greek verbatim values from the `gr.pages.*` sources. Same key structure; every key present in `en.json` must exist in `gr.json`.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- src/i18n/pages.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add src/i18n/en.json src/i18n/gr.json src/i18n/pages.test.ts
git commit -m "feat: add i18n data for kimon, irida, location, contact pages"
```

---

## Task 2: Navbar dynamic active state

**Files:**
- Modify: `src/components/Navbar.astro`, `src/pages/[lang]/index.astro`
- Test: append to `tests/home.spec.ts`

**Interfaces:**
- Consumes: `Locale`, `t`.
- Produces: `Navbar` gains prop `current?: 'home' | 'kimon' | 'irida' | 'location' | 'contact'`. The matching `<li class="nav-item">` gets the `active` class; others do not. Default `current` undefined → no item active.

- [ ] **Step 1: Write the failing test**

Append to `tests/home.spec.ts`:

```ts
test('home nav item is active on the home page', async ({ page }) => {
  await page.goto('/en/');
  const items = page.locator('.tm-main-nav li.nav-item');
  await expect(items.filter({ hasText: 'Home' })).toHaveClass(/active/);
  await expect(items.filter({ hasText: 'Kimon Resort' })).not.toHaveClass(/active/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/home.spec.ts -g "home nav item is active"`
Expected: FAIL — `index.astro` does not pass `current`, and Navbar hardcodes `active` on home (so the negative assertion on Kimon passes but the test as a whole proves nothing until wired; it will fail because home currently is hardcoded active AND there is no `current` logic — verify it fails before implementing).

- [ ] **Step 3: Update `Navbar.astro`**

Change the Props interface and the nav items so `active` is conditional. Full updated component:

```astro
---
import type { Locale } from '../i18n/locales';
import { t } from '../i18n/t';
import LangSwitcher from './LangSwitcher.astro';

type NavKey = 'home' | 'kimon' | 'irida' | 'location' | 'contact';
interface Props { lang: Locale; canonicalPath: string; current?: NavKey; }
const { lang, canonicalPath, current } = Astro.props;
const s = t(lang);
const base = `/${lang}`;
const active = (key: NavKey) => (current === key ? 'nav-item active' : 'nav-item');
---

<div class="tm-header">
  <div class="container-fluid">
    <div class="tm-header-inner">
      <a href={`${base}/`} class="navbar-left tm-site-logo"><img src="/img/nav/logo_marinos.png" alt="Marinos-Aparts" /></a>
      <nav class="navbar tm-main-nav">
        <button class="navbar-toggler hidden-md-up" type="button" data-toggle="collapse" data-target="#tmNavbar">&#9776;</button>
        <div class="collapse navbar-toggleable-sm" id="tmNavbar">
          <ul class="nav navbar-nav">
            <li class={active('home')}><a href={`${base}/`} class="nav-link">{s.nav.home}</a></li>
            <li class={active('kimon')}><a href={`${base}/kimon`} class="nav-link">{s.nav.kimon}</a></li>
            <li class={active('irida')}><a href={`${base}/irida`} class="nav-link">{s.nav.irida}</a></li>
            <li class="nav-item"><a href="https://reservations.bookoncloud.com/welcome/kimon" target="_blank" rel="noopener" class="nav-link">{s.nav.book}</a></li>
            <li class={active('location')}><a href={`${base}/location`} class="nav-link">{s.nav.location}</a></li>
            <li class={active('contact')}><a href={`${base}/contact`} class="nav-link">{s.nav.contact}</a></li>
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

(Note: `rel="noopener"` added to the external book link, addressing a Plan 1 review nit. The `hide-lang-menu` mobile parity for the `.languagepicker` ul remains a Plan 3 parity-gate decision — do not change it here.)

- [ ] **Step 4: Pass `current="home"` from the home page**

In `src/pages/[lang]/index.astro`, change the `<Navbar ... />` usage to include `current="home"`:

```astro
<Navbar lang={lang} canonicalPath="" current="home" />
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/home.spec.ts -g "home nav item is active"`
Expected: PASS. Also run the full home suite to confirm no regression: `npx playwright test tests/home.spec.ts` → all PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.astro "src/pages/[lang]/index.astro" tests/home.spec.ts
git commit -m "feat: dynamic active nav state via Navbar current prop"
```

---

## Task 3: Gallery component (PhotoSwipe v5 island)

**Files:**
- Modify: `package.json` (add `photoswipe`)
- Create: `src/components/Gallery.astro`
- Test: exercised by the Kimon page tests in Task 4 (a gallery cannot render standalone without a page/locale). This task's gate is `npx astro check` + `npm run build` succeeding with a temporary smoke import — see Step 4.

**Interfaces:**
- Consumes: `astro:assets` `Image`, `ImageMetadata`.
- Produces: `Gallery.astro` with props:
  ```ts
  interface GalleryItem {
    thumb: ImageMetadata;   // imported image for the optimized thumbnail
    full: ImageMetadata;    // imported image for the full-size lightbox source (often same as thumb)
    alt: string;
    heading?: string;       // optional <h4> shown above the thumbnail (location/beaches)
    caption?: string;       // optional HTML caption shown in the lightbox
  }
  interface Props { items: GalleryItem[]; figureClass: string; }
  ```
  Renders a `#gallery.gallery` wrapper of `<figure class={figureClass}>` elements (each: optional `<h4>`, then `<a data-pswp-width data-pswp-height [data-pswp-caption]><Image/></a>`), and a bundled `<script>` that initializes a PhotoSwipe v5 `PhotoSwipeLightbox` bound to `#gallery`, with a caption UI element reading `data-pswp-caption`.

- [ ] **Step 1: Add PhotoSwipe to `package.json`**

Add to `dependencies`: `"photoswipe": "^5.4.4"`. Then run `npm install`.

- [ ] **Step 2: Create `src/components/Gallery.astro`**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

export interface GalleryItem {
  thumb: ImageMetadata;
  full: ImageMetadata;
  alt: string;
  heading?: string;
  caption?: string;
}
interface Props { items: GalleryItem[]; figureClass: string; }
const { items, figureClass } = Astro.props;
---

<div id="gallery" class="gallery">
  {items.map((item) => (
    <figure class={figureClass} itemprop="associatedMedia">
      {item.heading && <h4 class="tm-margin-b-20 tm-gold-text" set:html={item.heading} />}
      <a
        href={item.full.src}
        data-pswp-width={item.full.width}
        data-pswp-height={item.full.height}
        data-pswp-caption={item.caption ?? ''}
        itemprop="contentUrl"
      >
        <Image src={item.thumb} alt={item.alt} width={250} height={165} itemprop="thumbnail" />
      </a>
    </figure>
  ))}
</div>

<link rel="stylesheet" href="https://unpkg.com/photoswipe@5.4.4/dist/photoswipe.css" />

<script>
  import PhotoSwipeLightbox from 'photoswipe/lightbox';

  const el = document.querySelector('#gallery');
  if (el) {
    const lightbox = new PhotoSwipeLightbox({
      gallery: '#gallery',
      children: 'a',
      pswpModule: () => import('photoswipe'),
      bgOpacity: 0.85,
    });

    // Render the per-slide HTML caption from data-pswp-caption.
    lightbox.on('uiRegister', () => {
      lightbox.pswp.ui.registerElement({
        name: 'custom-caption',
        order: 9,
        isButton: false,
        appendTo: 'root',
        html: '',
        onInit: (elm, pswp) => {
          pswp.on('change', () => {
            const a = pswp.currSlide?.data?.element as HTMLElement | undefined;
            const caption = a?.getAttribute('data-pswp-caption') ?? '';
            elm.innerHTML = caption;
            elm.style.display = caption ? 'block' : 'none';
          });
        },
      });
    });

    lightbox.init();
  }
</script>

<style is:global>
  .pswp__custom-caption,
  .pswp .custom-caption { /* caption styling handled by photoswipe defaults; container positioned bottom */ }
</style>
```

Notes for the implementer:
- PhotoSwipe v5 has NO jQuery dependency and needs NO static `.pswp` markup (unlike the legacy v4). The v4 `.pswp` block is intentionally dropped.
- `item.full.src` / `.width` / `.height` come from the imported `ImageMetadata` — Astro emits the full image and reports its intrinsic dimensions, which PhotoSwipe v5 requires via `data-pswp-width/height`.
- The CSS is loaded from CDN to keep this task small; it can be localized later. The legacy v4 `photoswipe.css`/`default-skin.css` imports are removed from pages that no longer need them in Task 8.

- [ ] **Step 3: Type-check**

Run: `npx astro check`
Expected: no type errors in `Gallery.astro`.

- [ ] **Step 4: Build smoke (temporary)**

Because the gallery needs a consuming page to render, verify it compiles by building the project (the home page still builds; the new component is only type-checked until Task 4 imports it):

Run: `npm run build`
Expected: build succeeds (exit 0). No new page yet — the gallery is consumed in Task 4.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json src/components/Gallery.astro
git commit -m "feat: add reusable PhotoSwipe v5 Gallery island"
```

---

## Task 4: Kimon page

**Files:**
- Move: `public/img/kimon/kimon1.jpg`..`kimon20.jpg` → `src/assets/kimon/` (NOT `kimon-home.jpg`)
- Create: `src/pages/[lang]/kimon.astro`
- Test: `tests/kimon.spec.ts`

**Interfaces:**
- Consumes: `BaseLayout`, `Navbar` (with `current="kimon"`), `HeaderBottom`, `Footer` (with `mapFocus="kimon"`), `Gallery`, `t`, locale helpers, and a glob import of `src/assets/kimon/*.jpg`.
- Produces: static pages `/en/kimon`, `/gr/kimon`. `canonicalPath="/kimon"`.

- [ ] **Step 1: Move the kimon gallery images**

```bash
mkdir -p src/assets/kimon
git mv public/img/kimon/kimon1.jpg public/img/kimon/kimon2.jpg public/img/kimon/kimon3.jpg public/img/kimon/kimon4.jpg public/img/kimon/kimon5.jpg public/img/kimon/kimon6.jpg public/img/kimon/kimon7.jpg public/img/kimon/kimon8.jpg public/img/kimon/kimon9.jpg public/img/kimon/kimon10.jpg public/img/kimon/kimon11.jpg public/img/kimon/kimon12.jpg public/img/kimon/kimon13.jpg public/img/kimon/kimon14.jpg public/img/kimon/kimon15.jpg public/img/kimon/kimon16.jpg public/img/kimon/kimon17.jpg public/img/kimon/kimon18.jpg public/img/kimon/kimon19.jpg public/img/kimon/kimon20.jpg src/assets/kimon/
```

(Leave `public/img/kimon/kimon-home.jpg` in place.)

- [ ] **Step 2: Write the failing test**

Create `tests/kimon.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('english kimon renders title, facilities, and gallery', async ({ page }) => {
  await page.goto('/en/kimon');
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Kimon Resort' }).first()).toBeVisible();
  await expect(page.getByText('Free wi-fi Internet')).toBeVisible();           // a facility
  await expect(page.locator('#gallery figure')).toHaveCount(20);               // 20 kimon images
  await expect(page.locator('.tm-main-nav li.nav-item').filter({ hasText: 'Kimon Resort' })).toHaveClass(/active/);
});

test('greek kimon renders translated facilities', async ({ page }) => {
  await page.goto('/gr/kimon');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Δωρεάν wi-fi Internet')).toBeVisible();
});

test('kimon gallery opens PhotoSwipe on click', async ({ page }) => {
  await page.goto('/en/kimon');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();                            // v5 injects .pswp on open
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test tests/kimon.spec.ts`
Expected: FAIL — `/en/kimon` route does not exist (404 / timeout).

- [ ] **Step 4: Create `src/pages/[lang]/kimon.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Navbar from '../../components/Navbar.astro';
import HeaderBottom from '../../components/HeaderBottom.astro';
import Footer from '../../components/Footer.astro';
import Gallery, { type GalleryItem } from '../../components/Gallery.astro';
import { getStaticLocalePaths, isLocale, DEFAULT_LOCALE } from '../../i18n/locales';
import { t } from '../../i18n/t';
import type { ImageMetadata } from 'astro';

export function getStaticPaths() { return getStaticLocalePaths(); }

const langParam = Astro.params.lang;
const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;
const s = t(lang);

// Import all kimon gallery images, sorted by numeric suffix (kimon1..kimon20).
const modules = import.meta.glob<{ default: ImageMetadata }>('../../assets/kimon/*.jpg', { eager: true });
const images = Object.entries(modules)
  .sort((a, b) => {
    const n = (p: string) => parseInt(p.match(/kimon(\d+)\.jpg$/)![1], 10);
    return n(a[0]) - n(b[0]);
  })
  .map(([, m]) => m.default);

const items: GalleryItem[] = images.map((img) => ({ thumb: img, full: img, alt: 'Kimon Resort' }));

const facilityKeys = Object.keys(s.facilities) as (keyof typeof s.facilities)[];
const col1 = facilityKeys.slice(0, 8);
const col2 = facilityKeys.slice(8);

const title = 'Kimon Resort | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα';
const description = 'Completely renovated in 2015, KIMON RESORT is set in an idyllic location, surrounded by olive groves, offering tranquility and beauty to holidaymakers';
---

<BaseLayout lang={lang} title={title} description={description} canonicalPath="/kimon">
  <Navbar lang={lang} canonicalPath="/kimon" current="kimon" />
  <div class="tm-kimon-img-container"></div>
  <HeaderBottom lang={lang} />

  <section class="tm-section">
    <div class="container-fluid">
      <div class="row">
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">
          <div class="tm-2-col-left text-xs-center">
            <h2 class="tm-gold-text tm-title">{s.kimon.title}</h2>
            <p>{s.kimon.main}</p>
          </div>
        </div>
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">
          <h2 class="tm-gold-text tm-title text-xs-center">{s.kimon.facilitiesTitle}</h2>
          <div class="col-sm-6 col-md-6 col-lg-6 col-xl-7">
            <div class="facilities"><ul>{col1.map((k) => <li>{s.facilities[k]}</li>)}</ul></div>
          </div>
          <div class="col-sm-6 col-md-6 col-lg-6 col-xl-5">
            <div class="facilities"><ul>{col2.map((k) => <li>{s.facilities[k]}</li>)}</ul></div>
          </div>
        </div>
      </div>
      <div class="row tm-margin-t-mid">
        <h2 class="tm-gold-text tm-title text-xs-center">{s.kimon.gallery}</h2>
        <Gallery items={items} figureClass="kimon" />
      </div>
    </div>
  </section>

  <Footer lang={lang} mapFocus="kimon" />
</BaseLayout>
```

Important: the facilities split (col1 = first 8 keys, col2 = next 8) must reproduce the legacy two-column order. The i18n `facilities` object key insertion order (Task 1) MUST be: `spaciousRooms, kitchen, fridge, airCondition, largeClosets, parking, tableChairs, hotWater` (col1), then `wifi, hairDryer, balcony, screens, iron, yard, tv, safe` (col2) — matching `kimon.html` lines 154–175. Order the keys in `en.json`/`gr.json` accordingly so `Object.keys` yields this order.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test tests/kimon.spec.ts`
Expected: PASS (all three).

- [ ] **Step 6: Commit**

```bash
git add src/assets/kimon "src/pages/[lang]/kimon.astro" tests/kimon.spec.ts public/img/kimon
git commit -m "feat: add bilingual Kimon page with optimized gallery"
```

---

## Task 5: Irida page

**Files:**
- Move: `public/img/irida/irida1.jpg`..`irida15.jpg` → `src/assets/irida/` (NOT `irida-home.jpg`)
- Create: `src/pages/[lang]/irida.astro`
- Test: `tests/irida.spec.ts`

**Interfaces:**
- Consumes: same as Kimon, with `current="irida"`, `mapFocus="irida"`, glob of `src/assets/irida/*.jpg`, `canonicalPath="/irida"`, `s.irida.*`. Irida uses the SAME 16-facility block as Kimon (verify against `irida.html`).

- [ ] **Step 1: Move the irida gallery images**

```bash
mkdir -p src/assets/irida
git mv public/img/irida/irida1.jpg public/img/irida/irida2.jpg public/img/irida/irida3.jpg public/img/irida/irida4.jpg public/img/irida/irida5.jpg public/img/irida/irida6.jpg public/img/irida/irida7.jpg public/img/irida/irida8.jpg public/img/irida/irida9.jpg public/img/irida/irida10.jpg public/img/irida/irida11.jpg public/img/irida/irida12.jpg public/img/irida/irida13.jpg public/img/irida/irida14.jpg public/img/irida/irida15.jpg src/assets/irida/
```

- [ ] **Step 2: Write the failing test**

Create `tests/irida.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('english irida renders title, facilities, and 15-image gallery', async ({ page }) => {
  await page.goto('/en/irida');
  await expect(page.getByRole('heading', { name: 'Irida Resort' }).first()).toBeVisible();
  await expect(page.getByText('Free wi-fi Internet')).toBeVisible();
  await expect(page.locator('#gallery figure')).toHaveCount(15);
  await expect(page.locator('.tm-main-nav li.nav-item').filter({ hasText: 'Irida Resort' })).toHaveClass(/active/);
});

test('greek irida sets lang and translated main', async ({ page }) => {
  await page.goto('/gr/irida');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.getByText('Παροχές')).toBeVisible();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test tests/irida.spec.ts`
Expected: FAIL — route missing.

- [ ] **Step 4: Create `src/pages/[lang]/irida.astro`**

Identical structure to `kimon.astro` with these substitutions: glob `'../../assets/irida/*.jpg'` and regex `/irida(\d+)\.jpg$/`; `alt: 'Irida Resort'`; `figureClass="irida"`; `current="irida"`; `mapFocus="irida"`; `canonicalPath="/irida"`; all `s.kimon.*` → `s.irida.*`; hero `class="tm-irida-img-container"`; `title = 'Irida Resort | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα'`; `description = 'Irida Resort is completely renovated and ideally located in the center of the village.'`. Full file:

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Navbar from '../../components/Navbar.astro';
import HeaderBottom from '../../components/HeaderBottom.astro';
import Footer from '../../components/Footer.astro';
import Gallery, { type GalleryItem } from '../../components/Gallery.astro';
import { getStaticLocalePaths, isLocale, DEFAULT_LOCALE } from '../../i18n/locales';
import { t } from '../../i18n/t';
import type { ImageMetadata } from 'astro';

export function getStaticPaths() { return getStaticLocalePaths(); }

const langParam = Astro.params.lang;
const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;
const s = t(lang);

const modules = import.meta.glob<{ default: ImageMetadata }>('../../assets/irida/*.jpg', { eager: true });
const images = Object.entries(modules)
  .sort((a, b) => {
    const n = (p: string) => parseInt(p.match(/irida(\d+)\.jpg$/)![1], 10);
    return n(a[0]) - n(b[0]);
  })
  .map(([, m]) => m.default);

const items: GalleryItem[] = images.map((img) => ({ thumb: img, full: img, alt: 'Irida Resort' }));

const facilityKeys = Object.keys(s.facilities) as (keyof typeof s.facilities)[];
const col1 = facilityKeys.slice(0, 8);
const col2 = facilityKeys.slice(8);

const title = 'Irida Resort | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα';
const description = 'Irida Resort is completely renovated and ideally located in the center of the village.';
---

<BaseLayout lang={lang} title={title} description={description} canonicalPath="/irida">
  <Navbar lang={lang} canonicalPath="/irida" current="irida" />
  <div class="tm-irida-img-container"></div>
  <HeaderBottom lang={lang} />

  <section class="tm-section">
    <div class="container-fluid">
      <div class="row">
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">
          <div class="tm-2-col-left text-xs-center">
            <h2 class="tm-gold-text tm-title">{s.irida.title}</h2>
            <p>{s.irida.main}</p>
          </div>
        </div>
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-6 col-xl-6">
          <h2 class="tm-gold-text tm-title text-xs-center">{s.irida.facilitiesTitle}</h2>
          <div class="col-sm-6 col-md-6 col-lg-6 col-xl-7">
            <div class="facilities"><ul>{col1.map((k) => <li>{s.facilities[k]}</li>)}</ul></div>
          </div>
          <div class="col-sm-6 col-md-6 col-lg-6 col-xl-5">
            <div class="facilities"><ul>{col2.map((k) => <li>{s.facilities[k]}</li>)}</ul></div>
          </div>
        </div>
      </div>
      <div class="row tm-margin-t-mid">
        <h2 class="tm-gold-text tm-title text-xs-center">{s.irida.gallery}</h2>
        <Gallery items={items} figureClass="irida" />
      </div>
    </div>
  </section>

  <Footer lang={lang} mapFocus="irida" />
</BaseLayout>
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test tests/irida.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/assets/irida "src/pages/[lang]/irida.astro" tests/irida.spec.ts public/img/irida
git commit -m "feat: add bilingual Irida page with optimized gallery"
```

---

## Task 6: Location page (beaches gallery with captions)

**Files:**
- Move: the 12 beach jpgs `public/img/beaches/*` → `src/assets/beaches/`
- Create: `src/pages/[lang]/location.astro`
- Test: `tests/location.spec.ts`

**Interfaces:**
- Consumes: chrome + `Gallery` (with `heading` + `caption` per item), `s.location.*`, glob of `src/assets/beaches/*.jpg`. `current="location"`, `canonicalPath="/location"`, default footer map (no `mapFocus` → both pins).

The 12 beaches map filename → i18n key:
`agia_paraskevi`→`agiaParaskevi`, `zeri`→`zeri`, `zavia`→`zavia`, `dei`→`dei`, `mega_ntrafo`→`megaNtrafi`, `mpela_vraka`→`mpelaVraka`, `gallikos`→`gallikosMolos`, `mega_ammos`→`megaAmmos`, `mikri_ammos`→`mikriAmmos`, `pisina`→`pisina`, `karavostasi`→`karavostasi`, `arillas`→`arrilas`. Order must match `location.html` (agiaParaskevi, zeri, zavia, dei, megaNtrafi, mpelaVraka, gallikosMolos, megaAmmos, mikriAmmos, pisina, karavostasi, arrilas).

- [ ] **Step 1: Move the beach images**

```bash
mkdir -p src/assets/beaches
git mv public/img/beaches/agia_paraskevi.jpg public/img/beaches/zeri.jpg public/img/beaches/zavia.jpg public/img/beaches/dei.jpg public/img/beaches/mega_ntrafo.jpg public/img/beaches/mpela_vraka.jpg public/img/beaches/gallikos.jpg public/img/beaches/mega_ammos.jpg public/img/beaches/mikri_ammos.jpg public/img/beaches/pisina.jpg public/img/beaches/karavostasi.jpg public/img/beaches/arillas.jpg src/assets/beaches/
```

- [ ] **Step 2: Write the failing test**

Create `tests/location.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('english location renders beaches gallery with headings and captions', async ({ page }) => {
  await page.goto('/en/location');
  await expect(page.getByRole('heading', { name: 'Sivota' }).first()).toBeVisible();
  await expect(page.locator('#gallery figure')).toHaveCount(12);
  await expect(page.locator('#gallery h4').filter({ hasText: 'Agia Paraskevi' })).toBeVisible();
  // caption is carried on the anchor for the lightbox
  const first = page.locator('#gallery a').first();
  await expect(first).toHaveAttribute('data-pswp-caption', /Agia Paraskevi/);
});

test('greek location uses translated beach names', async ({ page }) => {
  await page.goto('/gr/location');
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');
  await expect(page.locator('#gallery h4').filter({ hasText: 'Αγία Παρασκευή' })).toBeVisible();
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test tests/location.spec.ts`
Expected: FAIL — route missing.

- [ ] **Step 4: Create `src/pages/[lang]/location.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Navbar from '../../components/Navbar.astro';
import HeaderBottom from '../../components/HeaderBottom.astro';
import Footer from '../../components/Footer.astro';
import Gallery, { type GalleryItem } from '../../components/Gallery.astro';
import { getStaticLocalePaths, isLocale, DEFAULT_LOCALE } from '../../i18n/locales';
import { t } from '../../i18n/t';
import type { ImageMetadata } from 'astro';

export function getStaticPaths() { return getStaticLocalePaths(); }

const langParam = Astro.params.lang;
const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;
const s = t(lang);

// filename stem -> i18n beach key, in display order
const BEACHES: { file: string; key: keyof typeof s.location.beaches }[] = [
  { file: 'agia_paraskevi', key: 'agiaParaskevi' },
  { file: 'zeri', key: 'zeri' },
  { file: 'zavia', key: 'zavia' },
  { file: 'dei', key: 'dei' },
  { file: 'mega_ntrafo', key: 'megaNtrafi' },
  { file: 'mpela_vraka', key: 'mpelaVraka' },
  { file: 'gallikos', key: 'gallikosMolos' },
  { file: 'mega_ammos', key: 'megaAmmos' },
  { file: 'mikri_ammos', key: 'mikriAmmos' },
  { file: 'pisina', key: 'pisina' },
  { file: 'karavostasi', key: 'karavostasi' },
  { file: 'arillas', key: 'arrilas' },
];

const modules = import.meta.glob<{ default: ImageMetadata }>('../../assets/beaches/*.jpg', { eager: true });
const byФile = (file: string) =>
  Object.entries(modules).find(([p]) => p.endsWith(`/${file}.jpg`))![1].default;

const items: GalleryItem[] = BEACHES.map(({ file, key }) => {
  const img = byФile(file);
  return {
    thumb: img,
    full: img,
    alt: s.location.beaches[key],
    heading: s.location.beaches[key],
    caption: s.location.galleryDescriptions[key],
  };
});

const title = 'Location | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα';
const description = 'Sivota is a special destination, as one of the most picturesque villages of Epirus';
---

<BaseLayout lang={lang} title={title} description={description} canonicalPath="/location">
  <Navbar lang={lang} canonicalPath="/location" current="location" />
  <div class="tm-location-img-container"></div>
  <HeaderBottom lang={lang} />

  <section class="tm-section">
    <div class="container-fluid">
      <div class="row">
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12 text-xs-center">
          <h2 class="tm-gold-text tm-title">{s.location.title}</h2>
          <p>{s.location.main}</p>
        </div>
      </div>
      <div class="row tm-margin-t-mid">
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12 text-xs-center">
          <h2 class="tm-gold-text tm-title">{s.location.beachTitle}</h2>
        </div>
        <Gallery items={items} figureClass="location" />
      </div>
    </div>
  </section>

  <Footer lang={lang} />
</BaseLayout>
```

Note: the helper is named `byФile` only to avoid shadowing — the implementer may rename to `byFile` (plain ASCII). Use a normal ASCII name `byFile`.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test tests/location.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/assets/beaches "src/pages/[lang]/location.astro" tests/location.spec.ts public/img/beaches
git commit -m "feat: add bilingual Location page with captioned beaches gallery"
```

---

## Task 7: Contact page + ContactForm island

**Files:**
- Create: `src/config.ts`, `src/components/ContactForm.astro`, `src/pages/[lang]/contact.astro`
- Test: `tests/contact.spec.ts`

**Interfaces:**
- Consumes: chrome, `t`. `ContactForm` props `{ lang: Locale }`. `src/config.ts` exports `API_ENDPOINTS` + `RECAPTCHA_SITE_KEY`.
- Produces: `/en/contact`, `/gr/contact`. `canonicalPath="/contact"`, no footer `mapFocus` (both pins).

- [ ] **Step 1: Create `src/config.ts`**

```ts
// Public API Gateway endpoints (same values as the legacy js/custom/config/config.js).
export const API_ENDPOINTS = {
  contact: 'https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/dev/contact',
  recaptcha: 'https://8vgfxd8lde.execute-api.eu-west-1.amazonaws.com/dev/validaterecaptcha',
} as const;

export const RECAPTCHA_SITE_KEY = '6LcglLUUAAAAAF_UyVCnbs1Jv4aLFlrDigWo0Y28';
```

- [ ] **Step 2: Write the failing test**

Create `tests/contact.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('contact form shows validation errors on empty submit', async ({ page }) => {
  await page.goto('/en/contact');
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('.field-error').first()).toContainText('This field is required');
});

test('contact form submits with valid input (network + recaptcha stubbed)', async ({ page }) => {
  // Stub grecaptcha so the captcha check passes.
  await page.addInitScript(() => {
    (window as any).grecaptcha = { getResponse: () => 'test-token', reset: () => {} };
  });
  // Mock the two API Gateway calls.
  await page.route('**/validaterecaptcha', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '"Success"' }) }));
  await page.route('**/contact', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));

  await page.goto('/en/contact');
  await page.fill('#contact_name', 'Jane Doe');
  await page.fill('#contact_email', 'jane@example.com');
  await page.fill('#contact_subject', 'Booking question');
  await page.fill('#contact_message', 'I would like to book a room for August.');
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#success_message')).toBeVisible();
});

test('greek contact page uses translated submit label', async ({ page }) => {
  await page.goto('/gr/contact');
  await expect(page.locator('#contact-form-submit')).toHaveText('Αποστολή');
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test tests/contact.spec.ts`
Expected: FAIL — route missing.

- [ ] **Step 4: Create `src/components/ContactForm.astro`**

Vanilla validation (replacing jquery-validation) + reCAPTCHA + `fetch` (replacing `$.post`/`$.ajax`), preserving the legacy flow and field rules.

```astro
---
import type { Locale } from '../i18n/locales';
import { t } from '../i18n/t';
import { API_ENDPOINTS, RECAPTCHA_SITE_KEY } from '../config';

interface Props { lang: Locale; }
const { lang } = Astro.props;
const s = t(lang);
const f = s.contact.form;
---

<div class="col-xs-12 col-sm-12 col-md-12 col-lg-8 col-xl-8 text-xs-center contact-form">
  <section>
    <h3 class="tm-gold-text tm-form-title">{s.contact.title}</h3>
    <p class="tm-form-description">{s.contact.main}</p>

    <form id="contact-form" method="post" class="tm-contact-form" novalidate>
      <div class="form-group">
        <input type="text" id="contact_name" name="contact_name" class="form-control" placeholder="Name" />
        <div class="field-error" data-for="contact_name" style="color:red;display:none"></div>
      </div>
      <div class="form-group">
        <input type="email" id="contact_email" name="contact_email" class="form-control" placeholder="Email" />
        <div class="field-error" data-for="contact_email" style="color:red;display:none"></div>
      </div>
      <div class="form-group">
        <input type="text" id="contact_subject" name="contact_subject" class="form-control" placeholder="Subject" />
        <div class="field-error" data-for="contact_subject" style="color:red;display:none"></div>
      </div>
      <div class="form-group">
        <textarea id="contact_message" name="contact_message" class="form-control" rows="6" placeholder="Message"></textarea>
        <div class="field-error" data-for="contact_message" style="color:red;display:none"></div>
      </div>

      <div class="contact-form-messages">
        <div id="generic-loader" class="text-center" style="display:none">Sending email... <i class="fa fa-spinner fa-spin"></i></div>
        <div id="error_message" style="display:none">{s.contact.contactErrorMessage}</div>
        <div id="success_message" style="display:none">{s.contact.contactSuccessMessage}</div>
        <div id="recaptcha_message" style="color:red;display:none">{s.contact.captchaErrorMessage}</div>
      </div>

      <button type="submit" id="contact-form-submit" class="tm-btn btn-block">{s.contact.submit}</button>
      <div class="g-recaptcha" data-sitekey={RECAPTCHA_SITE_KEY}></div>
    </form>
  </section>
</div>

<script
  define:vars={{
    endpoints: API_ENDPOINTS,
    messages: { required: f.required, validEmail: f.validEmail, minlength3: f.minlength3, minlength5: f.minlength5, minlength10: f.minlength10 },
  }}
>
  const form = document.getElementById('contact-form');
  if (form) {
    const $ = (id) => document.getElementById(id);
    const show = (id, on) => { const el = $(id); if (el) el.style.display = on ? 'block' : 'none'; };
    const flash = (id) => { show(id, true); setTimeout(() => show(id, false), 1500); };

    const setError = (name, msg) => {
      const box = document.querySelector(`.field-error[data-for="${name}"]`);
      if (box) { box.textContent = msg || ''; box.style.display = msg ? 'block' : 'none'; }
      return !msg;
    };

    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const validate = () => {
      const v = (id) => ($(id).value || '').trim();
      let ok = true;
      ok = setError('contact_name', !v('contact_name') ? messages.required : v('contact_name').length < 3 ? messages.minlength3 : '') && ok;
      ok = setError('contact_email', !v('contact_email') ? messages.required : !emailRe.test(v('contact_email')) ? messages.validEmail : '') && ok;
      ok = setError('contact_subject', !v('contact_subject') ? messages.required : v('contact_subject').length < 5 ? messages.minlength5 : '') && ok;
      ok = setError('contact_message', !v('contact_message') ? messages.required : v('contact_message').length < 10 ? messages.minlength10 : '') && ok;
      return ok;
    };

    const verifyCaptcha = async () => {
      const resp = (window.grecaptcha && window.grecaptcha.getResponse()) || '';
      if (!resp) return false;
      const r = await fetch(endpoints.recaptcha, { method: 'POST', body: JSON.stringify({ captchaResponse: resp }) });
      const data = await r.json();
      return data.body === '"Success"';
    };

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validate()) return;
      const captchaOk = await verifyCaptcha();
      if (!captchaOk) { flash('recaptcha_message'); return; }

      show('generic-loader', true);
      try {
        const payload = {
          name: $('contact_name').value,
          email: $('contact_email').value,
          subject: $('contact_subject').value,
          message: $('contact_message').value,
        };
        const res = await fetch(endpoints.contact, { method: 'POST', body: JSON.stringify(payload) });
        show('generic-loader', false);
        if (!res.ok) throw new Error('send failed');
        form.reset();
        flash('success_message');
        if (window.grecaptcha) window.grecaptcha.reset();
      } catch {
        show('generic-loader', false);
        flash('error_message');
      }
    });
  }
</script>
```

Notes:
- Native field rules mirror the legacy jquery-validation config exactly (name≥3, email, subject≥5, message≥10) with the localized messages.
- `define:vars` is used here deliberately (this script needs server-rendered config + localized strings and makes NO bare npm imports), so inlining is correct — contrast with `Map.astro`, which imports `leaflet` and therefore must NOT use `define:vars`.
- The recaptcha verify call uses `async`/`await` (replacing the legacy synchronous `$.ajax`), preserving the same endpoint + payload shape.

- [ ] **Step 5: Create `src/pages/[lang]/contact.astro`**

```astro
---
import BaseLayout from '../../layouts/BaseLayout.astro';
import Navbar from '../../components/Navbar.astro';
import HeaderBottom from '../../components/HeaderBottom.astro';
import Footer from '../../components/Footer.astro';
import ContactForm from '../../components/ContactForm.astro';
import { getStaticLocalePaths, isLocale, DEFAULT_LOCALE } from '../../i18n/locales';

export function getStaticPaths() { return getStaticLocalePaths(); }

const langParam = Astro.params.lang;
const lang = isLocale(langParam) ? langParam : DEFAULT_LOCALE;

const title = 'Contact | Studios to rent at Sivota - Marinos-Aparts - rooms to let Sivota | Ενοικιαζόμενα δωμάτια Σύβοτα';
const description = 'Check for availability. We will contact you as soon as possible';
---

<BaseLayout lang={lang} title={title} description={description} canonicalPath="/contact">
  <Navbar lang={lang} canonicalPath="/contact" current="contact" />
  <div class="tm-contact-img-container"></div>
  <HeaderBottom lang={lang} />

  <section class="tm-section">
    <div class="container-fluid">
      <div class="row">
        <ContactForm lang={lang} />
      </div>
    </div>
  </section>

  <Footer lang={lang} />
  <script src="https://www.google.com/recaptcha/api.js" async defer is:inline></script>
</BaseLayout>
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx playwright test tests/contact.spec.ts`
Expected: PASS (validation errors shown on empty submit; success on stubbed valid submit; Greek submit label).

- [ ] **Step 7: Commit**

```bash
git add src/config.ts src/components/ContactForm.astro "src/pages/[lang]/contact.astro" tests/contact.spec.ts
git commit -m "feat: add bilingual Contact page with vanilla form + reCAPTCHA"
```

---

## Task 8: Meaningful link-check + suite finalization

**Files:**
- Modify: `package.json` (`check:links`), and any page importing now-unused v4 PhotoSwipe CSS
- Test: full suite run

**Interfaces:**
- Produces: a green `npm run build`, `npm test` (all spec files), and a `check:links` that actually crawls the rendered pages.

- [ ] **Step 1: Make `check:links` crawl the real pages**

Plan 1's `check:links` was a no-op (it started at the root redirect stub). Now that all pages exist, crawl from the locale landing pages against the built output. Replace the `check:links` script in `package.json` with one that serves `dist` and crawls both locale roots:

```json
"check:links": "linkinator http://localhost:4321/en/ http://localhost:4321/gr/ --recurse --silent --skip \"^https?://(www\\.)?(marinos-aparts\\.gr|okairos|kit\\.fontawesome|fonts\\.googleapis|unpkg|photoswipe|facebook|instagram|reservations\\.bookoncloud|googletagmanager|google\\.com|gstatic)\""
```

Because linkinator needs the site served, run it against a preview server. Add a helper script too:

```json
"check:links:ci": "npm run build && (npm run preview & sleep 3 && npm run check:links; kill %1)"
```

- [ ] **Step 2: Run the link check**

Run: `npm run build && npm run preview &` then (after it is up) `npm run check:links`
Expected: it crawls `/en/` and `/gr/` and all internal links (`/en/kimon`, `/en/irida`, `/en/location`, `/en/contact`, and the `/gr/...` set) resolve — **0 broken internal links**. If a real broken internal link is found, fix the offending `href` (do not skip-list internal links). Stop the preview server afterward.

- [ ] **Step 3: Remove dead v4 PhotoSwipe CSS imports**

The Gallery now uses PhotoSwipe v5 CSS (CDN). The legacy v4 `src/styles/photoswipe.css` and `src/styles/default-skin.css` are imported in `BaseLayout.astro` but are no longer used by any gallery. Remove those two `import` lines from `BaseLayout.astro` (keep `bootstrap.min.css` and `templatemo-style.css`). Then:

Run: `npx astro check && npm run build`
Expected: 0 type errors; build succeeds.

(If the visual parity gate in Plan 3 later shows the v5 lightbox chrome must match v4 exactly, the v4 CSS can be reinstated — flagged, not assumed.)

- [ ] **Step 4: Run the entire test suite**

Run: `npm test`
Expected: ALL spec files pass — `tests/home.spec.ts`, `tests/kimon.spec.ts`, `tests/irida.spec.ts`, `tests/location.spec.ts`, `tests/contact.spec.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json src/layouts/BaseLayout.astro
git commit -m "test: real link-checking across pages; drop unused v4 PhotoSwipe CSS"
```

---

## Self-Review

**Spec coverage (against `2026-06-20-astro-migration-design.md`):**
- §2 components/pages structure → Tasks 2–7 (Gallery, ContactForm, four page routes). ✓
- §3 per-locale pages for all routes + locale-prefixed nav → Tasks 4–7; nav active-state → Task 2. ✓
- §4 jQuery removed; vanilla islands: gallery (PhotoSwipe v5) → Task 3; contact form validation + reCAPTCHA + fetch → Task 7. ✓ (jquery-validation replaced by vanilla validate(); `$.post`/`$.ajax` replaced by `fetch`.)
- §5 image optimization for the bulk of images (galleries) via `src/assets` + `<Image>` + glob → Tasks 4–6. ✓
- §6 testing: per-page Playwright smoke (render both locales, gallery opens, form validates/submits with mocked network) → Tasks 4–7; meaningful link-check → Task 8. ✓
- Cross-plan backlog folded in: dynamic nav active (Task 2), meaningful link-check (Task 8), `rel="noopener"` on the book link (Task 2). ✓
- Deferred (NOT this plan): mobile language-switcher + footer-menu hide-class parity, legacy `<a><li>` markup, GA4-before-charset → **Plan 3 parity gate**. CI/CD + buckets + edge redirects → **Plan 4**.

**Placeholder scan:** No TBD/TODO. The i18n task uses verbatim-port-from-source (values cited by file + line range) rather than re-inlining ~50 long strings; the key-parity unit test + Plan 3 parity gate enforce completeness — consistent with Plan 1's approach. The `byФile` helper note explicitly instructs renaming to ASCII `byFile`.

**Type consistency:** `GalleryItem` defined in Task 3 (`{thumb, full, alt, heading?, caption?}`) is consumed identically in Tasks 4–6. `Navbar` `current?: NavKey` defined in Task 2 consumed in Tasks 4–7 and the home page. `API_ENDPOINTS`/`RECAPTCHA_SITE_KEY` defined in Task 7 `src/config.ts` consumed by `ContactForm`. Footer `mapFocus` (Plan 1) consumed by kimon/irida. The `facilities` key insertion order is pinned in Task 1 and relied on by the `slice(0,8)`/`slice(8)` split in Tasks 4–5.

**Note for executor:** confirm `irida.html`'s facility list matches the 16 keys used for Kimon before finalizing Task 5 (the legacy `App.facilities_lang` is shared, so they should be identical).

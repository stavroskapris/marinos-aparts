# Parity Gate & Fixes — Implementation Plan (Phase 1, Plan 3 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the Astro build lost nothing versus the legacy site (text, image, functionality, visual — including full mobile responsiveness) and close the known parity gaps, leaving the branch cutover-ready.

**Architecture:** Two streams. **Stream A (Tasks 1–6)** fixes known parity gaps in the shipped components. **Stream B (Tasks 7–10)** builds and runs the verification gate (automated text + image parity scripts, an augmented functionality/mobile e2e suite, and a screenshot-capture visual pass with human sign-off). Fixes land first so the gate verifies the fixed state. CI/CD, buckets, and edge redirects are explicitly **out of scope** (Plan 4).

**Tech Stack:** Astro 4, TypeScript, PhotoSwipe v5, Leaflet, Playwright, Vitest, linkinator. No jQuery.

## Global Constraints

- Fully static output; two locales `en` (default) + `gr`; per-locale URLs `/en/<page>`, `/gr/<page>`.
- Lift-and-shift: visible text + images preserved; any divergence from the legacy site must be explicitly listed and signed off, never silently accepted. Legacy source of truth lives in the repo: `home.html`, `kimon.html`, `irida.html`, `location.html`, `contact.html` + `js/custom/lang/*.js`.
- **No horizontal overflow at mobile width.** All ten routes (5 pages × `en`/`gr`) must fit a 390px viewport with `document.documentElement.scrollWidth <= clientWidth` (±1px), and the mobile nav toggle, mobile language switch, gallery open, and contact form must work at mobile width. This is a hard acceptance criterion.
- No jQuery / jquery-validation / Bootstrap JS / tether in shipped output.
- Import convention: local TS modules WITHOUT file extension (`../i18n/t`); `.astro` imports keep the extension; JSON imported WITHOUT an import assertion.
- Site origin `https://www.marinos-aparts.gr`. Node 18+.
- Run all commands and agents from the repo root `/home/stavros/PersonalProjects/marinos-aparts`.
- Playwright config (`playwright.config.ts`) auto-runs `npm run build && npm run preview` and reuses an existing server on `:4321` when not in CI. Unit tests = Vitest (`npm run test:unit`, scoped to `src/**/*.test.ts`); e2e = Playwright (`npm test`).

## Interfaces from Plans 1–2 (consumed here, do not recreate)

- `src/components/Gallery.astro` → `Gallery` island, props `{ items: GalleryItem[]; figureClass: string }`; exported `GalleryItem`. Registers a PhotoSwipe v5 `PhotoSwipeLightbox` in a bundled `<script>` with a `custom-caption` UI element. Loads `photoswipe.css` from the unpkg CDN (Task 4 changes this).
- `src/components/ResortPage.astro` → shared scaffold; props include `figureClass: string` passed through to `Gallery`.
- `src/pages/[lang]/kimon.astro`, `irida.astro`, `location.astro` → each owns its own `import.meta.glob(...)` and passes `figureClass` to its gallery (`kimon`/`irida`/`location` respectively).
- `src/components/Navbar.astro` → renders `<ul class="nav navbar-nav">` (the nav items) and a separate `<ul class="languagepicker roundborders"><LangSwitcher .../></ul>`. Props `{ lang, canonicalPath, current? }`.
- `src/components/LangSwitcher.astro` → props `{ lang, canonicalPath }`; emits one anchor per locale.
- `src/components/ContactForm.astro` → vanilla form island; submit handler `fetch`es `endpoints.contact`, treats `res.ok` as success.
- `src/i18n/en.json`, `gr.json` → translation data; `t(lang)` returns the strings object.

## File Structure

```
src/pages/[lang]/irida.astro          # MODIFY: figureClass "irida" -> "kimon" (legacy parity)
src/styles/templatemo-style.css       # MODIFY: location mobile-overflow fix; delete dead rules
src/components/Navbar.astro           # MODIFY: hide-lang-menu + in-menu mobile switcher
src/components/LangSwitcher.astro     # MODIFY: valid <li><a> markup
src/components/Gallery.astro          # MODIFY: fullscreen button; local PhotoSwipe CSS import
src/components/ContactForm.astro      # MODIFY: validate contact response body
scripts/parity-text.mjs               # NEW: text parity extractor + diff
scripts/parity-images.mjs             # NEW: image coverage check
scripts/visual-capture.mjs            # NEW (Playwright): legacy + astro screenshots
tests/mobile.spec.ts                  # NEW: no-overflow + mobile functional checks
tests/lightbox.spec.ts                # NEW: fullscreen button + caption open
tests/contact.spec.ts                 # MODIFY: validation-branch + response-body tests
package.json                          # MODIFY: parity:* + visual:capture scripts; photoswipe css dep path
docs/superpowers/parity/              # NEW: generated evidence (reports + screenshots), git-ignored
```

---

## Task 1: Fix mobile gallery overflow (irida + location)

**Files:**
- Modify: `src/pages/[lang]/irida.astro`
- Modify: `src/styles/templatemo-style.css`
- Test: `tests/mobile.spec.ts` (new)

**Interfaces:**
- Consumes: `Gallery` `figureClass` prop.
- Produces: all 10 routes fit 390px with no horizontal overflow. A reusable Playwright spec `tests/mobile.spec.ts` asserts this.

**Root cause (verified):** At `≤510px` the generic rule `figure { width: 100%; margin: 0 50px 1rem; }` (templatemo-style.css ~line 639) overflows by ~49px (100% width + 100px of side margins). `figure.kimon` escapes because the more-specific `figure.kimon { width: 50% }` (~line 601) keeps it narrow. Legacy `irida.html` used `class="kimon"` for its figures (so it fit); Plan 2 changed it to `class="irida"`, which has no CSS. Legacy `location.html` used `class="location"`, which also has no dedicated CSS and inherited the overflowing generic rule.

- [ ] **Step 1: Write the failing test**

Create `tests/mobile.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const ROUTES = ['/en/', '/gr/', '/en/kimon', '/gr/kimon', '/en/irida', '/gr/irida', '/en/location', '/gr/location', '/en/contact', '/gr/contact'];

test('no horizontal overflow at mobile width (390px)', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const offenders: string[] = [];
  for (const route of ROUTES) {
    await page.goto(route);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) offenders.push(`${route}: ${overflow}px`);
  }
  expect(offenders, `pages overflowing at 390px: ${offenders.join(', ')}`).toHaveLength(0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/mobile.spec.ts`
Expected: FAIL — offenders include `/en/irida`, `/gr/irida`, `/en/location`, `/gr/location` (~49px each).

- [ ] **Step 3: Fix irida to use the legacy figure class**

In `src/pages/[lang]/irida.astro`, change the `figureClass` passed to `ResortPage` from `"irida"` to `"kimon"` (legacy `irida.html` used `class="kimon"`):

```astro
<ResortPage
  lang={lang}
  ...
  figureClass="kimon"
/>
```
(Only the `figureClass` value changes; leave every other prop, the glob, and the `alt` text as-is.)

- [ ] **Step 4: Fix location figure margins at mobile**

In `src/styles/templatemo-style.css`, inside the existing `@media (max-width: 510px) { ... }` block (the one containing the `figure { width: 100%; margin: 0 50px 1rem; }` rule, ~line 639), add a `figure.location` override immediately after the generic `figure` rule:

```css
    figure.location {
        margin-left: 0;
        margin-right: 0;
    }
```
This keeps location figures full-width at ≤510px but removes the side margins that caused the overflow. Desktop/tablet location layout (generic `figure` widths) is unchanged; `figure.kimon` is untouched.

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx playwright test tests/mobile.spec.ts`
Expected: PASS (0 offenders). Then confirm no regression: `npx playwright test tests/kimon.spec.ts tests/irida.spec.ts tests/location.spec.ts` → all PASS (irida still renders its 15-image gallery; `figureClass` change does not affect figure count or captions).

- [ ] **Step 6: Commit**

```bash
git add "src/pages/[lang]/irida.astro" src/styles/templatemo-style.css tests/mobile.spec.ts
git commit -m "fix: eliminate mobile gallery overflow on irida/location pages"
```

---

## Task 2: Restore legacy responsive language switcher + valid HTML

**Files:**
- Modify: `src/components/LangSwitcher.astro`
- Modify: `src/components/Navbar.astro`
- Test: append to `tests/mobile.spec.ts`

**Interfaces:**
- Consumes: `Locale`, `LOCALES`, `t`.
- Produces: at desktop (>1024px) the `.languagepicker` flag picker shows and the in-menu switcher is hidden; at mobile (≤1024px) the `.languagepicker` is hidden (`hide-lang-menu`) and an in-menu switcher (`#toggle-js-langmenu.hide-lang-nav-items`) shows the locale links. `LangSwitcher` emits valid `<li><a>…</a></li>` markup.

**Legacy reference (verified):** `home.html` lines 95–110 — desktop `<ul class="languagepicker roundborders hide-lang-menu">` (hidden ≤1024px) plus an in-menu `<div class="hide-lang-nav-items" id="toggle-js-langmenu">` of `<li class="nav-item"><a class="nav-link" …><img …></a></li>` flag links. The `data-key="english"/"greek"` on those legacy links were vestigial (no such keys exist in the lang dicts), so the legacy mobile switcher rendered the **flag images**, not text. The CSS classes `hide-lang-menu` (templatemo-style.css:448) and `hide-lang-nav-items` (332, 451) already exist; only the markup needs restoring.

- [ ] **Step 1: Write the failing test**

Append to `tests/mobile.spec.ts`:

```ts
test('language switcher: desktop picker hidden on mobile, in-menu switcher shown', async ({ page }) => {
  // desktop: flag picker visible, in-menu switcher hidden
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/en/');
  await expect(page.locator('.languagepicker')).toBeVisible();
  await expect(page.locator('#toggle-js-langmenu')).toBeHidden();

  // mobile: flag picker hidden, in-menu switcher present with both locale links
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');
  await expect(page.locator('.languagepicker')).toBeHidden();
  const menuLinks = page.locator('#toggle-js-langmenu a');
  await expect(menuLinks).toHaveCount(2);
  await expect(menuLinks.first()).toHaveAttribute('href', /\/(en|gr)\//);
});

test('LangSwitcher emits valid li-inside-a-free markup', async ({ page }) => {
  await page.goto('/en/');
  // the picker anchors wrap an <li>; assert the corrected nesting <li><a>
  await expect(page.locator('.languagepicker li a img')).toHaveCount(2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/mobile.spec.ts -g "language switcher"`
Expected: FAIL — `#toggle-js-langmenu` does not exist; `.languagepicker` is visible at mobile (no `hide-lang-menu`).
Run: `npx playwright test tests/mobile.spec.ts -g "valid li-inside-a-free"`
Expected: FAIL — current markup is `<a><li><img></li></a>` so `.languagepicker li a img` matches 0.

- [ ] **Step 3: Fix LangSwitcher markup**

Replace `src/components/LangSwitcher.astro` body so the `<li>` wraps the `<a>` (valid HTML), keeping the same flags/order/attributes:

```astro
---
import type { Locale } from '../i18n/locales';
import { LOCALES } from '../i18n/locales';

interface Props { lang: Locale; canonicalPath: string; }
const { lang, canonicalPath } = Astro.props;
const flag: Record<Locale, string> = { en: '/img/nav/en.png', gr: '/img/nav/gr.jpg' };
const ordered: Locale[] = [lang, ...LOCALES.filter((l) => l !== lang)];
---

{ordered.map((l) => (
  <li><a href={`/${l}${canonicalPath}/`} data-lang-switch={l} class="js-langanchor"><img src={flag[l]} height="13" width="18" alt={l} /></a></li>
))}
```

- [ ] **Step 4: Restore the responsive markup in Navbar**

In `src/components/Navbar.astro`: (a) add `hide-lang-menu` to the desktop picker `ul`, and (b) add the in-menu mobile switcher as the last child of the nav-items `ul` (`<ul class="nav navbar-nav">`). Use flag links (matching legacy behavior):

```astro
          <!-- ...existing <li class="nav-item"> entries... -->
          <div class="hide-lang-nav-items" id="toggle-js-langmenu">
            <li class="nav-item"><a href={`/en${canonicalPath}/`} data-lang-switch="en" class="nav-link js-langanchor"><img src="/img/nav/en.png" height="13" width="18" alt="en" /></a></li>
            <li class="nav-item"><a href={`/gr${canonicalPath}/`} data-lang-switch="gr" class="nav-link js-langanchor"><img src="/img/nav/gr.jpg" height="13" width="18" alt="gr" /></a></li>
          </div>
        </ul>
        <ul class="languagepicker roundborders hide-lang-menu">
          <LangSwitcher lang={lang} canonicalPath={canonicalPath} />
        </ul>
```
(Keep the existing `current`-driven nav items, the toggler button, and the collapse wrapper exactly as-is; only add the `hide-lang-menu` class and the `#toggle-js-langmenu` block.)

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx playwright test tests/mobile.spec.ts -g "language switcher"` → PASS.
Run: `npx playwright test tests/mobile.spec.ts -g "valid li-inside-a-free"` → PASS.
Run the full home suite for no regression: `npx playwright test tests/home.spec.ts` → all PASS (the existing mobile-hamburger test still toggles the nav).

- [ ] **Step 6: Commit**

```bash
git add src/components/LangSwitcher.astro src/components/Navbar.astro tests/mobile.spec.ts
git commit -m "fix: restore legacy responsive language switcher and valid <li><a> markup"
```

---

## Task 3: Lightbox fullscreen button

**Files:**
- Modify: `src/components/Gallery.astro`
- Test: `tests/lightbox.spec.ts` (new)

**Interfaces:**
- Produces: the PhotoSwipe v5 toolbar gains a fullscreen toggle (`.pswp__button--fs`) that calls the Fullscreen API on the `.pswp` root. Share is intentionally NOT added (documented approved difference vs legacy v4).

- [ ] **Step 1: Write the failing test**

Create `tests/lightbox.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('lightbox shows a fullscreen toggle button', async ({ page }) => {
  await page.goto('/en/kimon');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
  await expect(page.locator('.pswp__button--fs')).toBeVisible();
});

test('location lightbox caption renders bottom-anchored and readable', async ({ page }) => {
  await page.goto('/en/location');
  await page.locator('#gallery a').first().click();
  const caption = page.locator('.pswp__custom-caption');
  await expect(caption).toBeVisible();
  await expect(caption).toContainText('Agia Paraskevi');
  const box = await caption.boundingBox();
  const vp = page.viewportSize();
  expect(box!.y).toBeGreaterThan(vp!.height / 2);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test tests/lightbox.spec.ts -g "fullscreen"`
Expected: FAIL — `.pswp__button--fs` not present (v5 ships no fullscreen button).

- [ ] **Step 3: Register the fullscreen button**

In `src/components/Gallery.astro`, inside the bundled `<script>`, add a second `uiRegister` element (after the existing `custom-caption` registration, before `lightbox.init()`). It toggles the Fullscreen API on the PhotoSwipe root element:

```ts
    lightbox.on('uiRegister', () => {
      lightbox.pswp!.ui!.registerElement({
        name: 'fs',
        title: 'Toggle fullscreen',
        order: 8,
        isButton: true,
        html: '<span style="font-size:18px;line-height:1">⛶</span>',
        onClick: () => {
          const el = lightbox.pswp!.element as HTMLElement | undefined;
          if (!el) return;
          if (document.fullscreenElement) document.exitFullscreen();
          else el.requestFullscreen?.();
        },
      });
    });
```
(Keep the existing `custom-caption` `uiRegister` block as-is — two separate `lightbox.on('uiRegister', ...)` registrations are fine. `26F6` is the U+26F6 "square four corners" glyph; the button gets PhotoSwipe's default `.pswp__button` styling plus the `--fs` modifier from its `name`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/lightbox.spec.ts`
Expected: PASS (both: fullscreen button visible; caption still bottom-anchored — confirms the caption styling from Plan 2 survives).

- [ ] **Step 5: Type-check**

Run: `npx astro check`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/components/Gallery.astro tests/lightbox.spec.ts
git commit -m "feat: add fullscreen toggle to the PhotoSwipe lightbox toolbar"
```

---

## Task 4: Vendor PhotoSwipe v5 CSS (drop the CDN dependency)

**Files:**
- Modify: `src/components/Gallery.astro`
- Test: `npm run build` + grep the built output

**Interfaces:**
- Produces: the lightbox CSS is bundled from the local `photoswipe` package instead of fetched from `unpkg.com` at runtime.

- [ ] **Step 1: Replace the CDN link with a local import**

In `src/components/Gallery.astro`, delete the line:
```astro
<link rel="stylesheet" href="https://unpkg.com/photoswipe@5.4.4/dist/photoswipe.css" />
```
and instead import the package CSS at the top of the bundled `<script>` (Vite bundles it into the page's stylesheet):
```ts
<script>
  import 'photoswipe/style.css';
  import PhotoSwipeLightbox from 'photoswipe/lightbox';
  // ...rest unchanged...
```
(The `photoswipe` npm package — already a dependency — exposes its stylesheet at `photoswipe/style.css`.)

- [ ] **Step 2: Build and verify the CDN reference is gone**

Run: `npm run build`
Expected: exit 0.
Run: `grep -rl "unpkg.com" dist || echo "no unpkg references in dist"`
Expected: `no unpkg references in dist`.

- [ ] **Step 3: Verify the lightbox still styles correctly**

Run: `npx playwright test tests/lightbox.spec.ts`
Expected: PASS (caption + fullscreen button still render — confirms the bundled CSS loaded).

- [ ] **Step 4: Commit**

```bash
git add src/components/Gallery.astro
git commit -m "refactor: bundle PhotoSwipe v5 CSS locally instead of the unpkg CDN"
```

---

## Task 5: Remove dead CSS

**Files:**
- Modify: `src/styles/templatemo-style.css`
- Test: `npm run build`

**Interfaces:**
- Produces: no behavior change; removes two no-op `size: 100px` declarations (`size` is not a valid CSS property) and a leftover TODO comment.

- [ ] **Step 1: Delete the dead lines**

In `src/styles/templatemo-style.css`:
- Line 2: remove the `TODO MINIFY BEFORE FINAL COMMIT` comment.
- Line ~262 and ~269: remove the two `size: 100px;` declarations (no-ops — `size` is not a real property; the `#osm-map` / `#weather-widget` rules they sit in keep their other declarations).

- [ ] **Step 2: Verify build + no visual change**

Run: `npx astro check && npm run build`
Expected: 0 errors, exit 0.
Run: `npx playwright test tests/home.spec.ts` (map + weather widget still render).
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles/templatemo-style.css
git commit -m "chore: remove dead size:100px no-ops and stale TODO comment"
```

---

## Task 6: Harden the contact form

**Files:**
- Modify: `src/components/ContactForm.astro`
- Test: `tests/contact.spec.ts` (modify)

**Interfaces:**
- Consumes: `endpoints.contact`.
- Produces: the submit handler treats the response as success only when the Lambda body indicates success, not merely `res.ok`. Validation-branch tests cover minlength/email messages.

**Legacy reference:** `js/custom/app.js` `sendEmail()` used `$.post(...).done(success).fail(error)` — i.e. success only on a 2xx with a normal completion, error otherwise. The current island treats any `res.ok` as success. The Lambda returns a body; the recaptcha endpoint returns `{ body: '"Success"' }`. Keep success criteria conservative: require `res.ok` AND a non-error body.

- [ ] **Step 1: Write the failing tests**

Append to `tests/contact.spec.ts`:

```ts
test('shows per-field validation messages for too-short input', async ({ page }) => {
  await page.goto('/en/contact');
  await page.fill('#contact_name', 'Jo');                 // < 3
  await page.fill('#contact_email', 'not-an-email');      // invalid
  await page.fill('#contact_subject', 'hey');             // < 5
  await page.fill('#contact_message', 'too short');       // < 10
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('.field-error[data-for="contact_name"]')).toContainText('at least 3');
  await expect(page.locator('.field-error[data-for="contact_email"]')).toContainText('valid email');
  await expect(page.locator('.field-error[data-for="contact_subject"]')).toContainText('at least 5');
  await expect(page.locator('.field-error[data-for="contact_message"]')).toContainText('at least 10');
});

test('treats a non-success response body as an error, not success', async ({ page }) => {
  await page.addInitScript(() => { (window as any).grecaptcha = { getResponse: () => 'tok', reset: () => {} }; });
  await page.route('**/recaptcha/api.js*', (r) => r.abort());
  await page.route('**/amazonaws.com/**/validaterecaptcha', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '"Success"' }) }));
  await page.route('**/amazonaws.com/**/contact', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ body: '"Error"' }) }));
  await page.goto('/en/contact');
  await page.fill('#contact_name', 'Jane Doe');
  await page.fill('#contact_email', 'jane@example.com');
  await page.fill('#contact_subject', 'Booking question');
  await page.fill('#contact_message', 'I would like to book a room for August.');
  await page.locator('#contact-form-submit').click();
  await expect(page.locator('#error_message')).toBeVisible();
  await expect(page.locator('#success_message')).toBeHidden();
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx playwright test tests/contact.spec.ts -g "non-success response body"`
Expected: FAIL — current code shows `#success_message` on any `res.ok`.
(The validation-message test may already pass if the messages match; if so, note it — it is a coverage addition, not a behavior change.)

- [ ] **Step 3: Validate the response body before declaring success**

In `src/components/ContactForm.astro`, in the submit handler, replace the success check. Currently:
```ts
        const res = await fetch(endpoints.contact, { method: 'POST', headers: {...}, body: JSON.stringify(payload) });
        show('generic-loader', false);
        if (!res.ok) throw new Error('send failed');
```
with a body check:
```ts
        const res = await fetch(endpoints.contact, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' }, body: JSON.stringify(payload) });
        show('generic-loader', false);
        if (!res.ok) throw new Error('send failed');
        const data = await res.json().catch(() => ({}));
        // Lambda echoes a body; treat an explicit error body as failure.
        if (typeof data.body === 'string' && data.body.toLowerCase().includes('error')) throw new Error('send rejected');
```
(Keep the rest of the success path — `form.reset()`, `flash('success_message')`, `grecaptcha.reset()` — and the `catch` that flashes `error_message`.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx playwright test tests/contact.spec.ts`
Expected: PASS (all: the original empty-submit + valid-submit tests, the new validation-branch test, and the non-success-body test).

- [ ] **Step 5: Commit**

```bash
git add src/components/ContactForm.astro tests/contact.spec.ts
git commit -m "fix: contact form validates the response body and add validation-branch tests"
```

---

## Task 7: Text parity check (automated)

**Files:**
- Create: `scripts/parity-text.mjs`
- Modify: `package.json` (add `parity:text`)
- Test: run the script; expected diff is empty (or every difference signed off)

**Interfaces:**
- Produces: `npm run parity:text` extracts the legacy translation values from `js/custom/lang/*.js` per language and the Astro values from `src/i18n/{en,gr}.json`, diffs them, prints any differences, and exits non-zero if there are unexplained differences. Writes a report to `docs/superpowers/parity/text-report.md`.

**Approach:** The legacy translatable strings live in the `*_lang.js` dictionaries (the source the pages render from). The Astro strings live in the i18n JSON. Both are keyed; the gate compares **values** (Plans 1–2 already verified key parity). The legacy dicts are plain JS object literals assigned to `App.*` — load them by evaluating the files in a sandboxed function that stubs `App`.

- [ ] **Step 1: Write the parity script**

Create `scripts/parity-text.mjs`:

```js
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// Evaluate a legacy *_lang.js file with a stubbed `App` and capture assignments.
function loadLegacy(file) {
  const src = readFileSync(file, 'utf8');
  const App = {};
  // The dicts assign onto App.* (e.g. App.navbar_lang = {...}); run in a function scope.
  new Function('App', src)(App);
  return App;
}

// Flatten a nested object to dotted-key -> string-value pairs.
function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out[key] = String(v);
  }
  return out;
}

const en = JSON.parse(readFileSync('src/i18n/en.json', 'utf8'));
const gr = JSON.parse(readFileSync('src/i18n/gr.json', 'utf8'));
const astro = { en: flatten(en), gr: flatten(gr) };

// Build the set of legacy values per language from the lang dicts.
// (The implementer wires the exact dict shapes from js/custom/lang/*.js here —
//  navbar_lang, facilities_lang, header_bottom_lang, app_lang — into {en:{...}, gr:{...}}.)
const legacy = buildLegacyValueSets(); // returns { en: Set<string>, gr: Set<string> }

const lines = ['# Text parity report', ''];
let unexplained = 0;
for (const lang of ['en', 'gr']) {
  const astroValues = new Set(Object.values(astro[lang]));
  const missing = [...legacy[lang]].filter((v) => !astroValues.has(v));
  lines.push(`## ${lang}: ${missing.length} legacy string(s) not found in the Astro build`);
  for (const m of missing) { lines.push(`- ${JSON.stringify(m)}`); unexplained++; }
  lines.push('');
}
mkdirSync('docs/superpowers/parity', { recursive: true });
writeFileSync('docs/superpowers/parity/text-report.md', lines.join('\n'));
console.log(lines.join('\n'));
process.exit(unexplained === 0 ? 0 : 1);
```

Implementer note: implement `buildLegacyValueSets()` by `loadLegacy()`-ing each `js/custom/lang/*.js` file and collecting all string leaf values per language into a `Set`. The expected result is that every legacy string is present in the Astro values (diff empty). Whitespace differences count — preserve them.

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`, add:
```json
    "parity:text": "node scripts/parity-text.mjs"
```

- [ ] **Step 3: Run it**

Run: `npm run parity:text`
Expected: exits 0 with an empty diff per language. If any string is reported missing, investigate: either a real port gap (fix the i18n JSON) or an intentional difference (record it in the report's sign-off section and exclude it explicitly). Do not silently ignore.

- [ ] **Step 4: Commit**

```bash
git add scripts/parity-text.mjs package.json
git commit -m "test: automated text-parity check (legacy lang dicts vs Astro i18n)"
```

---

## Task 8: Image parity check (automated)

**Files:**
- Create: `scripts/parity-images.mjs`
- Modify: `package.json` (add `parity:images`)

**Interfaces:**
- Produces: `npm run parity:images` enumerates every image referenced by the legacy site and asserts each has a counterpart in the new build (presence, one-to-one; not byte-identity). Writes `docs/superpowers/parity/image-report.md`; exits non-zero on a dropped or orphaned image.

- [ ] **Step 1: Write the script**

Create `scripts/parity-images.mjs`:

```js
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

// Every <img src> / url(...) referenced by the legacy HTML + CSS.
const legacyHtml = ['home.html', 'kimon.html', 'irida.html', 'location.html', 'contact.html'];
const refs = new Set();
for (const f of legacyHtml) {
  const html = readFileSync(f, 'utf8');
  for (const m of html.matchAll(/(?:src|href)="([^"]+\.(?:jpg|jpeg|png|gif|svg|webp))"/gi)) refs.add(basename(m[1]));
}
const css = readFileSync('css/templatemo-style.css', 'utf8'); // legacy CSS backgrounds
for (const m of css.matchAll(/url\(['"]?([^'")]+\.(?:jpg|jpeg|png|gif|svg|webp))['"]?\)/gi)) refs.add(basename(m[1]));

// Every image the new build can serve: src/assets (optimized) + public (copied as-is).
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(jpg|jpeg|png|gif|svg|webp)$/i.test(e.name)) acc.push(basename(e.name));
  }
  return acc;
}
const available = new Set([...walk('src/assets'), ...walk('public')]);

const missing = [...refs].filter((r) => !available.has(r));
const lines = ['# Image parity report', '', `Legacy referenced: ${refs.size}`, `Available in build: ${available.size}`, '', '## Missing (referenced by legacy, absent from build):', ...missing.map((m) => `- ${m}`)];
mkdirSync('docs/superpowers/parity', { recursive: true });
writeFileSync('docs/superpowers/parity/image-report.md', lines.join('\n'));
console.log(lines.join('\n'));
process.exit(missing.length === 0 ? 0 : 1);
```

Implementer note: filenames are the comparison key (the new build re-encodes to webp with hashed names at build time, so compare by original basename in `src/assets`/`public`, not by served URL). Some legacy images intentionally did not move (e.g. `kimon-home.jpg`, `irida-home.jpg` stayed in `public/img`); they should still be found. Any genuinely-missing image is a defect; any legacy-only decorative image deliberately dropped is recorded in the report and excluded explicitly.

- [ ] **Step 2: Add the npm script + run**

In `package.json`: `"parity:images": "node scripts/parity-images.mjs"`.
Run: `npm run parity:images`
Expected: exit 0, `Missing` empty. Investigate any miss.

- [ ] **Step 3: Commit**

```bash
git add scripts/parity-images.mjs package.json
git commit -m "test: automated image-coverage parity check"
```

---

## Task 9: Functionality + mobile-functional parity

**Files:**
- Modify: `tests/mobile.spec.ts` (add mobile functional checks)
- Test: the full Playwright suite

**Interfaces:**
- Produces: explicit e2e coverage of the functionality-parity checklist at mobile width (the desktop functionality is already covered by the per-page specs from Plans 1–2).

- [ ] **Step 1: Write the mobile functional tests**

Append to `tests/mobile.spec.ts`:

```ts
test('mobile: nav toggle, language switch, gallery open all work at 390px', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // nav toggle
  await page.goto('/en/kimon');
  const menu = page.locator('#tmNavbar');
  await page.locator('.navbar-toggler').click();
  await expect(menu).toBeVisible();

  // language switch via the in-menu mobile switcher
  await page.locator('#toggle-js-langmenu a[data-lang-switch="gr"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'gr');

  // gallery opens on mobile
  await page.goto('/en/location');
  await page.locator('#gallery a').first().click();
  await expect(page.locator('.pswp')).toBeVisible();
});
```

- [ ] **Step 2: Run to verify**

Run: `npx playwright test tests/mobile.spec.ts`
Expected: PASS. (If the nav toggle selector differs, align it with the existing passing test in `tests/home.spec.ts`.)

- [ ] **Step 3: Run the entire suite (functionality-parity checklist)**

Run: `npm test`
Expected: ALL specs pass — `home`, `kimon`, `irida`, `location`, `contact`, `mobile`, `lightbox`. Together these cover the checklist: language switch (every page), gallery + captions, contact form (fields/validation/recaptcha/submit), map markers, weather widget, scroll-to-top, GA4 presence, and mobile behavior. Note in the report any checklist item not yet asserted and add it.

- [ ] **Step 4: Commit**

```bash
git add tests/mobile.spec.ts
git commit -m "test: mobile functional parity (nav toggle, language switch, gallery)"
```

---

## Task 10: Visual parity capture + sign-off

**Files:**
- Create: `scripts/visual-capture.mjs`
- Modify: `package.json` (add `visual:capture`)
- Test: human review of captured evidence

**Interfaces:**
- Produces: `npm run visual:capture` screenshots all 5 pages × 2 locales × {desktop 1280, mobile 390} for both the locally-served legacy site and the Astro build, into `docs/superpowers/parity/shots/{legacy,astro}/`. A human reviews them side-by-side and signs off; differences are recorded.

**Approach:** The legacy site is static HTML in the repo root — serve it on a second port and drive it with Playwright (set `localStorage.lang='gr'` then reload for the Greek variant, since the legacy site switches language client-side). The Astro build is served by `npm run preview` on `:4321`.

- [ ] **Step 1: Write the capture script**

Create `scripts/visual-capture.mjs` (uses the already-installed `@playwright/test` chromium and a tiny static server for the legacy files):

```js
import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join } from 'node:path';

const LEGACY_PORT = 4399;
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.gif': 'image/gif', '.ico': 'image/x-icon' };
const legacyServer = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' ) p = '/home.html';
  const file = join(process.cwd(), p);
  if (!existsSync(file)) { res.statusCode = 404; return res.end('nf'); }
  res.setHeader('Content-Type', types[extname(file)] || 'application/octet-stream');
  res.end(readFileSync(file));
}).listen(LEGACY_PORT);

const VIEWPORTS = [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }];
const PAGES = [['home', 'home.html', '/en/'], ['kimon', 'kimon.html', '/en/kimon'], ['irida', 'irida.html', '/en/irida'], ['location', 'location.html', '/en/location'], ['contact', 'contact.html', '/en/contact']];

mkdirSync('docs/superpowers/parity/shots/legacy', { recursive: true });
mkdirSync('docs/superpowers/parity/shots/astro', { recursive: true });
const browser = await chromium.launch();
for (const lang of ['en', 'gr']) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    for (const [name, legacyFile, astroPath] of PAGES) {
      // legacy: set language in localStorage, then load
      await page.addInitScript((l) => localStorage.setItem('lang', l), lang);
      await page.goto(`http://localhost:${LEGACY_PORT}/${legacyFile}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.screenshot({ path: `docs/superpowers/parity/shots/legacy/${name}-${lang}-${vp.name}.png`, fullPage: true });
      // astro
      const ap = astroPath.replace('/en/', `/${lang}/`);
      await page.goto(`http://localhost:4321${ap}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.screenshot({ path: `docs/superpowers/parity/shots/astro/${name}-${lang}-${vp.name}.png`, fullPage: true });
    }
    await ctx.close();
  }
}
await browser.close();
legacyServer.close();
console.log('captured 5 pages x 2 locales x 2 viewports for legacy + astro');
```

- [ ] **Step 2: Add the npm script**

In `package.json`: `"visual:capture": "node scripts/visual-capture.mjs"`. Add `docs/superpowers/parity/shots/` to `.gitignore` (evidence, not source).

- [ ] **Step 3: Capture**

Start the Astro preview server (build first), then run the capture against both servers:
Run: `npm run build` then start `npm run preview` (use the background-run mechanism, not an inline `&`), wait until `:4321` responds, then `npm run visual:capture`.
Expected: 40 screenshots written under `docs/superpowers/parity/shots/`. Stop the preview server afterward.

- [ ] **Step 4: Human review + sign-off**

Review each legacy/astro pair (desktop + mobile) for layout and appearance. Expected matches; record any difference with its justification in `docs/superpowers/parity/visual-signoff.md` (e.g. "lightbox toolbar: fullscreen kept, share dropped — approved", "location mobile: legacy overflowed, new build fixed — approved", "images re-encoded to WebP — expected"). The gate passes when every difference is either absent or explicitly signed off.

- [ ] **Step 5: Commit**

```bash
git add scripts/visual-capture.mjs package.json .gitignore docs/superpowers/parity/visual-signoff.md
git commit -m "test: visual-parity capture script and sign-off record"
```

---

## Self-Review

**Spec coverage (against `2026-06-20-astro-migration-design.md` §"Content & functionality parity verification" + the deferred backlog):**
- Text parity (automated) → Task 7. ✓
- Image parity (automated) → Task 8. ✓
- Functionality parity (checklist) → Task 9 + existing per-page specs. ✓
- Visual parity (side-by-side desktop+mobile, 5×2) → Task 10. ✓
- Hard gate / sign-off of differences → Task 10 Step 4 + the report files. ✓
- Deferred fixes folded in: mobile overflow (Task 1), mobile language-switcher parity (Task 2), LangSwitcher valid HTML (Task 2), lightbox fullscreen (Task 3, share dropped = approved difference), vendor PhotoSwipe CSS off CDN (Task 4), dead-CSS cleanup (Task 5), ContactForm response-body validation + validation-branch tests (Task 6). ✓
- **Full mobile responsiveness** (user requirement): no-overflow gate across all 10 routes (Task 1) + mobile functional checks (Task 9) + mobile visual capture (Task 10). ✓
- Out of scope (Plan 4): CI/CD, staging/prod workflows, bucket cutover, per-environment edge redirects, wiring these checks into CI. Not in this plan. ✓

**Placeholder scan:** The parity scripts (Tasks 7–8, 10) contain complete runnable code; Task 7 names a single helper (`buildLegacyValueSets`) the implementer fills by `loadLegacy()`-ing the cited `*_lang.js` files — this is wiring, not a vague placeholder (the load mechanism and comparison are fully specified). No "TBD"/"add error handling"/"similar to" placeholders elsewhere.

**Type/selector consistency:** `figureClass` value (Task 1) matches `Gallery`/`ResortPage` props from Plan 2. `.pswp__button--fs` (Task 3) is the class PhotoSwipe derives from `registerElement({ name: 'fs', isButton: true })` (`pswp__button--<name>`, confirmed against the v5 source in Plan 2). `#toggle-js-langmenu`, `.hide-lang-menu`, `.hide-lang-nav-items` (Task 2) match existing templatemo-style.css rules (lines 332/448/451). Contact selectors (`#contact-form-submit`, `.field-error[data-for=...]`, `#success_message`, `#error_message`) match `ContactForm.astro` from Plan 2. Mobile route list is identical across Tasks 1 and 9.

**Note for executor:** Run Tasks 1–6 (fixes) before 7–10 (gate) so the gate verifies the fixed state. Tasks 7, 8, 10 produce evidence/sign-off rather than red→green unit cycles — their "pass" is a clean report (exit 0) or a signed-off difference list, per the acceptance criteria.

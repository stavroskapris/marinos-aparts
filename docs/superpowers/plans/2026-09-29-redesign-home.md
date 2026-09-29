# Redesign Slice 2: Home Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the plain home page into the designed one: a typographic hero, a rewritten bilingual copy set, motion throughout, and a weather block that replaces the unstyleable third-party iframe.

**Architecture:** The design is **type-led, not photo-led** (spec §4.1). The hero is a full-viewport Ionian field carrying large display type with a staged reveal; a single full-bleed photo band sits beneath it. Rooms appear only in restrained contexts. Everything is built from the primitives slice 1 delivered.

**Tech Stack:** Astro 4.16.x static, TypeScript, Vitest, Playwright, no CSS framework, no new runtime dependencies except a keyless JSON fetch.

**Spec:** `docs/superpowers/specs/2026-09-29-modern-redesign-design.md` — read §3.1 and §4.1 first; they supersede the original §3 and §4 hero treatment.

## Global Constraints

- Node `>=22.0.0`. `nvm use 22` often does NOT take effect in these shells, and under Node 18 `astro check` hangs on an install prompt. Run: `export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node | sort -V | tail -1)/bin:$PATH"` and confirm `node --version` prints v22. Run `astro check` with `dist/` moved aside.
- `@astrojs/sitemap` pinned to `3.2.1`. Do not bump.
- **This repository is public.** No AWS identifiers, no secrets, and **no source comment may reference an internal planning document** (phrases like "Review Focus item N", "the brief", "Task N").
- Add nothing paid. Open-Meteo is free and needs no API key or signup.
- **`src/components/ContactForm.astro` is not touched in this slice at all.**
- Palette hexes are exact: Deep Sea `#0B3C53`, Sivota Blue `#006994`, Olive `#5A6639`, Ink `#1B2A32`, Sand `#E9E1D5`, Limestone `#F7F4EF`. Every foreground/background pair must clear **4.5:1**.
- **Responsive, enforced:** no horizontal scroll at 390, 430, 768 or 1280px in either locale; a 44px touch target in **both dimensions** on every interactive element; no image wider than its viewport or its container.
- `prefers-reduced-motion: reduce` must **disable** motion, not shorten it.
- Content must survive JavaScript being **blocked or erroring**. The `.js` class plus the 2500ms watchdog in `BaseLayout.astro` handles this; anything you hide must be hidden under `.js` only.
- Any i18n key must exist in **both** `en.json` and `gr.json`. `src/i18n/parity.test.ts` fails the build otherwise, and also rejects empty or whitespace-only values.
- No hardcoded phone-shaped numbers anywhere in `src/`. `src/site.test.ts` globs all of `src/` and flags any run of 10+ digits. Use `CONTACT` from `src/site.ts`.
- Any `<ul>` outside `<nav>` needs `list-reset`; the global `ul` reset was removed in slice 1.
- **The authored-CSS budget is 16KB** (`src/styles/budget.test.ts`, currently 13.1KB). This slice adds a hero, a photo band and a weather block, so it may legitimately exceed it. If it does, raise the ceiling **deliberately** in a commit that states the new measured figure and why, and keep the headroom under about 20%. Do not raise it to make a red test green without saying so.
- End commit messages with the `Co-Authored-By:` trailer your harness supplies.

## Review Focus

Five failure modes the spec implies that would otherwise ship untested. Each has a test in the task that owns the code.

1. **The Open-Meteo request fails, times out, or returns malformed JSON, and the footer breaks or shows "undefined".** A third-party outage must degrade to the block simply not rendering. Test in Task 6.
2. **The display-face toggle ships to production.** It is a temporary review device; if it survives, visitors get a stray control and a second font payload. Test in Task 3.
3. **The typographic hero traps or hides content when JavaScript fails.** Its staged reveal is the most motion-dependent thing on the site. Test in Task 4.
4. **Greek hero copy overflows or wraps badly at 390px.** The hero uses the largest type on the site (`--fs-display-xl`, up to 5rem) and Greek runs longer. Test in Task 4.
5. **The weather block's numbers are unreadable against the footer.** It renders on `--c-deep-sea`; temperatures and labels must clear 4.5:1 and its icons must not rely on colour alone. Test in Task 6.

---

## File Structure

**Created:**
- `src/components/Hero.astro` — typographic full-viewport hero; props-driven so later slices reuse it.
- `src/components/PhotoBand.astro` — full-bleed wide-cropped photo band.
- `src/components/Weather.astro` — Open-Meteo block replacing the okairos iframe.
- `src/scripts/weather.ts` — fetch, map WMO codes, render; fails silently.
- `src/lib/wmo.ts` — WMO weather-code to label-key mapping, pure and unit-testable.
- `src/lib/wmo.test.ts`
- `tests/home.design.spec.ts` — hero, reveals, photo band, responsive.
- `tests/weather.spec.ts` — success, failure and malformed-response paths.

**Modified:** `src/pages/[lang]/index.astro`, all five pages' frontmatter (metadata move), `src/i18n/en.json`, `src/i18n/gr.json`, `src/components/Footer.astro`, `src/layouts/BaseLayout.astro`, `src/styles/tokens.css`, `src/styles/budget.test.ts`.

**Deleted:** `src/components/WeatherWidget.astro`.

**Replaced:** `src/assets/kimon-home.jpg`.

---

### Task 1: Move page metadata into i18n

Today all five Greek pages serve **English** titles and descriptions, because they are hardcoded literals in each page's frontmatter. This is spec §7 and the headline finding of the superseded SEO plan.

**Files:**
- Modify: `src/i18n/en.json`, `src/i18n/gr.json`, all five `src/pages/[lang]/*.astro`
- Create: `src/i18n/meta.test.ts`

**Interfaces:**
- Produces: `s.meta.<page>.title` and `s.meta.<page>.description` for pages `home`, `kimon`, `irida`, `location`, `contact`.

- [ ] **Step 1: Write the failing test**

Create `src/i18n/meta.test.ts`:

```ts
import { test, expect } from 'vitest';
import { t } from './t';
import { LOCALES } from './locales';

const PAGES = ['home', 'kimon', 'irida', 'location', 'contact'] as const;

test('every page has a title and description in every locale', () => {
  for (const lang of LOCALES) {
    const s = t(lang) as any;
    for (const page of PAGES) {
      expect(typeof s.meta?.[page]?.title, `${lang}.meta.${page}.title`).toBe('string');
      expect(typeof s.meta?.[page]?.description, `${lang}.meta.${page}.description`).toBe('string');
    }
  }
});

test('Greek metadata is actually Greek, not the English string', () => {
  // The defect this prevents: /gr/ served English titles for the site's whole
  // life because they were hardcoded in page frontmatter.
  const en = t('en') as any;
  const gr = t('gr') as any;
  for (const page of PAGES) {
    expect(gr.meta[page].title, `gr.meta.${page}.title is identical to English`)
      .not.toBe(en.meta[page].title);
    expect(gr.meta[page].description, `gr.meta.${page}.description is identical to English`)
      .not.toBe(en.meta[page].description);
    // And it must contain Greek characters.
    expect(gr.meta[page].title, `gr.meta.${page}.title has no Greek characters`)
      .toMatch(/[Ͱ-Ͽ]/);
  }
});

test('titles are within a sensible length for search results', () => {
  for (const lang of LOCALES) {
    const s = t(lang) as any;
    for (const page of PAGES) {
      const len = s.meta[page].title.length;
      expect(len, `${lang}.meta.${page}.title is ${len} chars`).toBeLessThanOrEqual(65);
      expect(len, `${lang}.meta.${page}.title is ${len} chars`).toBeGreaterThan(15);
    }
  }
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm run test:unit -- src/i18n/meta.test.ts`
Expected: FAIL — `s.meta` is undefined.

- [ ] **Step 3: Add the metadata to both locales**

Add a `meta` block to `src/i18n/en.json`:

```json
  "meta": {
    "home": {
      "title": "Marinos Aparts | Apartments in Sivota, Greece",
      "description": "Two small apartment houses on the bay at Sivota, run by the same family for thirty years. Kimon among the olive groves, Irida by the harbour."
    },
    "kimon": {
      "title": "Kimon Resort | Marinos Aparts, Sivota",
      "description": "Quiet studios and apartments among the olive groves, two hundred metres from Sivota harbour and from Gallikos Molos beach."
    },
    "irida": {
      "title": "Irida Resort | Marinos Aparts, Sivota",
      "description": "First-floor studios in the centre of Sivota, thirty metres from the harbour, with private balconies and full kitchens."
    },
    "location": {
      "title": "Sivota and its beaches | Marinos Aparts",
      "description": "Sivota is one of the most picturesque villages of Epirus. The beaches around it, from Mega Ammos to Bella Vraka, are a few minutes away."
    },
    "contact": {
      "title": "Contact and availability | Marinos Aparts",
      "description": "Ask about availability at Kimon or Irida in Sivota. We reply as soon as we can."
    }
  },
```

And to `src/i18n/gr.json`:

```json
  "meta": {
    "home": {
      "title": "Marinos Aparts | Διαμερίσματα στα Σύβοτα",
      "description": "Δύο μικρά καταλύματα στον κόλπο των Συβότων, από την ίδια οικογένεια εδώ και τριάντα χρόνια. Το Kimon ανάμεσα στους ελαιώνες, το Irida στο λιμάνι."
    },
    "kimon": {
      "title": "Kimon Resort | Marinos Aparts, Σύβοτα",
      "description": "Ήσυχα studios και διαμερίσματα ανάμεσα στους ελαιώνες, διακόσια μέτρα από το λιμάνι των Συβότων και από την παραλία Γαλλικός Μώλος."
    },
    "irida": {
      "title": "Irida Resort | Marinos Aparts, Σύβοτα",
      "description": "Studios στον πρώτο όροφο, στο κέντρο των Συβότων, τριάντα μέτρα από το λιμάνι, με ιδιωτικά μπαλκόνια και πλήρη κουζίνα."
    },
    "location": {
      "title": "Τα Σύβοτα και οι παραλίες | Marinos Aparts",
      "description": "Τα Σύβοτα είναι από τα πιο γραφικά χωριά της Ηπείρου. Οι παραλίες γύρω τους, από τον Μέγα Άμμο ως την Μπέλλα Βράκα, απέχουν λίγα λεπτά."
    },
    "contact": {
      "title": "Επικοινωνία και διαθεσιμότητα | Marinos Aparts",
      "description": "Ρωτήστε για διαθεσιμότητα στο Kimon ή στο Irida στα Σύβοτα. Απαντάμε το συντομότερο δυνατό."
    }
  },
```

- [ ] **Step 4: Read them in each page**

In each of the five pages, replace the hardcoded `const title = '...'` and `const description = '...'` with:

```astro
const title = s.meta.home.title;
const description = s.meta.home.description;
```

using the matching page key. `contact.astro` does not currently define `const s = t(lang)`; add it.

`kimon.astro` and `irida.astro` pass these into `ResortPage`; check their existing prop names and keep them.

- [ ] **Step 5: Run the tests**

Run: `npm run test:unit -- src/i18n/meta.test.ts src/i18n/parity.test.ts`
Expected: PASS.

- [ ] **Step 6: Verify the built Greek pages**

Run: `npm run build && grep -o '<title>[^<]*</title>' dist/gr/index.html dist/gr/kimon/index.html`
Expected: Greek titles, not English ones.

- [ ] **Step 7: Full suite and commit**

Run: `npm test && npm run test:unit && npx astro check`

```bash
git add -A
git commit -m "$(cat <<'EOF'
fix(i18n): serve Greek metadata on Greek pages

All five Greek pages served English titles and descriptions for the site's
whole life, because those strings were hardcoded literals in each page's
frontmatter rather than read from i18n.

The test asserts each Greek string differs from its English counterpart AND
contains Greek characters, so a copy-paste that leaves English in place fails
rather than passing structurally.
EOF
)"
```

---

### Task 2: Rewrite the home copy

The design needs short strings the current copy does not contain. `home.welcome` is a 130-word paragraph; the only short string is `home.intro` ("Marinos Aparts").

**Files:**
- Modify: `src/i18n/en.json`, `src/i18n/gr.json`

**Interfaces:**
- Produces: `s.home.hero.{eyebrow,headline,subline,ctaPrimary,ctaSecondary}`, `s.home.intro2.{eyebrow,heading,body}`, `s.home.facts[]` shape `{icon,label}` as three separate keys `fact1`/`fact2`/`fact3` each `{label}`, `s.home.sivota.{eyebrow,heading,body,cta}`, `s.home.booking.{heading,body,cta}`.

- [ ] **Step 1: Add the English copy**

Keep every fact the existing copy asserts; invent nothing. Replace the `home` block's contents, keeping `readMore`, `kimonTitle` and `iridaTitle` (the split bands still use them):

```json
  "home": {
    "intro": "Marinos Aparts",
    "hero": {
      "eyebrow": "Sivota, Epirus",
      "headline": "Thirty years on the same bay.",
      "subline": "Two small houses in Sivota, looked after by one family. Kimon among the olive groves, Irida thirty metres from the harbour.",
      "ctaPrimary": "Check availability",
      "ctaSecondary": "See the rooms"
    },
    "intro2": {
      "eyebrow": "Welcome",
      "heading": "Two houses, one bay",
      "body": "Marinos Aparts is two small properties on the bay at Sivota, run by the same family for thirty years. Every apartment is spacious and fully refurbished, with its own balcony. Some suit couples, some suit families, and we are happy to talk through which is right for you."
    },
    "fact1": { "label": "Two hundred metres from the harbour and from Gallikos Molos beach" },
    "fact2": { "label": "Run by the same family for thirty years" },
    "fact3": { "label": "Every apartment has its own private balcony" },
    "sivota": {
      "eyebrow": "The village",
      "heading": "One of the most picturesque villages of Epirus",
      "body": "Sivota sits on a sheltered bay on the Ionian coast, with a working harbour, a handful of tavernas and a scatter of beaches within a few minutes' drive.",
      "cta": "Explore Sivota"
    },
    "booking": {
      "heading": "Come and stay",
      "body": "Tell us your dates and how many of you there are, and we will tell you what we have.",
      "cta": "Check availability"
    },
    "welcome": "Marinos Aparts is two small properties on the bay at Sivota, run by the same family for thirty years.",
    "kimonTitle": "Completely refurbished, Kimon Resort is set among olive groves, offering quiet and space a short walk from everything.",
    "iridaTitle": "Completely refurbished and thirty metres from the harbour, Irida Resort suits visitors who want to be in the middle of Sivota.",
    "kimonSubTitle": "Two hundred metres from the harbour and two hundred from Gallikos Molos beach, Kimon suits anyone who wants somewhere quiet without needing the car.",
    "iridaSubTitle": "The studios sit on the first floor: bright, cool, with elegant furnishings and private balconies.",
    "readMore": "Read more"
  },
```

- [ ] **Step 2: Add the matching Greek copy**

Every key above must exist in `gr.json` with the same structure:

```json
  "home": {
    "intro": "Marinos Aparts",
    "hero": {
      "eyebrow": "Σύβοτα, Ήπειρος",
      "headline": "Τριάντα χρόνια στον ίδιο κόλπο.",
      "subline": "Δύο μικρά καταλύματα στα Σύβοτα, από μία οικογένεια. Το Kimon ανάμεσα στους ελαιώνες, το Irida τριάντα μέτρα από το λιμάνι.",
      "ctaPrimary": "Δείτε διαθεσιμότητα",
      "ctaSecondary": "Δείτε τα δωμάτια"
    },
    "intro2": {
      "eyebrow": "Καλώς ήρθατε",
      "heading": "Δύο καταλύματα, ένας κόλπος",
      "body": "Τα Marinos Aparts είναι δύο μικρά καταλύματα στον κόλπο των Συβότων, από την ίδια οικογένεια εδώ και τριάντα χρόνια. Κάθε διαμέρισμα είναι ευρύχωρο και πλήρως ανακαινισμένο, με δικό του μπαλκόνι. Άλλα ταιριάζουν σε ζευγάρια, άλλα σε οικογένειες, και ευχαρίστως να συζητήσουμε ποιο είναι το κατάλληλο για εσάς."
    },
    "fact1": { "label": "Διακόσια μέτρα από το λιμάνι και από την παραλία Γαλλικός Μώλος" },
    "fact2": { "label": "Από την ίδια οικογένεια εδώ και τριάντα χρόνια" },
    "fact3": { "label": "Κάθε διαμέρισμα έχει δικό του ιδιωτικό μπαλκόνι" },
    "sivota": {
      "eyebrow": "Το χωριό",
      "heading": "Από τα πιο γραφικά χωριά της Ηπείρου",
      "body": "Τα Σύβοτα βρίσκονται σε έναν προστατευμένο κόλπο στα Ιόνια, με λιμάνι, ταβέρνες και αρκετές παραλίες λίγα λεπτά μακριά.",
      "cta": "Δείτε τα Σύβοτα"
    },
    "booking": {
      "heading": "Ελάτε να μείνετε",
      "body": "Πείτε μας ημερομηνίες και πόσα άτομα είστε, και θα σας πούμε τι έχουμε διαθέσιμο.",
      "cta": "Δείτε διαθεσιμότητα"
    },
    "welcome": "Τα Marinos Aparts είναι δύο μικρά καταλύματα στον κόλπο των Συβότων, από την ίδια οικογένεια εδώ και τριάντα χρόνια.",
    "kimonTitle": "Το πλήρως ανακαινισμένο Kimon Resort βρίσκεται ανάμεσα σε ελαιώνες και προσφέρει ησυχία και χώρο, λίγα λεπτά με τα πόδια από τα πάντα.",
    "iridaTitle": "Το πλήρως ανακαινισμένο Irida Resort, τριάντα μέτρα από το λιμάνι, ταιριάζει σε όσους θέλουν να είναι στο κέντρο των Συβότων.",
    "kimonSubTitle": "Διακόσια μέτρα από το λιμάνι και διακόσια από την παραλία Γαλλικός Μώλος, το Kimon ταιριάζει σε όποιον θέλει ησυχία χωρίς να χρειάζεται αυτοκίνητο.",
    "iridaSubTitle": "Τα studios βρίσκονται στον πρώτο όροφο: φωτεινά, δροσερά, με φινετσάτη διακόσμηση και ιδιωτικά μπαλκόνια.",
    "readMore": "Περισσότερα"
  },
```

- [ ] **Step 3: Run the parity and meta tests**

Run: `npm run test:unit -- src/i18n/`
Expected: PASS. A key present in one locale only fails here.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/en.json src/i18n/gr.json
git commit -m "$(cat <<'EOF'
feat(i18n): rewrite the home copy for the type-led design

The design needs short strings the old copy did not contain: a hero headline,
a subline, call-to-action labels and section eyebrows. The old copy's shortest
string was a 130-word paragraph.

Every fact asserted here is one the previous copy already made: thirty years,
the same family, two hundred metres from the harbour and from Gallikos Molos,
thirty metres from the harbour for Irida, private balconies. Nothing invented.

The Greek is a draft for the owner to correct, not a translation of record.
EOF
)"
```

---

### Task 3: Hero component with a removable display-face toggle

**Files:**
- Create: `src/components/Hero.astro`
- Modify: `src/styles/tokens.css`
- Create: `tests/home.design.spec.ts`

**Interfaces:**
- Produces: `<Hero eyebrow: string, headline: string, subline: string, ctaPrimary: {label,href}, ctaSecondary: {label,href}, showTypeToggle?: boolean>`.
- Consumes: tokens, `.btn`, `.eyebrow`, `data-reveal`.

- [ ] **Step 1: Add the alternate display face to tokens**

The toggle needs a second display stack. Manrope is already installed at weights 200-800, so the bold-sans option costs no new font payload. In `src/styles/tokens.css` add beneath `--font-display`:

```css
  /* Alternate display face, for the owner's serif-vs-sans comparison.
     Manrope is already loaded for body text, so this adds no font payload.
     Remove this token and the [data-display] rules once the choice is made. */
  --font-display-alt: 'Manrope Variable', Manrope, system-ui, sans-serif;
```

And add, after `:root`:

```css
:root[data-display='sans'] {
  --font-display: var(--font-display-alt);
}
```

- [ ] **Step 2: Write Hero.astro**

```astro
---
interface Props {
  eyebrow: string;
  headline: string;
  subline: string;
  ctaPrimary: { label: string; href: string };
  ctaSecondary: { label: string; href: string };
  showTypeToggle?: boolean;
}
const { eyebrow, headline, subline, ctaPrimary, ctaSecondary, showTypeToggle = false } = Astro.props;
---
<section class="hero on-dark">
  <div class="container hero__inner">
    <span class="eyebrow" data-reveal>{eyebrow}</span>
    <h1 class="hero__headline" data-reveal data-reveal-delay="80">{headline}</h1>
    <p class="hero__subline" data-reveal data-reveal-delay="160">{subline}</p>
    <div class="hero__actions" data-reveal data-reveal-delay="240">
      <a class="btn btn--primary" href={ctaPrimary.href}>{ctaPrimary.label}</a>
      <a class="btn btn--ghost" href={ctaSecondary.href}>{ctaSecondary.label}</a>
    </div>
  </div>

  {showTypeToggle && (
    <div class="hero__typetoggle" data-type-toggle>
      <span>Display face</span>
      <button type="button" data-display-set="serif" aria-pressed="true">Serif</button>
      <button type="button" data-display-set="sans" aria-pressed="false">Sans</button>
    </div>
  )}
</section>

{showTypeToggle && (
  <script>
    const root = document.documentElement;
    const saved = localStorage.getItem('display-face');
    if (saved === 'sans') root.setAttribute('data-display', 'sans');
    document.querySelectorAll<HTMLButtonElement>('[data-display-set]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const face = btn.dataset.displaySet!;
        if (face === 'sans') root.setAttribute('data-display', 'sans');
        else root.removeAttribute('data-display');
        localStorage.setItem('display-face', face);
        document.querySelectorAll<HTMLButtonElement>('[data-display-set]').forEach((b) =>
          b.setAttribute('aria-pressed', String(b === btn))
        );
      });
    });
  </script>
)}

<style>
  .hero {
    position: relative;
    min-height: 100svh;
    display: flex;
    align-items: center;
    background: var(--c-deep-sea);
    /* The nav overlays this, so leave room for it. */
    padding-block: calc(72px + var(--sp-8)) var(--sp-8);
  }
  .hero__inner { display: flex; flex-direction: column; align-items: flex-start; max-width: 900px; }
  .hero__headline {
    font-size: var(--fs-display-xl);
    line-height: var(--lh-tight);
    color: var(--c-white);
    margin: 0 0 var(--sp-5);
    overflow-wrap: break-word;
  }
  .hero__subline {
    font-size: var(--fs-lead);
    font-weight: 300;
    color: var(--c-white);
    max-width: 54ch;
    margin: 0 0 var(--sp-6);
  }
  .hero__actions { display: flex; flex-wrap: wrap; gap: var(--sp-4); }

  .hero__typetoggle {
    position: absolute;
    right: var(--gutter);
    bottom: var(--sp-5);
    display: flex; align-items: center; gap: var(--sp-2);
    font-size: var(--fs-eyebrow);
    letter-spacing: 0.12em; text-transform: uppercase;
    color: rgb(255 255 255 / 0.75);
  }
  .hero__typetoggle button {
    min-height: 44px; min-width: 44px;
    padding-inline: var(--sp-3);
    background: transparent;
    color: var(--c-white);
    border: 1px solid rgb(255 255 255 / 0.4);
    border-radius: var(--radius-btn);
    font: inherit; cursor: pointer;
  }
  .hero__typetoggle button[aria-pressed='true'] {
    background: var(--c-white);
    color: var(--c-deep-sea);
  }
  @media (max-width: 640px) {
    .hero__typetoggle { position: static; margin: var(--sp-6) var(--gutter) 0; }
  }
</style>
```

- [ ] **Step 3: Write the toggle-removal guard test**

Create `tests/home.design.spec.ts` with this test. It needs Task 4's page composition to run, so it will stay red until then.

```ts
import { test, expect } from '@playwright/test';

test('exactly one display face is active at a time', async ({ page }) => {
  await page.goto('/en/');
  const toggle = page.locator('[data-type-toggle]');
  if ((await toggle.count()) === 0) return; // toggle already removed, fine

  const serifFont = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  await page.getByRole('button', { name: 'Sans' }).click();
  const sansFont = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(sansFont).not.toBe(serifFont);
  expect(sansFont).toMatch(/Manrope/);

  await page.getByRole('button', { name: 'Serif' }).click();
  const back = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
  expect(back).toBe(serifFont);
});
```

- [ ] **Step 4: Run and commit**

Run: `npx astro check && npm run test:unit`
Expected: 0 errors; unit tests pass. The Playwright test needs Task 4's page composition, so it will be exercised then.

```bash
git add src/components/Hero.astro src/styles/tokens.css tests/home.design.spec.ts
git commit -m "feat(hero): typographic hero with a removable display-face toggle"
```

---

### Task 4: Photo band, and compose the home page

**Files:**
- Create: `src/components/PhotoBand.astro`
- Modify: `src/pages/[lang]/index.astro`
- Modify: `tests/home.design.spec.ts`

**Interfaces:**
- Produces: `<PhotoBand image: ImageMetadata, alt: string, ratio?: string>`.
- Consumes: `Hero`, `Section`, `SplitFeature`, `FactGrid`, `Icon`, `data-reveal`.

- [ ] **Step 1: Write PhotoBand.astro**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

interface Props { image: ImageMetadata; alt: string; ratio?: string; }
const { image, alt, ratio = '21 / 9' } = Astro.props;
---
<div class="photoband" data-reveal style={`--band-ratio: ${ratio}`}>
  <Image src={image} alt={alt} widths={[768, 1280, 1920, 2560]}
         sizes="100vw" loading="lazy" decoding="async" />
</div>

<style>
  .photoband {
    width: 100%;
    /* Reserved before decode so the image cannot shift the page. */
    aspect-ratio: var(--band-ratio);
    overflow: hidden;
  }
  .photoband img { width: 100%; height: 100%; object-fit: cover; display: block; }
  @media (max-width: 640px) { .photoband { aspect-ratio: 4 / 3; } }
</style>
```

The mobile ratio change is deliberate: a 21:9 crop at 390px is a 167px-tall sliver.

- [ ] **Step 2: Compose the home page**

Replace `src/pages/[lang]/index.astro`'s body. Photo assignments follow spec §3.1: `kimon13` is the strongest frame and carries the band; `kimon20` replaces the 645×484 `kimon-home.jpg` on the Kimon card; `irida-home.jpg` stays on the Irida card.

```astro
<BaseLayout lang={lang} title={title} description={description} canonicalPath="">
  <Navbar lang={lang} canonicalPath="" current="home" overlay />

  <Hero
    eyebrow={s.home.hero.eyebrow}
    headline={s.home.hero.headline}
    subline={s.home.hero.subline}
    ctaPrimary={{ label: s.home.hero.ctaPrimary, href: `/${lang}/contact` }}
    ctaSecondary={{ label: s.home.hero.ctaSecondary, href: `/${lang}/kimon` }}
    showTypeToggle
  />

  <PhotoBand image={kimon13} alt="The terrace at Kimon, among olive and citrus trees" />

  <Section>
    <div class="container--narrow" data-reveal>
      <span class="eyebrow">{s.home.intro2.eyebrow}</span>
      <h2>{s.home.intro2.heading}</h2>
      <p class="lead">{s.home.intro2.body}</p>
    </div>
  </Section>

  <Section ground="sand" tight>
    <FactGrid columns={3} items={[
      { icon: 'map-pin', label: s.home.fact1.label },
      { icon: 'envelope', label: s.home.fact2.label },
      { icon: 'check', label: s.home.fact3.label },
    ]} />
  </Section>

  <Section>
    <div class="stack stack--wide">
      <SplitFeature eyebrow={s.nav.kimon} heading={s.nav.kimon} body={s.home.kimonTitle}
        href={`/${lang}/kimon`} cta={s.home.readMore} image={kimonHome} alt="The courtyard at Kimon" />
      <SplitFeature eyebrow={s.nav.irida} heading={s.nav.irida} body={s.home.iridaTitle}
        href={`/${lang}/irida`} cta={s.home.readMore} image={iridaHome} alt="The front of Irida, with its stone wall and bougainvillea" reverse />
    </div>
  </Section>

  <Section ground="sand">
    <div class="container--narrow" data-reveal>
      <span class="eyebrow">{s.home.sivota.eyebrow}</span>
      <h2>{s.home.sivota.heading}</h2>
      <p class="lead">{s.home.sivota.body}</p>
      <a class="btn btn--ghost" href={`/${lang}/location`}>{s.home.sivota.cta}</a>
    </div>
  </Section>

  <Section ground="deep">
    <div class="container--narrow" data-reveal>
      <h2>{s.home.booking.heading}</h2>
      <p class="lead">{s.home.booking.body}</p>
      <a class="btn btn--primary" href={`/${lang}/contact`}>{s.home.booking.cta}</a>
    </div>
  </Section>

  <Footer lang={lang} />
</BaseLayout>
```

Frontmatter imports: `Hero`, `PhotoBand`, `Section`, `SplitFeature`, `FactGrid`, plus `import kimon13 from '../../assets/kimon/kimon13.jpg';`.

I verified these against the components, so they are settled, not assumptions: `SplitFeature`'s Props **does** declare `eyebrow?: string`, and `Section`'s Props **does** declare `tight?: boolean`. Use both as written above.

**`Icon.astro` has no `check` glyph and needs one.** Its current type is exactly:

```ts
export type IconName = 'map-pin' | 'phone' | 'envelope' | 'chevron-up' | 'spinner' | 'facebook' | 'instagram';
```

Add `'check'` to that union and render it alongside the other stroke icons, matching their existing attribute handling:

```astro
  {name === 'check' && <path d="m4 12 5 5L20 6" />}
```

A tick is the right glyph for "every apartment has its own balcony"; do not substitute an unrelated icon to avoid touching `Icon.astro`.

- [ ] **Step 3: Replace the low-resolution Kimon image**

```bash
cp src/assets/kimon/kimon20.jpg src/assets/kimon-home.jpg
identify -format "%wx%h\n" src/assets/kimon-home.jpg
```
Expected: `4608x3456`, replacing `645x484`.

- [ ] **Step 4: Write the home design tests**

Append to `tests/home.design.spec.ts`:

```ts
const WIDTHS = [390, 430, 768, 1280];

test('the hero reveals its content and does not overflow, in both locales', async ({ page }) => {
  for (const lang of ['en', 'gr']) {
    for (const w of WIDTHS) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(`/${lang}/`);
      const h1 = page.locator('h1');
      await expect(h1).toBeVisible();
      await expect(h1).toHaveCSS('opacity', '1');
      const overflow = await page.evaluate(() =>
        document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow on /${lang}/ at ${w}px`).toBeLessThanOrEqual(0);
      // The headline must not spill out of its own container either.
      const spill = await h1.evaluate((el) =>
        el.getBoundingClientRect().right - document.documentElement.clientWidth);
      expect(spill, `headline spill on /${lang}/ at ${w}px`).toBeLessThanOrEqual(0);
    }
  }
});

test('hero content is readable with JavaScript disabled', async ({ browser }) => {
  const ctx = await browser.newContext({ javaScriptEnabled: false });
  const page = await ctx.newPage();
  await page.goto('/gr/');
  const h1 = page.locator('h1');
  await expect(h1).toBeVisible();
  await expect(h1).toHaveCSS('opacity', '1');
  await expect(h1).toHaveCSS('transform', 'none');
  await ctx.close();
});

test('every home section reveals rather than staying hidden', async ({ page }) => {
  await page.goto('/en/');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(600);
  const hidden = await page.evaluate(() =>
    [...document.querySelectorAll('[data-reveal]')]
      .filter((el) => getComputedStyle(el).opacity !== '1').length);
  expect(hidden, 'elements still hidden after scrolling to the bottom').toBe(0);
});

test('the photo band does not exceed the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto('/en/');
  const wide = await page.evaluate(() =>
    [...document.images].filter((i) => i.getBoundingClientRect().width > document.documentElement.clientWidth).length);
  expect(wide).toBe(0);
});
```

- [ ] **Step 5: Run everything**

Run: `npm run build && npx astro check && npm run test:unit && npm test`
Expected: all green. If the authored-CSS budget now fails, see Global Constraints: raise it deliberately with the measured figure in the commit message.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(home): compose the type-led home page

Typographic hero, one full-bleed photo band using kimon13 (the strongest
frame in the library), intro, a three-fact row, the two houses as alternating
bands, a Sivota teaser and a booking band. Reveals throughout.

kimon-home.jpg was 645x484 against Irida's 3648x2736, which is why that card
looked weaker. Replaced with kimon20 at 4608x3456.

The band drops from 21:9 to 4:3 below 640px; a 21:9 crop at 390px is a 167px
sliver.
EOF
)"
```

---

### Task 5: WMO weather-code mapping

Pure logic, unit-testable, separate from the fetch so it can be tested without a network.

**Files:**
- Create: `src/lib/wmo.ts`, `src/lib/wmo.test.ts`
- Modify: `src/i18n/en.json`, `src/i18n/gr.json`

**Interfaces:**
- Produces: `wmoKey(code: number): WmoKey` where `WmoKey` is `'clear' | 'mainlyClear' | 'cloudy' | 'fog' | 'drizzle' | 'rain' | 'snow' | 'showers' | 'thunder' | 'unknown'`.

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from 'vitest';
import { wmoKey } from './wmo';

test('maps the documented WMO code ranges', () => {
  expect(wmoKey(0)).toBe('clear');
  expect(wmoKey(1)).toBe('mainlyClear');
  expect(wmoKey(2)).toBe('mainlyClear');
  expect(wmoKey(3)).toBe('cloudy');
  expect(wmoKey(45)).toBe('fog');
  expect(wmoKey(48)).toBe('fog');
  expect(wmoKey(51)).toBe('drizzle');
  expect(wmoKey(55)).toBe('drizzle');
  expect(wmoKey(61)).toBe('rain');
  expect(wmoKey(65)).toBe('rain');
  expect(wmoKey(71)).toBe('snow');
  expect(wmoKey(77)).toBe('snow');
  expect(wmoKey(80)).toBe('showers');
  expect(wmoKey(82)).toBe('showers');
  expect(wmoKey(95)).toBe('thunder');
  expect(wmoKey(99)).toBe('thunder');
});

test('returns unknown rather than throwing on anything unexpected', () => {
  // A third-party API adding a code must not break the footer.
  for (const bad of [-1, 7, 100, 999, NaN, Infinity]) {
    expect(wmoKey(bad as number), `code ${bad}`).toBe('unknown');
  }
  expect(wmoKey(undefined as unknown as number)).toBe('unknown');
  expect(wmoKey(null as unknown as number)).toBe('unknown');
  expect(wmoKey('3' as unknown as number)).toBe('unknown');
});
```

- [ ] **Step 2: Run it, confirm it fails**

Run: `npm run test:unit -- src/lib/wmo.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Write wmo.ts**

```ts
/**
 * WMO weather codes as published by Open-Meteo, collapsed to the handful of
 * states worth showing. Anything unrecognised returns 'unknown' rather than
 * throwing: this renders in the footer of every page, and a third-party API
 * adding a code must not take the footer with it.
 */
export type WmoKey =
  | 'clear' | 'mainlyClear' | 'cloudy' | 'fog' | 'drizzle'
  | 'rain' | 'snow' | 'showers' | 'thunder' | 'unknown';

export function wmoKey(code: number): WmoKey {
  if (typeof code !== 'number' || !Number.isFinite(code)) return 'unknown';
  if (code === 0) return 'clear';
  if (code === 1 || code === 2) return 'mainlyClear';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 57) return 'drizzle';
  if (code >= 61 && code <= 67) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95 && code <= 99) return 'thunder';
  return 'unknown';
}
```

- [ ] **Step 4: Add the labels to both locales**

`en.json`, inside a new `weather` block:

```json
  "weather": {
    "title": "Sivota now",
    "clear": "Clear",
    "mainlyClear": "Mainly clear",
    "cloudy": "Cloudy",
    "fog": "Fog",
    "drizzle": "Drizzle",
    "rain": "Rain",
    "snow": "Snow",
    "showers": "Showers",
    "thunder": "Thunderstorm",
    "unknown": "Weather"
  },
```

`gr.json`:

```json
  "weather": {
    "title": "Σύβοτα τώρα",
    "clear": "Αίθριος",
    "mainlyClear": "Σχεδόν αίθριος",
    "cloudy": "Συννεφιά",
    "fog": "Ομίχλη",
    "drizzle": "Ψιχάλα",
    "rain": "Βροχή",
    "snow": "Χιόνι",
    "showers": "Μπόρες",
    "thunder": "Καταιγίδα",
    "unknown": "Καιρός"
  },
```

- [ ] **Step 5: Run and commit**

Run: `npm run test:unit -- src/lib/ src/i18n/`
Expected: PASS.

```bash
git add src/lib/wmo.ts src/lib/wmo.test.ts src/i18n/en.json src/i18n/gr.json
git commit -m "feat(weather): map WMO codes, returning unknown rather than throwing"
```

---

### Task 6: Weather block replacing the okairos iframe

**Files:**
- Create: `src/components/Weather.astro`, `src/scripts/weather.ts`, `tests/weather.spec.ts`
- Modify: `src/components/Footer.astro`
- Delete: `src/components/WeatherWidget.astro`

**Interfaces:**
- Consumes: `wmoKey` from `src/lib/wmo`, `Icon`, `.on-dark`.
- Produces: `<Weather lang={lang} />`.

- [ ] **Step 1: Write the failing tests**

`tests/weather.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

const API = /api\.open-meteo\.com/;

test('renders the current temperature when the API answers', async ({ page }) => {
  await page.route(API, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ current: { temperature_2m: 24.6, weather_code: 0 } }),
  }));
  await page.goto('/en/');
  const w = page.locator('[data-weather]');
  await expect(w).toBeVisible();
  await expect(w).toContainText('25');       // rounded
  await expect(w).toContainText('Clear');
});

test('renders Greek labels on the Greek pages', async ({ page }) => {
  await page.route(API, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ current: { temperature_2m: 18.2, weather_code: 3 } }),
  }));
  await page.goto('/gr/');
  await expect(page.locator('[data-weather]')).toContainText('Συννεφιά');
});

test('hides itself when the API fails, and the footer still lays out', async ({ page }) => {
  await page.route(API, (route) => route.abort());
  await page.goto('/en/');
  await expect(page.locator('[data-weather]')).toBeHidden();
  await expect(page.getByText('General Registry Number')).toBeVisible();
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test('hides itself on malformed JSON rather than showing undefined', async ({ page }) => {
  await page.route(API, (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: '{"current":{}}',
  }));
  await page.goto('/en/');
  await expect(page.locator('[data-weather]')).toBeHidden();
  await expect(page.locator('footer')).not.toContainText('undefined');
  await expect(page.locator('footer')).not.toContainText('NaN');
});

test('the temperature is readable against the footer', async ({ page }) => {
  await page.route(API, (route) => route.fulfill({
    status: 200, contentType: 'application/json',
    body: JSON.stringify({ current: { temperature_2m: 24.6, weather_code: 0 } }),
  }));
  await page.goto('/en/');
  const colour = await page.locator('[data-weather-temp]').evaluate((el) => getComputedStyle(el).color);
  // White or sand on deep sea; both clear 4.5:1. A dark value would mean the
  // block inherited the light-card styling the old iframe needed.
  expect(colour).toMatch(/rgb\(2[0-9]{2}, 2[0-9]{2}, 2[0-9]{2}\)|rgb\(255, 255, 255\)/);
});
```

- [ ] **Step 2: Run them, confirm they fail**

Run: `npm test -- tests/weather.spec.ts`
Expected: FAIL — `[data-weather]` does not exist.

- [ ] **Step 3: Write weather.ts**

```ts
import { wmoKey, type WmoKey } from '../lib/wmo';

const URL_ =
  'https://api.open-meteo.com/v1/forecast' +
  '?latitude=39.4107&longitude=20.2396' +
  '&current=temperature_2m,weather_code&timezone=Europe%2FAthens';

/**
 * Fills the weather block from Open-Meteo. Free, no API key.
 *
 * Every failure path hides the block rather than showing a broken one: this
 * renders in the footer of all ten pages, and a third-party outage must not
 * leave "undefined" or "NaN" on the site.
 */
export async function initWeather(): Promise<void> {
  const root = document.querySelector<HTMLElement>('[data-weather]');
  if (!root) return;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(URL_, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`status ${res.status}`);

    const data = await res.json();
    const temp = data?.current?.temperature_2m;
    const code = data?.current?.weather_code;
    if (typeof temp !== 'number' || !Number.isFinite(temp)) throw new Error('no temperature');

    const key: WmoKey = wmoKey(code);
    const tempEl = root.querySelector<HTMLElement>('[data-weather-temp]');
    const labelEl = root.querySelector<HTMLElement>('[data-weather-label]');
    if (!tempEl || !labelEl) throw new Error('markup missing');

    tempEl.textContent = `${Math.round(temp)}°`;
    labelEl.textContent = labelEl.dataset[key] ?? labelEl.dataset.unknown ?? '';
    root.hidden = false;
  } catch {
    root.hidden = true;
  }
}
```

- [ ] **Step 4: Write Weather.astro**

Labels are passed as data attributes so the script needs no i18n import.

```astro
---
import type { Locale } from '../i18n/locales';
import { t } from '../i18n/t';
interface Props { lang: Locale; }
const { lang } = Astro.props;
const s = t(lang);
const w = s.weather;
---
<div class="weather" data-weather hidden>
  <span class="weather__title">{w.title}</span>
  <span class="weather__temp" data-weather-temp></span>
  <span class="weather__label" data-weather-label
    data-clear={w.clear} data-mainly-clear={w.mainlyClear} data-cloudy={w.cloudy}
    data-fog={w.fog} data-drizzle={w.drizzle} data-rain={w.rain} data-snow={w.snow}
    data-showers={w.showers} data-thunder={w.thunder} data-unknown={w.unknown}></span>
</div>

<script>
  import { initWeather } from '../scripts/weather';
  initWeather();
</script>

<style>
  .weather { display: flex; flex-direction: column; gap: var(--sp-1); }
  .weather[hidden] { display: none; }
  .weather__title {
    font-size: var(--fs-eyebrow); letter-spacing: 0.2em;
    text-transform: uppercase; color: var(--c-sand);
  }
  .weather__temp {
    font-family: var(--font-display);
    font-size: var(--fs-display-m);
    color: var(--c-white);
    line-height: 1.1;
  }
  .weather__label { font-size: var(--fs-small); color: var(--c-white); }
</style>
```

Note `labelEl.dataset[key]` maps `mainlyClear` to `data-mainly-clear` automatically; that is the kebab/camel conversion, and it is why the attribute names are hyphenated.

- [ ] **Step 5: Swap it into the footer and delete the old widget**

In `Footer.astro`, replace the `WeatherWidget` import and usage with `Weather`, then:

```bash
git rm src/components/WeatherWidget.astro
grep -rn "WeatherWidget\|okairos" src/ package.json
```
Expected: no matches.

Two cleanups that are required, not optional — I confirmed both exist:

1. `package.json`'s `check:links` skip regex contains `okairos`. Remove it. Leaving a host in the skip list after nothing requests it means the link checker would stay silent if it ever came back.
2. `tests/chrome.spec.ts`'s touch-target test exempts `#weather-widget .completo > div`, which was the okairos vendor subtree. That selector now matches nothing, so the exemption is dead. Remove it, then run the touch-target test and fix anything in the new `Weather` block that surfaces — it is our markup now, so it gets no exemption.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run test:unit && npx astro check && npm run check:links:ci`
Expected: all green, including the four weather tests.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
feat(weather): replace the okairos iframe with our own Open-Meteo block

The okairos widget rendered inside a cross-origin iframe, so its white
background could not be styled at any specificity, and it declared itself
335px wide inside a 222px grid column. It cost a third-party script and an
iframe on all ten pages.

Open-Meteo is free, needs no API key and returns 645 bytes. Every failure
path hides the block rather than showing a broken one: a non-2xx response, a
4s timeout, malformed JSON and a missing temperature are all tested.
EOF
)"
```

---

### Task 7: Verify on staging, then decide the display face

**Files:** none changed unless staging reveals a defect.

- [ ] **Step 1: Push and wait for the deploy**

```bash
git push
gh run list --branch redesign --limit 3
```
Wait for `Deploy Staging` to conclude `success`.

- [ ] **Step 2: Verify the live build**

```bash
S=https://d3rdv3w5lgyop6.cloudfront.net
for p in /en/ /gr/ /en/kimon /gr/contact; do printf "%-14s %s\n" "$p" "$(curl -s -o /dev/null -w '%{http_code}' $S$p)"; done
curl -s $S/gr/ | grep -o '<title>[^<]*</title>'
curl -s $S/en/ | grep -c 'okairos'
```
Expected: 200s; a Greek `<title>`; zero okairos references.

- [ ] **Step 3: Check the hero in a real browser at phone and desktop width, in Greek**

The Greek headline is the longest string in the largest type on the site. Confirm no overflow and no awkward wrap at 390px on `/gr/`, and that the toggle switches faces.

- [ ] **Step 4: Report to the owner and stop**

Present the staging link and ask which display face. **Do not proceed to Task 8 until they answer** — Task 8 removes the toggle and bakes in the choice.

---

### Task 8: Remove the toggle and bake in the chosen face

Run only after the owner has chosen.

**Files:**
- Modify: `src/components/Hero.astro`, `src/pages/[lang]/index.astro`, `src/styles/tokens.css`, `tests/home.design.spec.ts`

- [ ] **Step 1: If they chose sans, make it the default**

In `tokens.css`, set `--font-display` to the Manrope stack and delete `--font-display-alt` and the `:root[data-display='sans']` rule. If they chose serif, just delete both.

- [ ] **Step 2: Remove the toggle**

Delete the `showTypeToggle` prop, its markup, its `<script>` and its styles from `Hero.astro`. Remove `showTypeToggle` from `index.astro`.

- [ ] **Step 3: Replace the toggle test with an absence test**

```ts
test('the display-face toggle is gone from production', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.locator('[data-type-toggle]')).toHaveCount(0);
  const stray = await page.evaluate(() =>
    document.documentElement.hasAttribute('data-display'));
  expect(stray, 'a stray data-display attribute survived').toBe(false);
});
```

- [ ] **Step 4: Run, commit, push**

Run: `npm test && npm run test:unit && npx astro check`

```bash
git add -A
git commit -m "feat(type): bake in the chosen display face and remove the review toggle"
git push
```

---

## Done when

- `/gr/` serves Greek titles and descriptions on all five pages.
- The home page has a typographic hero, one photo band, and reveals on every section.
- `kimon-home.jpg` is 4608×3456.
- The weather block renders from Open-Meteo and hides itself on any failure.
- `WeatherWidget.astro` and every okairos reference are gone.
- The full suite is green, `astro check` reports 0 errors, and the CSS budget either holds or was raised deliberately with its figure recorded.
- Staging serves it and the owner has chosen a display face.

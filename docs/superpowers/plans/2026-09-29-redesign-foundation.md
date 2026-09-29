# Redesign Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Bootstrap 4 / templatemo styling layer with a self-owned design system, retire the parity gates that would otherwise block every deploy of the redesign, and leave all five pages rendering correctly on the new foundation.

**Architecture:** Delete `bootstrap.min.css` (95KB, end of life) and `templatemo-style.css`, replacing them with four small CSS files built on custom properties. Motion arrives as one shared `IntersectionObserver` plus CSS, not a library. Fonts are self-hosted, icons are inline SVG, and the seven-glyph Font Awesome Kit script goes. The five pages are ported off the Bootstrap grid onto layout primitives in this slice so nothing is visually broken while slices 2 to 5 add each page's designed composition.

**Tech Stack:** Astro 4.16.x (static), TypeScript, Vitest, Playwright, Fontsource, no CSS framework.

**Spec:** `docs/superpowers/specs/2026-09-29-modern-redesign-design.md`

## Global Constraints

- Node `>=22.0.0` (`package.json` `engines`). Use `nvm use 22`.
- `@astrojs/sitemap` is pinned to `3.2.1`. Do not bump it. 3.7.x needs Astro 5 and the build dies with `Cannot read properties of undefined (reading 'reduce')`.
- **This repository is public.** Never commit AWS account IDs, distribution/OAC/OAI IDs, bucket policies or secrets.
- Add nothing paid. No new paid services, no paid fonts, no paid tooling.
- **The contact form's JavaScript is not touched in this slice or any later one.** `src/components/ContactForm.astro`'s validation, reCAPTCHA handling, fetch and error branches stay byte-for-byte. Only its markup classes and styling change.
- Palette hexes are exact: Deep Sea `#0B3C53`, Sivota Blue `#006994`, Olive `#5A6639`, Ink `#1B2A32`, Sand `#E9E1D5`, Limestone `#F7F4EF`.
- Every foreground/background pair in use must clear **4.5:1**, body-text level, not 3:1.
- `prefers-reduced-motion: reduce` disables **all** motion, including any autoplay, not merely transforms.
- `public/img/` stays. Only the **root-level** `img/`, `css/`, `js/`, `*.html` and `sitemap.xml` are legacy and deleted.
- Import local TS **without** a file extension (`../i18n/t`), `.astro` imports **with** it, JSON **without** an import assertion.
- Files under `infra/cloudfront/` must remain ES5. Not touched in this slice.
- End every commit message with:
  `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`

## Review Focus

Five failure modes the spec implies that would otherwise ship untested. Each has a test added to the task that owns the code.

1. **JavaScript blocked or erroring leaves reveal-animated content permanently invisible.** A visitor with a script blocker, or one hit by a single JS error, should still see every word on the page. Test in Task 8.
2. **`prefers-reduced-motion: reduce` ignored.** A visitor who has asked their OS to reduce motion should get no transforms and no autoplay, not merely slower ones. Test in Task 8.
3. **Greek copy is typically 15 to 30 percent longer than English and overflows nav items and buttons.** `/gr/` must not show clipped or wrapped-onto-two-lines navigation at any supported width. Test in Task 10.
4. **Keyboard users get none of the hover affordances.** Every hover effect must also fire on `:focus-visible`, and every interactive element must show a visible focus ring. Test in Task 10.
5. **The self-hosted fonts ship without the Greek subset, so `/gr/` silently falls back to a system font.** This failure is invisible in English-only testing. Test in Task 6.

---

## File Structure

**Created:**
- `src/styles/tokens.css` — colour, type scale, spacing, easing, duration custom properties. No selectors but `:root`.
- `src/styles/base.css` — reset and element defaults.
- `src/styles/layout.css` — container, grid and section primitives.
- `src/styles/motion.css` — reveal, hover, reduced-motion rules.
- `src/styles/tokens.test.ts` — asserts the palette values and their contrast ratios.
- `src/styles/fonts.test.ts` — asserts the Greek subset is actually shipped.
- `src/components/Icon.astro` — the seven inline SVGs.
- `src/components/Section.astro` — band wrapper.
- `src/components/SplitFeature.astro` — alternating photo/copy block.
- `src/components/FactGrid.astro` — fact and facilities grid.
- `src/scripts/reveal.ts` — the shared IntersectionObserver.
- `src/scripts/nav.ts` — nav-solidify and the mobile toggle.
- `src/i18n/parity.test.ts` — recursive key parity between locales.
- `tests/chrome.spec.ts` — Playwright coverage for nav, footer, reveal, reduced motion.

**Modified:** `src/layouts/BaseLayout.astro`, `src/components/Navbar.astro`, `src/components/Footer.astro`, `src/components/HeaderBottom.astro`, `src/components/ScrollToTop.astro`, `src/components/Gallery.astro`, `src/components/ResortPage.astro`, all five `src/pages/[lang]/*.astro`, `package.json`, `CLAUDE.md`, all three workflow files.

**Deleted:** `src/styles/bootstrap.min.css`, `src/styles/templatemo-style.css`, `scripts/parity-text.mjs`, `scripts/parity-images.mjs`, `scripts/visual-capture.mjs`, root `*.html`, `css/`, `js/`, `img/`, `sitemap.xml`.

---

### Task 1: Put the redesign branch on CI and staging

Without this, the branch cannot reach staging without merging to `master`, and there is no review loop.

**Files:**
- Modify: `.github/workflows/ci.yml:4`
- Modify: `.github/workflows/deploy-staging.yml:3-4`

**Interfaces:**
- Consumes: nothing.
- Produces: every later task's push to `redesign` auto-deploys staging.

- [ ] **Step 1: Add `redesign` to the CI pull-request trigger**

In `.github/workflows/ci.yml`, change:

```yaml
on:
  pull_request:
    branches: [astro-migration, master]
```

to:

```yaml
on:
  pull_request:
    # `redesign` is the redesign trunk; slice PRs target it, not master.
    # Remove it here when the redesign merges to master.
    branches: [astro-migration, master, redesign]
```

- [ ] **Step 2: Add `redesign` to the staging push trigger**

In `.github/workflows/deploy-staging.yml`, change:

```yaml
on:
  push:
    branches: [master]
```

to:

```yaml
on:
  push:
    # master and redesign share one staging bucket: last push wins. Remove
    # `redesign` when it merges to master, or staging keeps deploying from a
    # branch nobody is working on.
    branches: [master, redesign]
```

- [ ] **Step 3: Commit and push**

```bash
git add .github/workflows/ci.yml .github/workflows/deploy-staging.yml
git commit -m "$(cat <<'EOF'
ci: deploy the redesign branch to staging

deploy-staging.yml only fired on push to master, so a branch could not be
reviewed on staging without merging to trunk first. Both branches target
the same staging bucket, so the last push wins; both trigger entries come
back out when the redesign merges.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push -u origin redesign
```

- [ ] **Step 4: Confirm the deploy ran**

Run: `gh run list --branch redesign --limit 3`
Expected: a `Deploy Staging` run appears and completes successfully.

Then confirm staging still serves the current site:

Run: `curl -sI https://d3rdv3w5lgyop6.cloudfront.net/en/kimon | head -1`
Expected: `HTTP/2 200`

---

### Task 2: Retire the parity gates and delete the legacy corpus

The parity gates run **before the S3 sync**, so once the copy changes they block deploys, not merely merges. They protected the Astro migration, which soaked through 2026-09-24.

**Files:**
- Create: `scripts/workflows.test.ts`
- Modify: `.github/workflows/ci.yml`, `deploy-staging.yml`, `deploy-prod.yml`, `package.json`, `CLAUDE.md`
- Delete: `scripts/parity-text.mjs`, `scripts/parity-images.mjs`, `scripts/visual-capture.mjs`, root `*.html`, `css/`, `js/`, `img/`, `sitemap.xml`

**Interfaces:**
- Consumes: nothing.
- Produces: a deploy pipeline that does not assert visual equality with the 2017 template.

- [ ] **Step 1: Write the failing test**

Create `scripts/workflows.test.ts`. This guards against a gate being removed from one workflow but left in another, which would let a PR pass CI and then fail at deploy time.

```ts
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const WORKFLOWS = [
  '.github/workflows/ci.yml',
  '.github/workflows/deploy-staging.yml',
  '.github/workflows/deploy-prod.yml',
];

test('no workflow still runs the retired parity gates', () => {
  for (const path of WORKFLOWS) {
    const yaml = readFileSync(path, 'utf8');
    expect(yaml, `${path} still runs a parity gate`).not.toMatch(/parity:(text|images)/);
  }
});

test('package.json defines no retired parity scripts', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  for (const name of ['parity:text', 'parity:images', 'visual:capture']) {
    expect(Object.keys(pkg.scripts)).not.toContain(name);
  }
});

test('the gates that remain run in every deploy workflow', () => {
  // These are what carries the risk once parity is gone. If one is dropped
  // from a deploy workflow, a broken build reaches S3.
  for (const path of ['.github/workflows/deploy-staging.yml', '.github/workflows/deploy-prod.yml']) {
    const yaml = readFileSync(path, 'utf8');
    expect(yaml, `${path} must run unit tests`).toMatch(/npm run test:unit/);
    expect(yaml, `${path} must run e2e tests`).toMatch(/npm test/);
    expect(yaml, `${path} must type-check`).toMatch(/astro check/);
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `npm run test:unit -- scripts/workflows.test.ts`
Expected: FAIL. The first test fails on all three workflows (each still has `npm run parity:text`), the second fails on `package.json`, and the third fails because `deploy-staging.yml` and `deploy-prod.yml` do not yet run `astro check`.

- [ ] **Step 3: Remove the parity steps from all three workflows**

In each of `.github/workflows/ci.yml`, `deploy-staging.yml` and `deploy-prod.yml`, delete these two lines wherever they appear:

```yaml
      - run: npm run parity:text
      - run: npm run parity:images
```

In `deploy-staging.yml` and `deploy-prod.yml`, add the type-check in their place, so both deploy paths check types the way CI does:

```yaml
      - run: npx astro check
```

- [ ] **Step 4: Remove the retired npm scripts**

In `package.json`, delete these three lines from `scripts`:

```json
    "parity:text": "node scripts/parity-text.mjs",
    "parity:images": "node scripts/parity-images.mjs",
    "visual:capture": "node scripts/visual-capture.mjs",
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test:unit -- scripts/workflows.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Delete the scripts and the legacy corpus**

`visual-capture.mjs` serves the legacy site on port 4399 to screenshot it against the Astro build, so it cannot outlive the corpus.

```bash
git rm -q scripts/parity-text.mjs scripts/parity-images.mjs scripts/visual-capture.mjs
git rm -q contact.html home.html irida.html kimon.html location.html sitemap.xml
git rm -rq css js img
```

Confirm `public/img/` is untouched, since the nav logo and locale flags live there:

Run: `ls public/img/nav/`
Expected: `en.png  gr.jpg  logo_marinos.png`

- [ ] **Step 7: Update CLAUDE.md**

In `CLAUDE.md`, delete these rows from the commands table:

```
| `npm run parity:text` | Diff built copy against the legacy `*.html` reference |
| `npm run parity:images` | Assert every legacy-referenced image exists in the build |
```

Replace the sentence beginning `` `test:unit`, `test`, `parity:text` and `parity:images` all run `` with:

```
`test:unit`, `test`, `check:links:ci` and `npx astro check` all run **before** the S3 sync in the
deploy workflows — a failure blocks the deploy, not just the merge.
```

Delete this bullet from the Gotchas section entirely:

```
- **The root `*.html`, `css/`, `js/`, `img/` and `sitemap.xml` are the legacy site, kept on
  purpose** as the reference corpus for the parity gates. They are not served, not built, and not
  edited. They go away once the cutover has soaked.
```

And delete `scripts/` line's parity mention in the architecture tree, changing:

```
  scripts/                    # parity gates, visual-capture helper
```

to:

```
  scripts/                    # build-info writer
```

- [ ] **Step 8: Verify the build and links still pass**

Run: `npm run build`
Expected: succeeds, `dist/` written.

Run: `npm run test:unit`
Expected: PASS. All existing suites still green.

Run: `npm run check:links:ci`
Expected: no broken internal links. This is the check that would catch the corpus deletion having removed something still referenced.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
build: retire the parity gates and the legacy corpus

The parity gates diffed the build against the 2017 template. A redesign
fails them by definition, and because they run before the S3 sync they
would block deploys rather than merges.

They existed to protect the Astro migration, which cut over on 2026-09-21
and soaked through 2026-09-24. CLAUDE.md already recorded that the corpus
goes once the cutover soaked.

visual-capture.mjs served the legacy site to screenshot against, so it
goes with it. public/img/ stays: it is served, and the nav logo and locale
flags live there.

deploy-staging and deploy-prod now run `astro check`, which only CI ran
before, so the two gates dropped are more than replaced on the deploy path.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Recursive key parity between locales

`src/i18n/pages.test.ts` checks hand-listed key groups, not parity in general. The copy rewrite in slices 2 to 5 adds 10 to 15 keys per page across two files, and a key added to one locale only would ship an English string on a Greek page.

**Files:**
- Create: `src/i18n/parity.test.ts`

**Interfaces:**
- Consumes: `src/i18n/en.json`, `src/i18n/gr.json`.
- Produces: a gate every later slice's copy work runs against.

- [ ] **Step 1: Write the test**

```ts
import { test, expect } from 'vitest';
import en from './en.json';
import gr from './gr.json';

/** Every leaf path in an object, dot-joined and sorted. */
function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }
  return Object.entries(value as Record<string, unknown>)
    .flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

test('en and gr expose exactly the same key paths', () => {
  const a = keyPaths(en).sort();
  const b = keyPaths(gr).sort();

  expect(b.filter((k) => !a.includes(k)), 'keys in gr.json missing from en.json').toEqual([]);
  expect(a.filter((k) => !b.includes(k)), 'keys in en.json missing from gr.json').toEqual([]);
});

test('no locale ships an empty or whitespace-only string', () => {
  for (const [name, data] of [['en', en], ['gr', gr]] as const) {
    const blank = keyPaths(data).filter((path) => {
      const value = path.split('.').reduce<any>((acc, k) => acc?.[k], data);
      return typeof value === 'string' && value.trim() === '';
    });
    expect(blank, `${name}.json has blank values`).toEqual([]);
  }
});
```

- [ ] **Step 2: Run it**

Run: `npm run test:unit -- src/i18n/parity.test.ts`
Expected: PASS, 2 tests. The two locales are currently in sync.

- [ ] **Step 3: Prove the test can actually fail**

A test that passes on the first run has not been shown to detect anything. This project has shipped a regression test that could not catch its own regression before; do not skip this step.

```bash
node -e "const f='src/i18n/en.json',d=JSON.parse(require('fs').readFileSync(f));d.__probe='x';require('fs').writeFileSync(f,JSON.stringify(d,null,2))"
npm run test:unit -- src/i18n/parity.test.ts
```

Expected: FAIL, reporting `__probe` as a key in `en.json` missing from `gr.json`.

Now restore the file:

```bash
git checkout src/i18n/en.json
npm run test:unit -- src/i18n/parity.test.ts
```

Expected: PASS again.

- [ ] **Step 4: Commit**

```bash
git add src/i18n/parity.test.ts
git commit -m "$(cat <<'EOF'
test(i18n): assert recursive key parity between locales

pages.test.ts checks hand-listed key groups. The copy rewrite adds keys
across both locale files, and a key added to one side only would ship an
English string on a Greek page with nothing failing.

Verified the test fails by adding a key to en.json alone before committing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Design tokens, with contrast enforced by test

**Files:**
- Create: `src/styles/tokens.css`, `src/styles/tokens.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the custom properties every later task and slice consumes: `--c-deep-sea`, `--c-sivota-blue`, `--c-olive`, `--c-ink`, `--c-sand`, `--c-limestone`, `--c-white`; `--fs-display-xl`, `--fs-display-l`, `--fs-display-m`, `--fs-lead`, `--fs-body`, `--fs-small`, `--fs-eyebrow`; `--sp-1` through `--sp-10`; `--ease-out`, `--dur-fast`, `--dur`, `--dur-slow`; `--radius-btn`, `--radius-card`; `--font-display`, `--font-body`.

- [ ] **Step 1: Write the failing test**

Create `src/styles/tokens.test.ts`. The contrast assertions are the point: the spec claims AA at body-text level, and that claim should fail the build if someone nudges a hex.

```ts
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/styles/tokens.css', 'utf8');

/** Reads a custom property's value out of the :root block. */
function token(name: string): string {
  const match = css.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`token --${name} is not defined in tokens.css`);
  return match[1].trim();
}

function relativeLuminance(hex: string): number {
  const channels = hex.replace('#', '').match(/../g)!.map((pair) => {
    const c = parseInt(pair, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [relativeLuminance(a), relativeLuminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

test('the palette matches the approved values exactly', () => {
  expect(token('c-deep-sea')).toBe('#0B3C53');
  expect(token('c-sivota-blue')).toBe('#006994');
  expect(token('c-olive')).toBe('#5A6639');
  expect(token('c-ink')).toBe('#1B2A32');
  expect(token('c-sand')).toBe('#E9E1D5');
  expect(token('c-limestone')).toBe('#F7F4EF');
});

test('every colour pair in use clears AA for body text', () => {
  const pairs: [string, string][] = [
    ['c-ink', 'c-limestone'],
    ['c-ink', 'c-sand'],
    ['c-deep-sea', 'c-limestone'],
    ['c-deep-sea', 'c-sand'],
    ['c-sivota-blue', 'c-limestone'],
    ['c-olive', 'c-limestone'],
    ['c-white', 'c-deep-sea'],
    ['c-white', 'c-sivota-blue'],
    ['c-white', 'c-olive'],
  ];

  for (const [fg, bg] of pairs) {
    const ratio = contrast(token(fg), token(bg));
    // 4.5:1 is the body-text threshold. Large-text 3:1 is deliberately not
    // used here: these colours carry ordinary paragraphs, not just headings.
    expect(ratio, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5);
  }
});

test('the type and spacing scales are defined', () => {
  for (const name of [
    'fs-display-xl', 'fs-display-l', 'fs-display-m',
    'fs-lead', 'fs-body', 'fs-small', 'fs-eyebrow',
    'sp-1', 'sp-4', 'sp-7', 'sp-10',
    'ease-out', 'dur-fast', 'dur', 'dur-slow',
    'font-display', 'font-body',
  ]) {
    expect(() => token(name), `--${name} missing`).not.toThrow();
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- src/styles/tokens.test.ts`
Expected: FAIL with `ENOENT: no such file or directory, open 'src/styles/tokens.css'`.

- [ ] **Step 3: Write tokens.css**

```css
/*
 * Design tokens. Values here are enforced by src/styles/tokens.test.ts,
 * including the contrast ratios: changing a hex without re-running that
 * test will fail the build rather than quietly shipping unreadable text.
 */
:root {
  /* Palette: "Ionian" */
  --c-deep-sea: #0B3C53;
  --c-sivota-blue: #006994;
  --c-olive: #5A6639;
  --c-ink: #1B2A32;
  --c-sand: #E9E1D5;
  --c-limestone: #F7F4EF;
  --c-white: #FFFFFF;

  /* Typography. Greek-capable faces only: of Google's 1946 families just 118
     ship Greek, which is what rules out Playfair, Cormorant and the rest. */
  --font-display: 'EB Garamond Variable', 'EB Garamond', Georgia, serif;
  --font-body: 'Manrope Variable', Manrope, system-ui, sans-serif;

  --fs-display-xl: clamp(2.75rem, 6vw, 5rem);
  --fs-display-l: clamp(2rem, 3.5vw, 3rem);
  --fs-display-m: clamp(1.5rem, 2.2vw, 2rem);
  --fs-lead: 1.1875rem;
  --fs-body: 1.0625rem;
  --fs-small: 0.8125rem;
  --fs-eyebrow: 0.6875rem;

  --lh-tight: 1.03;
  --lh-heading: 1.12;
  --lh-body: 1.7;

  /* Spacing, 4px base */
  --sp-1: 0.25rem;
  --sp-2: 0.5rem;
  --sp-3: 0.75rem;
  --sp-4: 1rem;
  --sp-5: 1.5rem;
  --sp-6: 2rem;
  --sp-7: 3rem;
  --sp-8: 4rem;
  --sp-9: 6rem;
  --sp-10: 8rem;

  --section-pad: clamp(4rem, 8vw, 8rem);
  --container: 1200px;
  --gutter: clamp(1.25rem, 4vw, 3.5rem);

  --radius-btn: 2px;
  --radius-card: 3px;

  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --dur-fast: 200ms;
  --dur: 400ms;
  --dur-slow: 800ms;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test:unit -- src/styles/tokens.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/styles/tokens.css src/styles/tokens.test.ts
git commit -m "$(cat <<'EOF'
feat(styles): add design tokens with contrast enforced by test

The palette's AA compliance is asserted at 4.5:1, the body-text threshold,
not the 3:1 large-text one, because these colours carry paragraphs. The
olive was darkened from #6F7D4A during design for exactly this reason: it
measured 4.07 and 4.46 and failed both directions.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Base and layout CSS

**Files:**
- Create: `src/styles/base.css`, `src/styles/layout.css`
- Modify: `src/layouts/BaseLayout.astro:3-4`

**Interfaces:**
- Consumes: the tokens from Task 4.
- Produces: classes `.container`, `.section`, `.grid`, `.grid--2`, `.grid--3`, `.stack`, `.eyebrow`, `.btn`, `.btn--primary`, `.btn--ghost`, `.lead`, `.visually-hidden`, `.skip-link`.

- [ ] **Step 1: Write base.css**

```css
/* Reset and element defaults. Paired with tokens.css. */
*, *::before, *::after { box-sizing: border-box; }

html { -webkit-text-size-adjust: 100%; }

body {
  margin: 0;
  background: var(--c-limestone);
  color: var(--c-ink);
  font-family: var(--font-body);
  font-size: var(--fs-body);
  line-height: var(--lh-body);
  font-weight: 400;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3, h4 {
  font-family: var(--font-display);
  font-weight: 500;
  line-height: var(--lh-heading);
  color: var(--c-deep-sea);
  margin: 0 0 var(--sp-4);
  text-wrap: balance;
}

h1 { font-size: var(--fs-display-xl); line-height: var(--lh-tight); }
h2 { font-size: var(--fs-display-l); }
h3 { font-size: var(--fs-display-m); }

p { margin: 0 0 var(--sp-4); }
p:last-child { margin-bottom: 0; }

img { max-width: 100%; height: auto; display: block; }

a { color: var(--c-sivota-blue); text-decoration-thickness: 1px; text-underline-offset: 0.18em; }
a:hover { color: var(--c-deep-sea); }

/* One visible focus treatment for every interactive element. Keyboard users
   must be able to see where they are; see Review Focus item 4. */
:focus-visible {
  outline: 2px solid var(--c-sivota-blue);
  outline-offset: 3px;
  border-radius: 1px;
}

ul { margin: 0; padding: 0; list-style: none; }

.visually-hidden {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip-path: inset(50%); white-space: nowrap;
}

.skip-link {
  position: absolute; left: var(--sp-4); top: var(--sp-4);
  z-index: 100; padding: var(--sp-3) var(--sp-4);
  background: var(--c-white); color: var(--c-deep-sea);
  border-radius: var(--radius-btn); font-weight: 600;
  transform: translateY(-200%);
}
.skip-link:focus { transform: translateY(0); }
```

- [ ] **Step 2: Write layout.css**

```css
/* Layout primitives. These replace the Bootstrap 12-column grid. */
.container {
  width: 100%;
  max-width: var(--container);
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.container--wide { max-width: 1440px; }
.container--narrow { max-width: 760px; }

.section { padding-block: var(--section-pad); }
.section--limestone { background: var(--c-limestone); }
.section--sand { background: var(--c-sand); }
.section--deep { background: var(--c-deep-sea); color: var(--c-white); }
.section--deep h1, .section--deep h2, .section--deep h3 { color: var(--c-white); }
.section--tight { padding-block: var(--sp-7); }

.grid { display: grid; gap: var(--sp-6); }
.grid--2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.grid--3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
.grid--4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }

@media (max-width: 900px) {
  .grid--3, .grid--4 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 640px) {
  .grid--2, .grid--3, .grid--4 { grid-template-columns: minmax(0, 1fr); }
}

.stack { display: flex; flex-direction: column; gap: var(--sp-4); }
.stack--wide { gap: var(--sp-6); }

.eyebrow {
  display: inline-flex; align-items: center; gap: var(--sp-3);
  font-size: var(--fs-eyebrow); font-weight: 600;
  letter-spacing: 0.22em; text-transform: uppercase;
  color: var(--c-olive); margin-bottom: var(--sp-4);
}
.eyebrow::before {
  content: ''; width: 28px; height: 1px; background: currentColor;
}

.lead { font-size: var(--fs-lead); font-weight: 300; }

.btn {
  display: inline-flex; align-items: center; gap: var(--sp-3);
  /* 44px minimum target height: 13px padding + 13px + ~18px line box. */
  padding: 0.8125rem 1.75rem;
  min-height: 44px;
  border: 1px solid transparent;
  border-radius: var(--radius-btn);
  font-size: var(--fs-small); font-weight: 600;
  letter-spacing: 0.1em; text-transform: uppercase;
  text-decoration: none; cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out),
              color var(--dur-fast) var(--ease-out),
              border-color var(--dur-fast) var(--ease-out);
}

.btn--primary { background: var(--c-sivota-blue); color: var(--c-white); }
.btn--primary:hover, .btn--primary:focus-visible {
  background: var(--c-deep-sea); color: var(--c-white);
}

.btn--ghost { background: transparent; color: var(--c-deep-sea); border-color: currentColor; }
.btn--ghost:hover, .btn--ghost:focus-visible {
  background: var(--c-deep-sea); color: var(--c-white);
}
```

- [ ] **Step 3: Wire them into BaseLayout**

In `src/layouts/BaseLayout.astro`, replace lines 3 and 4:

```astro
import '../styles/bootstrap.min.css';
import '../styles/templatemo-style.css';
```

with:

```astro
import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
```

Do **not** delete the two CSS files yet. The pages still use their classes until Task 12, and removing them now breaks every page in between.

- [ ] **Step 4: Verify the build and type-check pass**

Run: `npm run build && npx astro check`
Expected: build succeeds; `astro check` reports 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles/base.css src/styles/layout.css src/layouts/BaseLayout.astro
git commit -m "$(cat <<'EOF'
feat(styles): add base and layout primitives

Replaces what the Bootstrap 12-column grid was used for with CSS Grid and
a container primitive. Bootstrap and templatemo stay imported nowhere but
are not yet deleted: the pages still carry their classes until the port in
a later task.

Buttons carry a 44px minimum target height, and every interactive element
gets one visible :focus-visible treatment.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Self-host the fonts

Fontsource splits families by subset. The Greek subset must be imported explicitly; the default import ships Latin only, and the failure is invisible unless you read Greek.

**Files:**
- Modify: `package.json`, `src/layouts/BaseLayout.astro`
- Create: `src/styles/fonts.css`

**Interfaces:**
- Consumes: `--font-display`, `--font-body` from Task 4.
- Produces: locally served `EB Garamond Variable` and `Manrope Variable` with Greek glyphs.

- [ ] **Step 1: Install the packages**

```bash
npm install @fontsource-variable/eb-garamond @fontsource-variable/manrope
```

- [ ] **Step 2: Find out which subset files the packages actually ship**

Do not assume the paths. Run:

```bash
ls node_modules/@fontsource-variable/eb-garamond/
ls node_modules/@fontsource-variable/manrope/
```

Expected: per-subset CSS files including `greek.css` alongside `latin.css`, plus an `index.css`.

**If `greek.css` is absent for either family**, the variable package does not carry Greek. Fall back: install the static package instead (`npm install @fontsource/eb-garamond`), re-run the `ls`, and use its `greek.css`. If neither ships Greek, stop and report it: the typeface choice depends on Greek support and the spec must be revisited rather than worked around.

- [ ] **Step 3: Write fonts.css**

```css
/* Self-hosted, replacing the Google Fonts CDN link. Removes a third-party
   request that has drawn GDPR enforcement in the EU, where most of this
   site's visitors are.

   The greek imports are not optional decoration: half the site is Greek,
   and without them /gr/ falls back to a system font with nothing failing.
   src/styles/fonts.test.ts asserts they survive. */
@import '@fontsource-variable/eb-garamond/latin.css';
@import '@fontsource-variable/eb-garamond/greek.css';
@import '@fontsource-variable/manrope/latin.css';
@import '@fontsource-variable/manrope/greek.css';
```

- [ ] **Step 4: Swap the CDN link for the local import**

In `src/layouts/BaseLayout.astro`, add to the import block at the top:

```astro
import '../styles/fonts.css';
```

and delete this line from `<head>`:

```astro
    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Open+Sans:300,400" />
```

- [ ] **Step 5: Write the failing test**

Create `src/styles/fonts.test.ts`. This is Review Focus item 5. It builds and inspects the emitted CSS, because the only thing that proves Greek shipped is a `unicode-range` covering the Greek block in the output.

```ts
import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, readFileSync, existsSync } from 'node:fs';

test('the built CSS ships Greek glyphs for both families', () => {
  if (!existsSync('dist')) execSync('npm run build', { stdio: 'inherit' });

  const cssDir = 'dist/_astro';
  const css = readdirSync(cssDir)
    .filter((f) => f.endsWith('.css'))
    .map((f) => readFileSync(`${cssDir}/${f}`, 'utf8'))
    .join('\n');

  // U+0370 is the start of the Greek and Coptic block. Without a @font-face
  // declaring it, /gr/ silently renders in a system fallback.
  expect(css, 'no Greek unicode-range in the built CSS').toMatch(/unicode-range:[^;]*U\+0370/i);

  // And the faces themselves must be present, not just referenced.
  expect(css).toMatch(/font-family:\s*['"]?EB Garamond/i);
  expect(css).toMatch(/font-family:\s*['"]?Manrope/i);
}, 180_000);

test('no Google Fonts CDN request remains', () => {
  const html = readFileSync('dist/en/index.html', 'utf8');
  expect(html).not.toContain('fonts.googleapis.com');
  expect(html).not.toContain('fonts.gstatic.com');
});
```

- [ ] **Step 6: Run the test**

Run: `npm run build && npm run test:unit -- src/styles/fonts.test.ts`
Expected: PASS, 2 tests.

If the first test fails, the Greek subset did not make it into the bundle. Go back to Step 2 and check which file actually carries the Greek `@font-face`; do not relax the assertion.

- [ ] **Step 7: Confirm Greek renders, by eye, once**

Run: `npm run preview` and open `http://localhost:4321/gr/`.
Expected: Greek body text renders in Manrope, not in a system serif or sans. Compare against `/en/`: the two should look like the same typeface.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/styles/fonts.css src/styles/fonts.test.ts src/layouts/BaseLayout.astro
git commit -m "$(cat <<'EOF'
feat(styles): self-host EB Garamond and Manrope with Greek

Replaces the Google Fonts CDN link. Removes a third-party request that has
drawn GDPR enforcement in the EU, and serves the fonts from the same origin.

Fontsource splits families by subset and the default import is Latin only,
so /gr/ would have fallen back to a system font with nothing failing. The
test asserts a Greek unicode-range survives into the built CSS.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Inline SVG icons, and drop the Font Awesome Kit

Seven glyphs are currently drawn by a render-blocking third-party script.

**Files:**
- Create: `src/components/Icon.astro`
- Modify: `src/layouts/BaseLayout.astro`, `src/components/Footer.astro:22-24`, `src/components/ScrollToTop.astro:1`, `src/components/ContactForm.astro:36`, `src/components/HeaderBottom.astro:18-19`
- Create: `tests/icons.spec.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `<Icon name="..." />` accepting `'map-pin' | 'phone' | 'envelope' | 'chevron-up' | 'spinner' | 'facebook' | 'instagram'`, plus optional `size` (number, default 18) and `label` (string; when absent the icon is `aria-hidden`).

- [ ] **Step 1: Write Icon.astro**

```astro
---
export type IconName =
  | 'map-pin' | 'phone' | 'envelope' | 'chevron-up'
  | 'spinner' | 'facebook' | 'instagram';

interface Props { name: IconName; size?: number; label?: string; }
const { name, size = 18, label } = Astro.props;

// Stroke icons share one set of attributes; the two brand marks are filled.
const stroke = { fill: 'none', stroke: 'currentColor', 'stroke-width': '1.8',
                 'stroke-linecap': 'round', 'stroke-linejoin': 'round' } as const;
const filled = { fill: 'currentColor', stroke: 'none' } as const;
const isBrand = name === 'facebook' || name === 'instagram';
const a11y = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': 'true' };
---
<svg
  xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
  width={size} height={size} class:list={['icon', `icon--${name}`]}
  {...(isBrand ? filled : stroke)} {...a11y}
>
  {name === 'map-pin' && (
    <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>
  )}
  {name === 'phone' && (
    <path d="M7 2h10a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm4 17h2" />
  )}
  {name === 'envelope' && (
    <><rect x="2.5" y="5" width="19" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></>
  )}
  {name === 'chevron-up' && <path d="m6 15 6-6 6 6" />}
  {name === 'spinner' && (
    <><circle cx="12" cy="12" r="9" opacity="0.25" /><path d="M21 12a9 9 0 0 0-9-9" /></>
  )}
  {name === 'facebook' && (
    <path d="M13.5 22v-8h2.7l.4-3.1h-3.1V8.9c0-.9.25-1.5 1.55-1.5h1.65V4.6A22 22 0 0 0 14.3 4.5c-2.4 0-4 1.45-4 4.12v2.28H7.6V14h2.7v8Z" />
  )}
  {name === 'instagram' && (
    <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.8" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8" /><circle cx="17.2" cy="6.8" r="1.2" /></>
  )}
</svg>

<style>
  .icon { flex: none; }
  .icon--spinner { animation: icon-spin 900ms linear infinite; }
  /* Review Focus item 2: motion is opt-out at the source, not per-component. */
  @media (prefers-reduced-motion: reduce) {
    .icon--spinner { animation: none; }
  }
  @keyframes icon-spin { to { transform: rotate(360deg); } }
</style>
```

- [ ] **Step 2: Replace every Font Awesome usage**

`src/components/Footer.astro`, lines 22 to 24. Add `import Icon from './Icon.astro';` to the frontmatter, then replace:

```astro
            <li class="tm-footer-link"><i class="fas fa-map-marker"></i> <span>{s.footer.address}</span></li>
            <li class="tm-footer-link"><i class="fa fa-mobile"></i> +30 6909 025 820</li>
            <li class="tm-footer-link"><i class="fa fa-envelope"></i> marinosaparts@gmail.com</li>
```

with:

```astro
            <li class="tm-footer-link"><Icon name="map-pin" /> <span>{s.footer.address}</span></li>
            <li class="tm-footer-link"><Icon name="phone" /> +30 6909 025 820</li>
            <li class="tm-footer-link"><Icon name="envelope" /> marinosaparts@gmail.com</li>
```

`src/components/ScrollToTop.astro`, line 1:

```astro
<a href="#" class="scroll-top" aria-label="Scroll to top"><Icon name="chevron-up" size={20} /></a>
```

with `import Icon from './Icon.astro';` added in frontmatter.

`src/components/ContactForm.astro`, line 36. Change **only** this line; leave every other line in the file alone:

```astro
        <div id="generic-loader" class="text-center" style="display:none">Sending email... <Icon name="spinner" /></div>
```

with `import Icon from './Icon.astro';` added in frontmatter.

`src/components/HeaderBottom.astro`, lines 18 and 19:

```astro
        <a href="https://www.facebook.com/marinosaparts.sivota/" target="_blank" rel="noopener noreferrer" aria-label="Marinos Apartments on Facebook" class="facebook"><Icon name="facebook" /></a>
        <a href="https://www.instagram.com/marinosaparts/" target="_blank" rel="noopener noreferrer" aria-label="Marinos Apartments on Instagram" class="instagram"><Icon name="instagram" /></a>
```

with `import Icon from './Icon.astro';` added in frontmatter.

- [ ] **Step 3: Remove the Font Awesome Kit script**

In `src/layouts/BaseLayout.astro`, delete:

```astro
    <script src="https://kit.fontawesome.com/3fad1b2de2.js" crossorigin="anonymous"></script>
```

- [ ] **Step 4: Write the test**

Create `tests/icons.spec.ts`:

```ts
import { test, expect } from '@playwright/test';

test('no Font Awesome request is made on any page', async ({ page }) => {
  const thirdParty: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('fontawesome')) thirdParty.push(r.url());
  });

  for (const path of ['/en/', '/en/kimon/', '/en/location/', '/en/contact/', '/gr/']) {
    await page.goto(path);
  }
  expect(thirdParty).toEqual([]);
});

test('no leftover <i class="fa"> markup remains', async ({ page }) => {
  await page.goto('/en/contact/');
  expect(await page.locator('i[class*="fa-"]').count()).toBe(0);
});

test('social icons keep their accessible names', async ({ page }) => {
  await page.goto('/en/');
  await expect(page.getByLabel('Marinos Apartments on Facebook')).toBeVisible();
  await expect(page.getByLabel('Marinos Apartments on Instagram')).toBeVisible();
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- tests/icons.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add src/components/Icon.astro src/components/Footer.astro src/components/ScrollToTop.astro src/components/ContactForm.astro src/components/HeaderBottom.astro src/layouts/BaseLayout.astro tests/icons.spec.ts
git commit -m "$(cat <<'EOF'
feat(components): inline the seven icons, drop the Font Awesome Kit

A render-blocking third-party script was loading to draw seven glyphs.
They are now inline SVG with no network cost.

The spinner's animation respects prefers-reduced-motion, which fa-spin
did not.

ContactForm.astro changes on one line only: the loader glyph. Its
validation, reCAPTCHA and fetch logic are untouched.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Motion CSS and the reveal script

**Files:**
- Create: `src/styles/motion.css`, `src/scripts/reveal.ts`
- Modify: `src/layouts/BaseLayout.astro`

**Interfaces:**
- Consumes: `--dur`, `--dur-slow`, `--ease-out` from Task 4.
- Produces: the `data-reveal` attribute contract (any element with `data-reveal` fades and rises on entering the viewport; `data-reveal-delay="N"` staggers it by N milliseconds), and the `.hover-zoom` class.

- [ ] **Step 1: Write motion.css**

```css
/*
 * Motion. Two rules govern everything here:
 *
 * 1. The hidden starting state applies ONLY under .js on <html>, which the
 *    inline script in BaseLayout sets before first paint. Without that guard,
 *    a script error or a blocked bundle leaves the page permanently blank.
 * 2. prefers-reduced-motion disables all of it, not just the transforms.
 */
.js [data-reveal] {
  opacity: 0;
  transform: translateY(16px);
}

.js [data-reveal].is-revealed {
  opacity: 1;
  transform: none;
  transition: opacity var(--dur-slow) var(--ease-out),
              transform var(--dur-slow) var(--ease-out);
}

.hover-zoom { overflow: hidden; }
.hover-zoom img {
  transition: transform var(--dur) var(--ease-out);
  will-change: transform;
}
/* :focus-within matters as much as :hover here: a keyboard user tabbing to
   the link inside a card should get the same affordance. Review Focus item 4. */
.hover-zoom:hover img,
.hover-zoom:focus-within img {
  transform: scale(1.05);
}

@media (prefers-reduced-motion: reduce) {
  .js [data-reveal],
  .js [data-reveal].is-revealed {
    opacity: 1;
    transform: none;
    transition: none;
  }
  .hover-zoom img,
  .hover-zoom:hover img,
  .hover-zoom:focus-within img {
    transition: none;
    transform: none;
  }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Write reveal.ts**

```ts
/**
 * One IntersectionObserver for every [data-reveal] on the page.
 *
 * The hidden state lives in CSS behind `.js`, so if this module never runs
 * the content is simply visible. Never move the hiding into JS.
 */
export function initReveal(): void {
  const targets = document.querySelectorAll<HTMLElement>('[data-reveal]');
  if (targets.length === 0) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    targets.forEach((el) => el.classList.add('is-revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const el = entry.target as HTMLElement;
        const delay = Number(el.dataset.revealDelay ?? 0);
        window.setTimeout(() => el.classList.add('is-revealed'), delay);
        observer.unobserve(el);
      }
    },
    { rootMargin: '0px 0px -10% 0px', threshold: 0.1 }
  );

  targets.forEach((el) => observer.observe(el));
}
```

- [ ] **Step 3: Wire it into BaseLayout**

In `src/layouts/BaseLayout.astro`, add `import '../styles/motion.css';` to the import block.

Add this as the **first** element inside `<head>`, before anything else, so the class is set before first paint and no flash of hidden content occurs:

```astro
    <script is:inline>
      // Set before paint: motion.css only hides [data-reveal] under .js, so a
      // blocked or failed bundle leaves every word on the page visible.
      document.documentElement.classList.add('js');
    </script>
```

Add this immediately before `</body>`:

```astro
    <script>
      import { initReveal } from '../scripts/reveal';
      initReveal();
    </script>
```

- [ ] **Step 4: Write the tests**

Create `tests/motion.spec.ts`. These are Review Focus items 1 and 2.

```ts
import { test, expect } from '@playwright/test';

test('content is visible when JavaScript is disabled', async ({ browser }) => {
  // The failure this guards: hiding [data-reveal] unconditionally in CSS,
  // which leaves a script-blocked visitor staring at an empty page.
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('/en/');

  const revealables = page.locator('[data-reveal]');
  const count = await revealables.count();
  for (let i = 0; i < count; i++) {
    await expect(revealables.nth(i)).toBeVisible();
  }
  await context.close();
});

test('reveal applies when JavaScript runs', async ({ page }) => {
  await page.goto('/en/');
  const first = page.locator('[data-reveal]').first();
  await expect(first).toHaveClass(/is-revealed/);
});

test('reduced motion reveals everything immediately and animates nothing', async ({ browser }) => {
  const context = await browser.newContext({ reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto('/en/');

  const revealables = page.locator('[data-reveal]');
  const count = await revealables.count();
  for (let i = 0; i < count; i++) {
    const el = revealables.nth(i);
    await expect(el).toBeVisible();
    await expect(el).toHaveCSS('opacity', '1');
    await expect(el).toHaveCSS('transition-duration', /^(0s|0\.00001s)$/);
  }
  await context.close();
});
```

- [ ] **Step 5: Add a reveal target so the tests have something to assert on**

In `src/pages/[lang]/index.astro`, add `data-reveal` to the intro heading and paragraph wrapper:

```astro
        <div class="col-xs-12 col-sm-12 col-md-12 col-lg-12 text-xs-center" data-reveal>
```

- [ ] **Step 6: Run the tests**

Run: `npm test -- tests/motion.spec.ts`
Expected: PASS, 3 tests.

- [ ] **Step 7: Commit**

```bash
git add src/styles/motion.css src/scripts/reveal.ts src/layouts/BaseLayout.astro src/pages tests/motion.spec.ts
git commit -m "$(cat <<'EOF'
feat(motion): add scroll reveals that degrade safely

One IntersectionObserver for every [data-reveal]. The hidden starting
state lives in CSS behind a .js class set before first paint, so a blocked
or failed bundle leaves the page fully readable rather than blank. Tested
with JavaScript disabled, which is the failure mode this pattern exists to
prevent.

prefers-reduced-motion disables reveals and hover zoom outright rather
than shortening them.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Layout components

**Files:**
- Create: `src/components/Section.astro`, `src/components/SplitFeature.astro`, `src/components/FactGrid.astro`

**Interfaces:**
- Consumes: `layout.css` classes from Task 5, `Icon` from Task 7, `data-reveal` from Task 8.
- Produces:
  - `<Section ground?: 'limestone' | 'sand' | 'deep' (default 'limestone'), tight?: boolean, width?: 'default' | 'wide' | 'narrow'>` with a default slot.
  - `<SplitFeature eyebrow?: string, heading: string, body: string, href: string, cta: string, image: ImageMetadata, alt: string, reverse?: boolean>`.
  - `<FactGrid items: { icon?: IconName; label: string }[], columns?: 2 | 3 | 4>`.

- [ ] **Step 1: Write Section.astro**

```astro
---
interface Props {
  ground?: 'limestone' | 'sand' | 'deep';
  tight?: boolean;
  width?: 'default' | 'wide' | 'narrow';
}
const { ground = 'limestone', tight = false, width = 'default' } = Astro.props;
---
<section class:list={['section', `section--${ground}`, tight && 'section--tight']}>
  <div class:list={['container', width !== 'default' && `container--${width}`]}>
    <slot />
  </div>
</section>
```

- [ ] **Step 2: Write SplitFeature.astro**

```astro
---
import { Image } from 'astro:assets';
import type { ImageMetadata } from 'astro';

interface Props {
  eyebrow?: string;
  heading: string;
  body: string;
  href: string;
  cta: string;
  image: ImageMetadata;
  alt: string;
  reverse?: boolean;
}
const { eyebrow, heading, body, href, cta, image, alt, reverse = false } = Astro.props;
---
<div class:list={['split', reverse && 'split--reverse']} data-reveal>
  <a class="split__media hover-zoom" href={href} tabindex="-1" aria-hidden="true">
    <Image src={image} alt={alt} widths={[600, 900, 1200]} sizes="(max-width: 900px) 100vw, 50vw" />
  </a>
  <div class="split__body">
    {eyebrow && <span class="eyebrow">{eyebrow}</span>}
    <h2>{heading}</h2>
    <p class="lead">{body}</p>
    <a class="btn btn--ghost" href={href}>{cta}</a>
  </div>
</div>

<style>
  .split {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: center;
  }
  /* The image is ordered second in the DOM for reverse, not floated, so the
     reading order matches the visual order for screen readers too. */
  .split--reverse .split__media { order: 2; }

  .split__media {
    display: block;
    border-radius: var(--radius-card);
    /* Reserves the box before the image decodes, so nothing shifts. */
    aspect-ratio: 4 / 3;
  }
  .split__media img { width: 100%; height: 100%; object-fit: cover; }

  .split__body { display: flex; flex-direction: column; align-items: flex-start; }
  .split__body .btn { margin-top: var(--sp-5); }

  @media (max-width: 900px) {
    .split { grid-template-columns: minmax(0, 1fr); }
    .split--reverse .split__media { order: 0; }
  }
</style>
```

- [ ] **Step 3: Write FactGrid.astro**

```astro
---
import Icon, { type IconName } from './Icon.astro';

interface Props {
  items: { icon?: IconName; label: string }[];
  columns?: 2 | 3 | 4;
}
const { items, columns = 3 } = Astro.props;
---
<ul class:list={['grid', `grid--${columns}`, 'factgrid']}>
  {items.map((item, i) => (
    <li class="factgrid__item" data-reveal data-reveal-delay={i * 80}>
      {item.icon && <Icon name={item.icon} size={22} />}
      <span>{item.label}</span>
    </li>
  ))}
</ul>

<style>
  .factgrid { margin: 0; padding: 0; }
  .factgrid__item {
    display: flex;
    align-items: flex-start;
    gap: var(--sp-3);
    color: var(--c-ink);
  }
  .factgrid__item :global(.icon) { color: var(--c-olive); margin-top: 0.2em; }
</style>
```

`Icon.astro` must export its `IconName` type for this import to type-check. Confirm the `export type IconName` line written in Task 7 Step 1 is present.

- [ ] **Step 4: Type-check**

Run: `npx astro check`
Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/Section.astro src/components/SplitFeature.astro src/components/FactGrid.astro
git commit -m "$(cat <<'EOF'
feat(components): add Section, SplitFeature and FactGrid primitives

SplitFeature reverses via DOM order rather than a float, so the reading
order a screen reader follows matches the visual order, and reserves its
aspect ratio so the image decoding shifts nothing.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Restyle the navbar

**Files:**
- Modify: `src/components/Navbar.astro`, `src/i18n/en.json`, `src/i18n/gr.json`
- Create: `src/scripts/nav.ts`
- Create: `tests/chrome.spec.ts`
- Delete: `src/components/LangSwitcher.astro`

**Interfaces:**
- Consumes: tokens, layout classes, `motion.css`.
- Produces: `initNav()`, and a `.navbar` that is transparent over a hero when given `overlay`, solid otherwise.

- [ ] **Step 1: Write nav.ts**

```ts
/**
 * Solidifies the overlay navbar once the page scrolls past the hero's top
 * band, and drives the mobile menu toggle.
 */
export function initNav(): void {
  const nav = document.querySelector<HTMLElement>('[data-nav]');
  if (!nav) return;

  const toggle = nav.querySelector<HTMLButtonElement>('[data-nav-toggle]');
  const menu = nav.querySelector<HTMLElement>('[data-nav-menu]');

  if (toggle && menu) {
    toggle.addEventListener('click', () => {
      const open = menu.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
    });
    // Escape closes it, and focus returns to the control that opened it.
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape' || !menu.classList.contains('is-open')) return;
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.focus();
    });
  }

  if (!nav.classList.contains('navbar--overlay')) return;

  const onScroll = () => {
    nav.classList.toggle('is-solid', window.scrollY > 80);
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
```

- [ ] **Step 2: Add the menu label to both locales**

The toggle button needs an accessible name, and it must be localised. Add a `menu` key under `nav` in **both** files, or Task 3's parity test fails.

In `src/i18n/en.json`, inside the `nav` block:

```json
    "menu": "Menu",
```

In `src/i18n/gr.json`, inside the `nav` block:

```json
    "menu": "Μενού",
```

Run: `npm run test:unit -- src/i18n/parity.test.ts`
Expected: PASS. If it fails, the key went into one file only.

- [ ] **Step 3: Rewrite Navbar.astro**

Keep the existing props and the `data-lang-switch` values exactly: `gr` is a path segment, not a language tag, and changing it breaks the language switcher.

This markup inlines the `EN`/`ΕΛ` switcher, so `src/components/LangSwitcher.astro` becomes dead code. Delete it in the same commit:

```bash
git rm -q src/components/LangSwitcher.astro
```

Confirm nothing else imported it:

Run: `grep -rn "LangSwitcher" src/`
Expected: no matches.

```astro
---
import type { Locale } from '../i18n/locales';
import { t } from '../i18n/t';

type NavKey = 'home' | 'kimon' | 'irida' | 'location' | 'contact';
interface Props { lang: Locale; canonicalPath: string; current?: NavKey; overlay?: boolean; }
const { lang, canonicalPath, current, overlay = false } = Astro.props;
const s = t(lang);
const base = `/${lang}`;
const links: { key: NavKey; href: string; label: string }[] = [
  { key: 'home', href: `${base}/`, label: s.nav.home },
  { key: 'kimon', href: `${base}/kimon`, label: s.nav.kimon },
  { key: 'irida', href: `${base}/irida`, label: s.nav.irida },
  { key: 'location', href: `${base}/location`, label: s.nav.location },
  { key: 'contact', href: `${base}/contact`, label: s.nav.contact },
];
---
<header class:list={['navbar', overlay && 'navbar--overlay']} data-nav>
  <div class="container container--wide navbar__inner">
    <a href={`${base}/`} class="navbar__logo">
      <img src="/img/nav/logo_marinos.png" alt="Marinos-Aparts" width="150" height="40" />
    </a>

    <button class="navbar__toggle" type="button" data-nav-toggle
            aria-controls="nav-menu" aria-expanded="false" aria-label={s.nav.menu}>
      <span></span><span></span><span></span>
    </button>

    <nav class="navbar__menu" id="nav-menu" data-nav-menu>
      <ul class="navbar__links">
        {links.map((l) => (
          <li>
            <a href={l.href} class:list={['navbar__link', current === l.key && 'is-active']}
               aria-current={current === l.key ? 'page' : undefined}>{l.label}</a>
          </li>
        ))}
        <li>
          <a href="https://reservations.bookoncloud.com/welcome/kimon" target="_blank"
             rel="noopener noreferrer" class="btn btn--primary navbar__book">{s.nav.book}</a>
        </li>
      </ul>
      <ul class="navbar__langs">
        <li><a href={`/en${canonicalPath}/`} data-lang-switch="en"
               class:list={['navbar__lang', lang === 'en' && 'is-active']} hreflang="en">EN</a></li>
        <li><a href={`/gr${canonicalPath}/`} data-lang-switch="gr"
               class:list={['navbar__lang', lang === 'gr' && 'is-active']} hreflang="el">ΕΛ</a></li>
      </ul>
    </nav>
  </div>
</header>

<script>
  import { initNav } from '../scripts/nav';
  initNav();
</script>

<style>
  .navbar {
    position: sticky; top: 0; z-index: 50;
    background: var(--c-deep-sea);
    transition: background var(--dur) var(--ease-out),
                box-shadow var(--dur) var(--ease-out);
  }
  .navbar--overlay { position: fixed; inset-inline: 0; background: transparent; }
  .navbar--overlay.is-solid {
    background: var(--c-deep-sea);
    box-shadow: 0 1px 24px rgb(11 60 83 / 0.28);
  }

  .navbar__inner {
    display: flex; align-items: center; gap: var(--sp-6);
    min-height: 72px;
  }
  .navbar__logo { flex: none; line-height: 0; }
  .navbar__logo img { height: 40px; width: auto; }

  .navbar__menu { flex: 1; display: flex; align-items: center; gap: var(--sp-6); justify-content: flex-end; }
  .navbar__links, .navbar__langs { display: flex; align-items: center; gap: var(--sp-5); }
  .navbar__langs { gap: var(--sp-3); padding-left: var(--sp-5); border-left: 1px solid rgb(255 255 255 / 0.25); }

  .navbar__link {
    color: var(--c-white); text-decoration: none;
    font-size: var(--fs-small); font-weight: 500;
    letter-spacing: 0.12em; text-transform: uppercase;
    /* 44px target without enlarging the visual row. */
    display: inline-flex; align-items: center; min-height: 44px;
    white-space: nowrap;
  }
  .navbar__link:hover, .navbar__link:focus-visible { color: var(--c-sand); }
  .navbar__link.is-active { box-shadow: inset 0 -2px 0 var(--c-sand); }

  .navbar__lang {
    color: rgb(255 255 255 / 0.7); text-decoration: none;
    font-size: var(--fs-eyebrow); letter-spacing: 0.1em; font-weight: 600;
    display: inline-flex; align-items: center; min-height: 44px; padding-inline: var(--sp-2);
  }
  .navbar__lang.is-active { color: var(--c-white); }

  .navbar__book { padding: 0.625rem 1.25rem; min-height: 40px; }

  .navbar__toggle {
    display: none; margin-left: auto;
    width: 44px; height: 44px; padding: 10px;
    background: none; border: 0; cursor: pointer;
    flex-direction: column; justify-content: space-between;
  }
  .navbar__toggle span { display: block; height: 2px; background: var(--c-white); border-radius: 2px; }

  /* Greek nav labels run appreciably longer than English, so the row collapses
     on available space rather than at a width tuned to the English copy. */
  @media (max-width: 1100px) {
    .navbar__toggle { display: flex; }
    .navbar__menu {
      position: absolute; inset-inline: 0; top: 100%;
      flex-direction: column; align-items: stretch; gap: 0;
      background: var(--c-deep-sea);
      padding: var(--sp-4) var(--gutter) var(--sp-6);
      display: none;
    }
    .navbar__menu.is-open { display: flex; }
    .navbar__links { flex-direction: column; align-items: stretch; gap: 0; }
    .navbar__langs { border-left: 0; padding-left: 0; padding-top: var(--sp-4); }
    .navbar__book { margin-top: var(--sp-4); align-self: flex-start; }
  }
</style>
```

- [ ] **Step 4: Write the chrome tests**

Create `tests/chrome.spec.ts`. The first test is Review Focus item 3, the second is item 4.

```ts
import { test, expect } from '@playwright/test';

const WIDTHS = [1440, 1280, 1100, 900, 390];

test('Greek navigation never overflows its container at any width', async ({ page }) => {
  // Greek runs 15-30% longer than English. A nav tuned to the English copy
  // clips or wraps on /gr/ and nothing in an English-only test would catch it.
  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/gr/');

    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(0);

    const menuHidden = await page.locator('[data-nav-menu]').evaluate(
      (el) => getComputedStyle(el).display === 'none'
    );
    if (menuHidden) continue; // collapsed into the mobile menu, nothing to measure

    for (const link of await page.locator('.navbar__link').all()) {
      const box = await link.boundingBox();
      expect(box, 'nav link has no box').not.toBeNull();
      // One line: a wrapped nav item is the visible symptom of overflow.
      expect(box!.height, `nav link wrapped at ${width}px`).toBeLessThan(60);
    }
  }
});

test('every nav link is reachable and visibly focused by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/en/');

  const first = page.locator('.navbar__link').first();
  await first.focus();
  await expect(first).toBeFocused();

  const outline = await first.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline, 'focused nav link has no visible outline').not.toBe('none');
});

test('the mobile menu opens, closes on Escape, and reports its state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/en/');

  const toggle = page.locator('[data-nav-toggle]');
  const menu = page.locator('[data-nav-menu]');

  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await toggle.click();
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(toggle).toBeFocused();
});

test('the language switcher keeps its path segments', async ({ page }) => {
  // `gr` is a URL segment; `el` is the language tag. Conflating them breaks
  // both the switcher and hreflang.
  await page.goto('/en/kimon/');
  await expect(page.locator('[data-lang-switch="gr"]')).toHaveAttribute('href', '/gr/kimon/');
  await expect(page.locator('[data-lang-switch="gr"]')).toHaveAttribute('hreflang', 'el');
});
```

- [ ] **Step 5: Run the tests**

Run: `npm test -- tests/chrome.spec.ts`
Expected: PASS, 4 tests.

If the Greek overflow test fails, widen the collapse breakpoint in the `@media (max-width: 1100px)` rule rather than shrinking the Greek copy.

- [ ] **Step 6: Commit**

```bash
git add src/components/Navbar.astro src/scripts/nav.ts tests/chrome.spec.ts src/i18n/en.json src/i18n/gr.json
git commit -m "$(cat <<'EOF'
feat(nav): rebuild the navbar on the new design system

Sticky by default, transparent over a hero when given `overlay` and
solidifying past 80px of scroll. The mobile menu reports aria-expanded,
closes on Escape and returns focus to its toggle.

The Greek nav is tested for overflow at five widths: Greek labels run
appreciably longer than English, and a nav tuned to the English copy clips
on /gr/ without any English-only test noticing.

data-lang-switch values are unchanged: `gr` is a path segment, `el` is the
language tag.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 11: One source of truth for the contact details

The site currently states two different phone numbers on the same page: the header and footer show `+30 6909 025 820` (embedded inside the i18n string `header.reservations`), while the JSON-LD in `BaseLayout.astro` advertises `+30 6936 772 821` to search engines. One of them is wrong, and today fixing it means finding three places.

**Files:**
- Create: `src/site.ts`, `src/site.test.ts`
- Modify: `src/layouts/BaseLayout.astro`, `src/components/HeaderBottom.astro`, `src/components/Footer.astro`, `src/i18n/en.json`, `src/i18n/gr.json`

**Interfaces:**
- Consumes: nothing.
- Produces: `CONTACT` from `src/site.ts`, shaped `{ phone: string; phoneHref: string; email: string; emailHref: string }`. Task 12's restyled footer reads it rather than reintroducing literals.

- [ ] **Step 1: Write the failing test**

Create `src/site.test.ts`:

```ts
import { test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { CONTACT } from './site';

test('the phone href is the dialable form of the displayed number', () => {
  expect(CONTACT.phoneHref).toBe(`tel:${CONTACT.phone.replace(/\s/g, '')}`);
  expect(CONTACT.emailHref).toBe(`mailto:${CONTACT.email}`);
});

test('no phone number is hardcoded outside src/site.ts', () => {
  // The defect this prevents: header, footer and JSON-LD drifting apart, which
  // is how the site came to advertise two different numbers at once.
  const files = [
    'src/layouts/BaseLayout.astro',
    'src/components/HeaderBottom.astro',
    'src/components/Footer.astro',
    'src/i18n/en.json',
    'src/i18n/gr.json',
  ];
  for (const path of files) {
    const text = readFileSync(path, 'utf8');
    expect(text, `${path} hardcodes a phone number`).not.toMatch(/\+30[-\s]?\d{4}[-\s]?\d{3}[-\s]?\d{3}/);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:unit -- src/site.test.ts`
Expected: FAIL. The import of `./site` cannot resolve, and once it does, `BaseLayout.astro` and both locale files still carry literal numbers.

- [ ] **Step 3: Write src/site.ts**

```ts
/**
 * Site-wide facts that appear in more than one place.
 *
 * The phone number lives here because it previously appeared in three
 * places that disagreed: the header and footer said +30 6909 025 820 while
 * the JSON-LD advertised +30 6936 772 821 to search engines.
 *
 * `phone` is pending confirmation from the owner. It is set to the number
 * that was actually displayed to visitors, in two of the three places.
 * Correcting it is a one-line change here.
 */
const PHONE = '+30 6909 025 820';
const EMAIL = 'marinosaparts@gmail.com';

export const CONTACT = {
  phone: PHONE,
  phoneHref: `tel:${PHONE.replace(/\s/g, '')}`,
  email: EMAIL,
  emailHref: `mailto:${EMAIL}`,
} as const;
```

- [ ] **Step 4: Take the number out of the i18n strings**

The number is currently baked into the copy. In `src/i18n/en.json`, change:

```json
    "reservations": "<strong>Reservations : </strong>+30 6909 025 820",
```

to:

```json
    "reservations": "Reservations",
```

In `src/i18n/gr.json`, change the matching `header.reservations` value to just its label text, with no number and no `<strong>` markup:

```json
    "reservations": "Κρατήσεις",
```

The `<strong>` wrapper moves into the component, where it belongs, and the value stops being HTML. This also means `set:html` is no longer needed for it.

- [ ] **Step 5: Use it in HeaderBottom.astro**

Add `import { CONTACT } from '../site';` to the frontmatter, and render the label and number separately:

```astro
    <span><strong>{s.header.reservations}:</strong> <a href={CONTACT.phoneHref}>{CONTACT.phone}</a></span>
```

- [ ] **Step 6: Use it in the JSON-LD**

In `src/layouts/BaseLayout.astro`, add `import { CONTACT } from '../site';` to the frontmatter, then replace both hardcoded `telephone` values in the structured data:

```astro
      contactPoint: [
        { '@type': 'ContactPoint', telephone: CONTACT.phone, contactType: 'customer service' },
        { '@type': 'ContactPoint', telephone: CONTACT.phone, contactType: 'reservations' },
      ],
```

Also add `email: CONTACT.email,` alongside `url:` in the same object, since the footer already publishes it.

- [ ] **Step 7: Use it in Footer.astro**

Task 7 left literal contact details in the footer list. Add `import { CONTACT } from '../site';` to the frontmatter and replace those two lines:

```astro
            <li class="tm-footer-link"><Icon name="phone" /> <a href={CONTACT.phoneHref}>{CONTACT.phone}</a></li>
            <li class="tm-footer-link"><Icon name="envelope" /> <a href={CONTACT.emailHref}>{CONTACT.email}</a></li>
```

The `tm-footer-link` class stays for now; Task 12 removes it along with the rest of the footer's old markup.

- [ ] **Step 8: Run the tests**

Run: `npm run test:unit -- src/site.test.ts src/i18n/parity.test.ts && npx astro check`
Expected: PASS, and 0 type errors.

- [ ] **Step 9: Commit**

```bash
git add src/site.ts src/site.test.ts src/layouts/BaseLayout.astro src/components/HeaderBottom.astro src/components/Footer.astro src/i18n/en.json src/i18n/gr.json
git commit -m "$(cat <<'EOF'
fix: give the contact details one source of truth

The site stated two different phone numbers on the same page: the header
and footer showed +30 6909 025 820, embedded inside an i18n copy string,
while the JSON-LD advertised +30 6936 772 821 to search engines.

Both now read src/site.ts, and a test asserts no number is hardcoded
anywhere else, so the three cannot drift apart again.

The value is set to the number visitors were actually shown, pending
confirmation from the owner of which is correct. That correction is now a
one-line change.

The number also comes out of the i18n strings: it is a fact, not copy, and
header.reservations stops being HTML as a result.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 12: Restyle the footer

**Files:**
- Modify: `src/components/Footer.astro`, `src/components/ScrollToTop.astro`, `src/components/WeatherWidget.astro`

**Interfaces:**
- Consumes: tokens, layout classes, `Icon`.
- Produces: an unchanged `Footer` prop surface (`lang`, `mapFocus?`).

- [ ] **Step 1: Rewrite Footer.astro's markup and styles**

Keep every link, the registry number, the copyright and the developer credit. Replace the Bootstrap column wrappers with the grid primitive.

```astro
---
import type { Locale } from '../i18n/locales';
import { t } from '../i18n/t';
import Map from './Map.astro';
import WeatherWidget from './WeatherWidget.astro';
import ScrollToTop from './ScrollToTop.astro';
import Icon from './Icon.astro';
import { CONTACT } from '../site';

interface Props { lang: Locale; mapFocus?: 'kimon' | 'irida'; }
const { lang, mapFocus } = Astro.props;
const s = t(lang);
const base = `/${lang}`;
const year = new Date().getFullYear();
const links = [
  { href: `${base}/`, label: s.nav.home },
  { href: `${base}/kimon`, label: s.nav.kimon },
  { href: `${base}/irida`, label: s.nav.irida },
  { href: `${base}/location`, label: s.nav.location },
  { href: `${base}/contact`, label: s.nav.contact },
];
---
<footer class="footer">
  <div class="container container--wide">
    <div class="footer__grid">
      <div>
        <h3 class="footer__title">{s.nav.contact}</h3>
        <ul class="footer__list">
          <li><Icon name="map-pin" /><span>{s.footer.address}</span></li>
          <li><Icon name="phone" /><a href={CONTACT.phoneHref}>{CONTACT.phone}</a></li>
          <li><Icon name="envelope" /><a href={CONTACT.emailHref}>{CONTACT.email}</a></li>
        </ul>
      </div>

      <div>
        <h3 class="footer__title">{s.footer.menu}</h3>
        <ul class="footer__list">
          {links.map((l) => <li><a href={l.href}>{l.label}</a></li>)}
        </ul>
      </div>

      <div class="footer__map"><Map focus={mapFocus} /></div>
      <div class="footer__weather"><WeatherWidget lang={lang} /></div>
    </div>

    <div class="footer__base">
      <p>{s.footer.registryNo}</p>
      <p>Copyright <span id="current-year">{year}</span> Marinos-Aparts</p>
      <p><small>developed by <a href="https://github.com/stavroskapris" target="_blank" rel="noopener noreferrer">stavroskapris</a></small></p>
    </div>
  </div>
  <ScrollToTop />
</footer>

<style>
  .footer {
    background: var(--c-deep-sea);
    color: var(--c-white);
    padding-block: var(--sp-8) var(--sp-6);
  }
  .footer__grid {
    display: grid;
    grid-template-columns: 1.1fr 0.8fr 1.3fr 1fr;
    gap: var(--sp-7);
  }
  .footer__title {
    color: var(--c-white);
    font-size: var(--fs-display-m);
    margin-bottom: var(--sp-4);
  }
  .footer__list { display: flex; flex-direction: column; gap: var(--sp-3); }
  .footer__list li { display: flex; align-items: flex-start; gap: var(--sp-3); }
  .footer__list :global(.icon) { color: var(--c-sand); margin-top: 0.25em; }
  .footer__list a { color: var(--c-white); text-decoration: none; min-height: 44px; display: inline-flex; align-items: center; }
  .footer__list a:hover, .footer__list a:focus-visible { color: var(--c-sand); text-decoration: underline; }

  .footer__map :global(#osm-map) {
    height: 240px; width: 100%; border-radius: var(--radius-card);
  }

  /* The okairos widget injects its own inline Arial styling that cannot be
     overridden, so it is boxed on a light card rather than blended in. */
  .footer__weather {
    background: var(--c-white);
    border-radius: var(--radius-card);
    padding: var(--sp-3);
    color: var(--c-ink);
  }

  .footer__base {
    display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-6);
    justify-content: space-between; align-items: center;
    margin-top: var(--sp-7); padding-top: var(--sp-5);
    border-top: 1px solid rgb(255 255 255 / 0.18);
    font-size: var(--fs-small); color: rgb(255 255 255 / 0.75);
  }
  .footer__base p { margin: 0; }
  .footer__base a { color: rgb(255 255 255 / 0.9); }

  @media (max-width: 1100px) { .footer__grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 640px) { .footer__grid { grid-template-columns: minmax(0, 1fr); } }
</style>
```

- [ ] **Step 2: Restyle ScrollToTop**

```astro
---
import Icon from './Icon.astro';
---
<button type="button" class="scroll-top" aria-label="Scroll to top" hidden>
  <Icon name="chevron-up" size={20} />
</button>

<script>
  const btn = document.querySelector<HTMLButtonElement>('.scroll-top');
  if (btn) {
    const toggle = () => { btn.hidden = window.scrollY <= 500; };
    toggle();
    window.addEventListener('scroll', toggle, { passive: true });
    btn.addEventListener('click', () => {
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduced ? 'auto' : 'smooth' });
    });
  }
</script>

<style>
  .scroll-top {
    position: fixed; right: var(--sp-5); bottom: var(--sp-5); z-index: 40;
    width: 44px; height: 44px;
    display: inline-flex; align-items: center; justify-content: center;
    background: var(--c-sivota-blue); color: var(--c-white);
    border: 0; border-radius: var(--radius-btn); cursor: pointer;
    transition: background var(--dur-fast) var(--ease-out);
  }
  .scroll-top[hidden] { display: none; }
  .scroll-top:hover, .scroll-top:focus-visible { background: var(--c-deep-sea); }
</style>
```

Note this changes the element from `<a href="#">` to `<button>`. It performs an action rather than navigating, and the old version pushed `#` into the URL.

- [ ] **Step 3: Type-check and build**

Run: `npx astro check && npm run build`
Expected: 0 errors; build succeeds.

- [ ] **Step 4: Add a footer test to tests/chrome.spec.ts**

Append:

```ts
test('the footer keeps its contact details and legal text', async ({ page }) => {
  await page.goto('/en/');
  const footer = page.locator('footer.footer');
  await expect(footer.getByRole('link', { name: '+30 6909 025 820' })).toBeVisible();
  await expect(footer.getByRole('link', { name: 'marinosaparts@gmail.com' })).toBeVisible();
  await expect(footer.getByText(/Marinos-Aparts/)).toBeVisible();
});

test('scroll to top is a button, appears past 500px and does not dirty the URL', async ({ page }) => {
  await page.goto('/en/');
  const btn = page.getByRole('button', { name: 'Scroll to top' });
  await expect(btn).toBeHidden();

  await page.evaluate(() => window.scrollTo(0, 1200));
  await expect(btn).toBeVisible();

  await btn.click();
  expect(new URL(page.url()).hash).toBe('');
});
```

- [ ] **Step 5: Run and commit**

Run: `npm test -- tests/chrome.spec.ts`
Expected: PASS, 6 tests.

```bash
git add src/components/Footer.astro src/components/ScrollToTop.astro tests/chrome.spec.ts
git commit -m "$(cat <<'EOF'
feat(footer): rebuild the footer on the new design system

Scroll-to-top becomes a <button>: it performs an action rather than
navigating, and the old <a href="#"> pushed a bare hash into the URL. It
also honours prefers-reduced-motion instead of always smooth-scrolling.

The okairos weather widget injects inline Arial styling that cannot be
overridden, so it is boxed on a light card rather than blended.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 13: Port the five pages off the Bootstrap grid

This is the task that lets Bootstrap be deleted. It is a **structural** port, not the redesign: pages should look plain and correct. Slices 2 to 5 add each page's designed composition.

**Files:**
- Modify: `src/pages/[lang]/index.astro`, `kimon.astro`, `irida.astro`, `location.astro`, `contact.astro`, `src/components/ResortPage.astro`, `src/components/Gallery.astro`, `src/components/HeaderBottom.astro`, `src/components/ContactForm.astro`

**Interfaces:**
- Consumes: `Section` from Task 9, layout classes from Task 5.
- Produces: five pages with no `col-*`, `row`, `container-fluid` or `tm-*` class remaining.

- [ ] **Step 1: Write the failing test**

Append to `tests/chrome.spec.ts`:

```ts
const PAGES = ['/en/', '/en/kimon/', '/en/irida/', '/en/location/', '/en/contact/',
               '/gr/', '/gr/kimon/', '/gr/irida/', '/gr/location/', '/gr/contact/'];

test('no Bootstrap or templatemo classes survive on any page', async ({ page }) => {
  for (const path of PAGES) {
    await page.goto(path);
    const stale = await page.evaluate(() => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll('[class]'))) {
        for (const cls of Array.from(el.classList)) {
          if (/^(col-|row$|container-fluid$|tm-|navbar-toggleable|img-fluid|img-rounded|text-xs-|hidden-md-up)/.test(cls)) {
            bad.push(cls);
          }
        }
      }
      return Array.from(new Set(bad));
    });
    expect(stale, `stale framework classes on ${path}`).toEqual([]);
  }
});

test('no page scrolls horizontally at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of PAGES) {
    await page.goto(path);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(0);
  }
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm test -- tests/chrome.spec.ts -g "Bootstrap or templatemo"`
Expected: FAIL, listing `col-xs-12`, `tm-section`, `container-fluid` and friends.

- [ ] **Step 3: Port index.astro**

Replace the body between `<Navbar ... />` and `<Footer ... />`:

```astro
  <Section>
    <div class="container--narrow" data-reveal>
      <span class="eyebrow">{s.nav.home}</span>
      <h1>{s.home.intro}</h1>
      <p class="lead">{s.home.welcome}</p>
    </div>
  </Section>

  <Section ground="sand">
    <div class="stack stack--wide">
      <SplitFeature
        heading={s.nav.kimon} body={s.home.kimonTitle}
        href={`/${lang}/kimon`} cta={s.home.readMore}
        image={kimonHome} alt="Kimon Resort" />
      <SplitFeature
        heading={s.nav.irida} body={s.home.iridaTitle}
        href={`/${lang}/irida`} cta={s.home.readMore}
        image={iridaHome} alt="Irida Resort" reverse />
    </div>
  </Section>
```

Add to the frontmatter imports:

```astro
import Section from '../../components/Section.astro';
import SplitFeature from '../../components/SplitFeature.astro';
```

and remove the now-unused `Image` import if nothing else on the page uses it.

Replace `<div class="tm-home-img-container"></div>` with nothing for now. The hero arrives in slice 2.

- [ ] **Step 4: Port ResortPage.astro**

Replace everything between `<HeaderBottom ... />` and `<Footer ... />`:

```astro
  <Section>
    <div class="grid grid--2">
      <div data-reveal>
        <h1>{resort.title}</h1>
        <p class="lead">{resort.main}</p>
      </div>
      <div data-reveal data-reveal-delay="120">
        <h2>{resort.facilitiesTitle}</h2>
        <FactGrid columns={2} items={[...facilityCol1, ...facilityCol2].map((label) => ({ label }))} />
      </div>
    </div>
  </Section>

  <Section ground="sand">
    <h2>{resort.gallery}</h2>
    <Gallery items={items} figureClass={figureClass} />
  </Section>
```

Add `import Section from './Section.astro';` and `import FactGrid from './FactGrid.astro';` to the frontmatter, and delete the `heroClass` prop usage line `<div class={heroClass}></div>`. Leave `heroClass` in the `Props` interface: slice 3 uses it for the real hero and removing it now would mean editing both resort pages twice.

- [ ] **Step 5: Port location.astro and contact.astro**

`location.astro`: replace the `<section class="tm-section">` block with:

```astro
  <Section>
    <div class="container--narrow" data-reveal>
      <h1>{s.location.title}</h1>
      <p class="lead">{s.location.main}</p>
    </div>
  </Section>

  <Section ground="sand">
    <h2>{s.location.beachTitle}</h2>
    <Gallery items={items} figureClass="location" />
  </Section>
```

`contact.astro`: replace its `<section class="tm-section">` block with:

```astro
  <Section>
    <ContactForm lang={lang} />
  </Section>
```

Add the `Section` import to both, and delete the `tm-location-img-container` and `tm-contact-img-container` divs.

- [ ] **Step 6: Port Gallery.astro's figure markup**

Replace the `<div id="gallery" class="gallery">` wrapper and its `<style>`-less figures with a grid. Change only the wrapper, the `figure` class list and add a scoped `<style>`; **leave the `<script>` block and the global PhotoSwipe caption styles exactly as they are.**

```astro
<div id="gallery" class="gallery grid grid--3">
  {resolvedItems.map((item) => (
    <figure class:list={['gallery__item', figureClass]} itemprop="associatedMedia">
      {item.heading && <h3 class="gallery__heading">{item.heading}</h3>}
      <a class="hover-zoom gallery__link"
         href={item.fullSrc}
         data-pswp-width={item.full.width}
         data-pswp-height={item.full.height}
         data-pswp-caption={item.caption ?? ''}
         itemprop="contentUrl"
      >
        <Image src={item.thumb} alt={item.alt} width={500} height={330} itemprop="thumbnail" />
      </a>
    </figure>
  ))}
</div>
```

Add this scoped style block alongside the existing global one:

```astro
<style>
  .gallery { margin: 0; }
  .gallery__item { margin: 0; }
  .gallery__heading { font-size: var(--fs-display-m); margin-bottom: var(--sp-3); }
  .gallery__link {
    display: block; border-radius: var(--radius-card);
    /* Reserved before the thumbnail decodes so the grid does not shift. */
    aspect-ratio: 3 / 2;
  }
  .gallery__link img { width: 100%; height: 100%; object-fit: cover; }
</style>
```

The thumbnail `width`/`height` went from 250×165 to 500×330 so the tiles are not upscaled in a wider grid. The beach sources are 600×400 and up, so 500 wide is within native size for all twelve.

- [ ] **Step 7: Port HeaderBottom.astro**

```astro
<div class="headerbar">
  <div class="container container--wide headerbar__inner">
    <span><strong>{s.header.reservations}:</strong> <a href={CONTACT.phoneHref}>{CONTACT.phone}</a></span>
    <span class="headerbar__social">
      <span set:html={s.header.findus} />
      <a href="https://www.facebook.com/marinosaparts.sivota/" target="_blank" rel="noopener noreferrer" aria-label="Marinos Apartments on Facebook"><Icon name="facebook" /></a>
      <a href="https://www.instagram.com/marinosaparts/" target="_blank" rel="noopener noreferrer" aria-label="Marinos Apartments on Instagram"><Icon name="instagram" /></a>
    </span>
  </div>
</div>

<style>
  .headerbar { background: var(--c-sand); font-size: var(--fs-small); }
  .headerbar__inner {
    display: flex; flex-wrap: wrap; gap: var(--sp-3) var(--sp-5);
    align-items: center; justify-content: space-between;
    padding-block: var(--sp-2);
  }
  .headerbar__social { display: inline-flex; align-items: center; gap: var(--sp-3); }
  .headerbar__social a {
    color: var(--c-deep-sea);
    display: inline-flex; align-items: center; justify-content: center;
    width: 44px; height: 44px;
  }
  .headerbar__social a:hover, .headerbar__social a:focus-visible { color: var(--c-sivota-blue); }
</style>
```

- [ ] **Step 8: Reclass ContactForm.astro, and nothing else**

The form carries `col-xs-12 col-sm-12 col-md-12 col-lg-8 col-xl-8`, `text-xs-center`, `tm-btn`, `tm-contact-form`, `tm-form-description`, `tm-form-title` and `tm-gold-text`. Step 1's test asserts none of those survive on `/en/contact/`, so they must go.

**This is a class-attribute edit only.** Read this list before touching the file:

- The `<script>` block is untouched, byte-for-byte. It is freshly verified in production.
- Every `id` attribute is preserved exactly. The script resolves fields with `document.getElementById`, so a renamed id silently breaks submission.
- The `.field-error` class and every `data-for` attribute are preserved. The script selects `.field-error[data-for="${name}"]`.
- `g-recaptcha` is preserved. It is Google's hook, not ours.
- `form-control` and `form-group` may be replaced, since nothing selects them.

Make these substitutions:

| Remove | Replace with |
|---|---|
| `col-xs-12 col-sm-12 col-md-12 col-lg-8 col-xl-8 text-xs-center contact-form` | `contact-form` |
| `tm-contact-form` | `contact-form__form` |
| `tm-gold-text tm-form-title` | `contact-form__title` |
| `tm-form-description` | `contact-form__description` |
| `tm-btn btn-block` | `btn btn--primary` |
| `form-group` | `field` |
| `form-control` | `field__input` |

Then add a scoped `<style>` block giving `.field`, `.field__input`, `.contact-form__title` and `.contact-form__description` plain, correct styling on the new tokens. Inputs need `width: 100%`, a visible border, `min-height: 44px` and `font: inherit`, which browsers do not inherit for form controls.

- [ ] **Step 9: Run the full suite**

Run: `npx astro check && npm run test:unit && npm test`
Expected: `astro check` 0 errors; all unit tests pass; all Playwright specs pass, including the two new ones from Step 1.

Existing specs in `tests/home.spec.ts`, `kimon.spec.ts`, `irida.spec.ts`, `location.spec.ts` and `mobile.spec.ts` will have selectors that no longer exist. Update those selectors to the new class names; do not weaken an assertion to make it pass. If a spec asserted something the redesign genuinely removed, delete that assertion and say so in the commit message.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(pages): port all five pages off the Bootstrap grid

Structural only: pages look plain but correct, so staging is never broken
while slices 2-5 add each page's designed composition.

ContactForm is reclassed but its script is byte-for-byte unchanged, along
with every id, the .field-error class and every data-for attribute, which
are what that script actually selects on. tests/contact.spec.ts passes.

Gallery thumbnails go from 250x165 to 500x330 so tiles are not upscaled in
a wider grid; the smallest beach source is 600x400, so 500 wide stays
within native size for all twelve.

heroClass stays on ResortPage's Props even though nothing renders it yet:
slice 3 uses it, and removing it now means editing both resort pages twice.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 14: Delete Bootstrap and templatemo, and hold the CSS budget

**Files:**
- Delete: `src/styles/bootstrap.min.css`, `src/styles/templatemo-style.css`
- Modify: `package.json` (the `check:links` skip list), `CLAUDE.md`
- Create: `src/styles/budget.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: the final CSS payload.

- [ ] **Step 1: Delete the two stylesheets**

```bash
git rm -q src/styles/bootstrap.min.css src/styles/templatemo-style.css
```

Confirm nothing imports them:

Run: `grep -rn "bootstrap.min\|templatemo" src/ package.json`
Expected: no matches.

- [ ] **Step 2: Write the budget test**

Create `src/styles/budget.test.ts`:

```ts
import { test, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readdirSync, statSync, existsSync } from 'node:fs';

test('the built CSS stays within budget', () => {
  if (!existsSync('dist')) execSync('npm run build', { stdio: 'inherit' });

  const dir = 'dist/_astro';
  const bytes = readdirSync(dir)
    .filter((f) => f.endsWith('.css'))
    .reduce((total, f) => total + statSync(`${dir}/${f}`).size, 0);

  const kb = bytes / 1024;
  // Was ~125KB, of which bootstrap.min.css alone was 95KB. This budget is a
  // ratchet: if a change needs more, the number moves deliberately and the
  // commit says why. Font CSS is excluded below because it scales with
  // subsets, not with our authoring.
  expect(kb, `built CSS is ${kb.toFixed(1)}KB`).toBeLessThan(60);
}, 180_000);
```

The 60KB ceiling includes the Fontsource subset CSS, which is why it is not the 15 to 20KB the spec targets for hand-written CSS. Record the actual figure in the commit message.

- [ ] **Step 3: Run it**

Run: `npm run build && npm run test:unit -- src/styles/budget.test.ts`
Expected: PASS. Note the reported KB figure for the commit message.

- [ ] **Step 4: Prune the dead entries from the link-checker skip list**

In `package.json`, the `check:links` skip regex still excuses hosts nothing requests any more. Change:

```
--skip "^https?://(www\\.)?(marinos-aparts\\.gr|okairos|kit\\.fontawesome|fonts\\.googleapis|unpkg|photoswipe|facebook|instagram|reservations\\.bookoncloud|googletagmanager|google\\.com|gstatic)"
```

to:

```
--skip "^https?://(www\\.)?(marinos-aparts\\.gr|okairos|unpkg|photoswipe|facebook|instagram|reservations\\.bookoncloud|googletagmanager|google\\.com|gstatic)"
```

Leaving `kit.fontawesome` and `fonts.googleapis` in place would hide a regression: if either ever came back, the link checker would stay silent about it.

- [ ] **Step 5: Update CLAUDE.md**

In the architecture tree, change:

```
  styles/              # bootstrap + template CSS
```

to:

```
  styles/              # design tokens, base, layout, motion, self-hosted fonts
```

Add to the Gotchas section:

```
- **The palette and its contrast ratios are enforced by `src/styles/tokens.test.ts`.** Changing a
  hex without re-running it fails the build rather than quietly shipping unreadable text. The
  threshold is 4.5:1, the body-text level, because these colours carry paragraphs.
- **Fonts are self-hosted and the Greek subsets are imported explicitly.** Fontsource's default
  import is Latin only, so dropping the `greek.css` imports makes `/gr/` fall back to a system
  font with nothing failing. `src/styles/fonts.test.ts` pins it.
- **Scroll reveals hide their content only under `.js` on `<html>`**, set by an inline script in
  `BaseLayout` before first paint. Moving the hidden state out from behind that guard makes a
  blocked or failed bundle render a blank page.
```

- [ ] **Step 6: Run the whole suite and check links**

Run: `npx astro check && npm run test:unit && npm test && npm run check:links:ci`
Expected: everything passes.

- [ ] **Step 7: Commit and push**

```bash
git add -A
git commit -m "$(cat <<'EOF'
refactor(styles): delete Bootstrap 4 and the templatemo stylesheet

bootstrap.min.css was 95KB of the ~125KB CSS payload, end of life, and
used almost entirely for a 12-column grid the markup half-misused:
col-xs-* was removed in Bootstrap 4, so those classes were inert.

A budget test now pins the built CSS so the saving cannot quietly erode.

The check:links skip list no longer excuses kit.fontawesome or
fonts.googleapis: with both gone, keeping them listed would hide their
return.

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
EOF
)"
git push
```

- [ ] **Step 8: Verify staging**

Run: `gh run list --branch redesign --limit 3`
Expected: `Deploy Staging` completes successfully.

Then open `https://d3rdv3w5lgyop6.cloudfront.net/gr/` and confirm: Greek text renders in Manrope, the nav does not overflow, and the page is plain but correct on both desktop and a phone-width window.

---

## Done when

- All five pages render correctly in both locales with no Bootstrap or templatemo class anywhere.
- `npm run test:unit`, `npm test`, `npx astro check` and `npm run check:links:ci` all pass.
- Staging serves the branch and `/gr/` renders in the self-hosted Greek fonts.
- The CSS payload is recorded in Task 13's commit message.

Slice 2 (home page hero, slider and designed composition) gets its own plan, written after this slice has been reviewed on staging.

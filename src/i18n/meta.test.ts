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

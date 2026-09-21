export const LOCALES = ['en', 'gr'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/**
 * URL segment -> BCP 47 language tag, for hreflang and <html lang>.
 * The Greek pages live under /gr/ (a country code) but the language is `el`;
 * search engines discard an hreflang they cannot parse, so the tag must be `el`
 * even though the path stays /gr/.
 */
export const HREFLANG: Record<Locale, string> = { en: 'en', gr: 'el' };

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function getStaticLocalePaths(): { params: { lang: Locale } }[] {
  return LOCALES.map((lang) => ({ params: { lang } }));
}

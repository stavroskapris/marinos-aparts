import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://www.marinos-aparts.gr',
  output: 'static',
  trailingSlash: 'ignore',
  integrations: [
    sitemap({
      // Emits sitemap-index.xml + sitemap-0.xml. The legacy site published
      // /sitemap.xml, so the edge function rewrites that path to the index
      // (infra/cloudfront/redirects.js) and the old Search Console entry keeps
      // working.
      i18n: {
        defaultLocale: 'en',
        // Keys are the URL segment, values the hreflang tag - /gr/ is Greek (`el`).
        locales: { en: 'en', gr: 'el' },
      },
    }),
  ],
});

import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://www.marinos-aparts.gr',
  output: 'static',
  trailingSlash: 'ignore',
  redirects: {
    '/': '/en/',
    '/home.html': '/en/',
    '/kimon.html': '/en/kimon',
    '/irida.html': '/en/irida',
    '/location.html': '/en/location',
    '/contact.html': '/en/contact',
  },
});

import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// This one value drives canonical URLs, sitemap and og:url.
const SITE = 'https://tharindu9910.github.io';
const BASE = '/Product-Web-demo/';

export default defineConfig({
  site: SITE,
  base: BASE,
  output: 'static',
  integrations: [react(), sitemap()],
  vite: { plugins: [tailwindcss()] },
  build: { inlineStylesheets: 'auto' },

  // Fetch a page on hover (touchstart on phones) so the click lands on
  // something already in cache. Deliberately 'hover' and not 'viewport':
  // the nav alone puts ten internal links on every page, and prefetching
  // all of them on sight is exactly the wrong trade on a metered or weak
  // connection. Astro's own runtime additionally skips prefetching when
  // the client reports Save-Data or a 2G-class connection, which lines up
  // with how lib/motion.ts decides whether to load the animation engine.
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
});

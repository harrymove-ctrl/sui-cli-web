import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from '@astrojs/tailwind';
import react from '@astrojs/react';

// https://astro.build/config
export default defineConfig({
  site: 'https://cli.firstmovers.io',
  base: '/blog',
  integrations: [
    mdx(),
    sitemap({
      filter: (page) =>
        !page.includes('/api/') &&
        !page.includes('/spiral') &&
        !page.includes('/theme-preview'),
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: new Date(),
    }),
    tailwind(),
    react(),
  ],
  markdown: {
    shikiConfig: {
      theme: 'github-dark',
    },
  },
});

// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeCitation from 'rehype-citation';
import rehypeFigure from './src/lib/rehype-figure.mjs';

// The site is served from the root of its custom domain. Canonical URLs, the
// sitemap and RSS are built from `site`; asset and link paths from `base`.
export default defineConfig({
  site: 'https://arnavk.dev',
  base: '/',
  trailingSlash: 'ignore',
  integrations: [mdx(), sitemap()],
  markdown: {
    processor: unified({
      remarkPlugins: [remarkMath],
      rehypePlugins: [
        rehypeFigure,
        [rehypeKatex, { strict: false }],
        [
          rehypeCitation,
          {
            // rehype-citation joins `path` and `bibliography` itself, so keep them separate.
            path: fileURLToPath(new URL('.', import.meta.url)),
            bibliography: 'src/content/references.bib',
            linkCitations: true,
          },
        ],
      ],
    }),
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
});

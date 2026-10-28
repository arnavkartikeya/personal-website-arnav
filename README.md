# personal-website-arnav

Personal site and research blog. Astro (static output) + Tailwind, deployed to GitHub Pages by a GitHub Actions workflow on every push to `main`.

## Run it locally

Requires Node 22.23+.

```bash
npm install
npm run dev        # http://localhost:4321, live reload, drafts visible
npm run build      # type-check + production build into dist/ (drafts excluded)
npm run preview    # serve dist/ to check the production build
```

Astro 7 runs `dev` and `preview` as background servers. Stop them with `npx astro dev stop` / `npx astro preview stop`.

To test the build exactly as GitHub Pages will serve it (under `/personal-website-arnav/`):

```bash
BASE=/personal-website-arnav npm run build && BASE=/personal-website-arnav npm run preview
```

## Layout

```
src/
  site.ts                  name, bio links (GitHub, Scholar, X, resume): edit me
  pages/index.astro        homepage / about
  pages/blog/index.astro   post list
  pages/blog/[slug].astro  article page
  pages/rss.xml.ts         RSS feed       (sitemap comes from @astrojs/sitemap)
  content.config.ts        blog post schema
  content/blog/            posts: `slug.md`, `slug.mdx`, `slug/index.md`, or `slug/post.json` (editor)
  lib/lexical.ts           renders editor (Lexical JSON) posts to HTML
  content/references.bib   BibTeX for [@key] citations
  lib/posts.ts             getPosts() (handles the draft filter), url(), formatDate()
  lib/rehype-figure.mjs    ![alt](img.png "caption") → <figure> with <figcaption>
  styles/global.css        palette tokens (light + dark), Tailwind setup
  styles/article.css       article typography
public/                    copied as-is (put resume.pdf here)
scripts/publish.mjs        `npm run publish`
scripts/import-post.mjs    `npm run import-post` (editor → site)
.github/workflows/deploy.yml
```

## Writing a post

```md
---
title: What the KL penalty in RLHF is actually doing
slug: kl-regularized-rl          # optional; defaults to the file/folder name
description: One sentence for the index, RSS and link previews.
date: 2026-09-14
updated: 2026-09-20              # optional
tags: [reinforcement learning]   # optional
draft: true                      # optional; drafts only show under `npm run dev`
---
```

The body supports:

- Math: `$inline$` and `$$display$$` (KaTeX)
- Code: fenced blocks (Shiki, with light and dark themes)
- Tables and footnotes: GFM
- Citations: `[@key]`, pulled from `src/content/references.bib`, with a reference list added at the end
- Figures: `![alt](./plot.png "caption")`. In MDX you can also use `<Figure src={...} caption="..." invertDark />`
- Collapsible sections: `<details><summary>…</summary>…</details>`

A post whose frontmatter doesn't match the schema fails the build, so a broken post can't ship.

## Publishing

```bash
npm run publish               # build, commit src/content + public, push main
npm run publish -- --dry-run  # build and show what would be committed
npm run publish -- -m "msg"   # custom commit message
```

The script stages only `src/content/` and `public/`, so half-finished code changes stay out of a publish commit. Pushing to `main` starts `.github/workflows/deploy.yml`, which builds the site and deploys it to Pages.

### One-time GitHub setup

1. Repo **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Push `main`. The site goes live at `https://arnavkartikeya.github.io/personal-website-arnav/`.
3. Optional: to serve the site at the root, either rename the repo to `arnavkartikeya.github.io` or add a custom domain in Settings → Pages. The workflow reads the base path from GitHub automatically, so no code change is needed.

## Posts from the editor

Posts written in the local Lexical editor (`website_experiments`) are imported, not converted to Markdown. The editor's JSON stays the source of truth, and `src/lib/lexical.ts` renders it at build time: KaTeX for math, Shiki for code, and the editor's own markup for footnotes, figures and tables.

```bash
npm run import-post -- ~/Desktop/opd_stuff/blog --slug understanding-opd \
  [--description "…"] [--tags "rl, distillation"] [--date 2026-10-28] [--draft | --no-draft]
```

The source is a post record (`post.json` with `title`, `subtitle`, `state` and `coverImage`) with its images in `images/<id>.<ext>`, the layout of the editor's working copy. The script writes:

- `src/content/blog/<slug>/post.json`: the metadata plus the Lexical state
- `public/blog/<slug>/*.webp`: images, resized and compressed

The subtitle becomes the description. Re-running for the same slug updates the post and keeps the date, tags, description and draft flag you set before, unless you pass new ones. It also sets `updated` to today. If a post uses a node type the renderer doesn't know, the build fails and names the type; add a case to `src/lib/lexical.ts`.

Then `npm run dev` to review, and `npm run publish`.

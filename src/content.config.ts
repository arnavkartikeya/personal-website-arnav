import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const meta = {
  title: z.string().trim(),
  description: z.string().trim(),
  date: z.coerce.date(),
  updated: z.coerce.date().optional(),
  tags: z.array(z.string()).default([]),
  draft: z.boolean().default(false),
};

/**
 * Markdown/MDX posts: src/content/blog/<slug>.md(x) or <slug>/index.md(x).
 * The id (and URL, /blog/<id>) comes from the `slug` field, else the file path.
 */
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      ...meta,
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase-kebab-case')
        .optional(),
      cover: image().optional(),
      coverAlt: z.string().optional(),
    }),
});

/**
 * Posts written in the local Lexical editor: src/content/blog/<slug>/post.json,
 * holding the metadata plus the editor state, rendered by src/lib/lexical.ts.
 * Images live in public/blog/<slug>/. Written by `npm run import-post`.
 */
const editorPosts = defineCollection({
  loader: glob({
    base: './src/content/blog',
    pattern: '*/post.json',
    generateId: ({ entry }) => entry.split('/')[0],
  }),
  schema: z.object({
    ...meta,
    /** Image filename in public/blog/<slug>/ */
    cover: z.string().optional(),
    coverAlt: z.string().optional(),
    lexical: z.object({ root: z.object({ type: z.literal('root') }).passthrough() }),
  }),
});

export const collections = { blog, editorPosts };

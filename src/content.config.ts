import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

/**
 * Blog posts live in src/content/blog/. Each post is either a single file
 * (`my-post.md`) or a folder (`my-post/index.md` plus its images).
 *
 * The entry id (and so the URL, /blog/<id>) comes from the `slug` field when
 * present, otherwise from the file path. Whatever exports posts into this repo
 * (e.g. the editor's Publish button) only has to produce a file that satisfies
 * this schema; the build fails loudly if it doesn't.
 */
const blog = defineCollection({
  loader: glob({ base: './src/content/blog', pattern: '**/*.{md,mdx}' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      slug: z
        .string()
        .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'slug must be lowercase-kebab-case')
        .optional(),
      description: z.string(),
      date: z.coerce.date(),
      updated: z.coerce.date().optional(),
      tags: z.array(z.string()).default([]),
      draft: z.boolean().default(false),
      cover: image().optional(),
      coverAlt: z.string().optional(),
    }),
});

export const collections = { blog };

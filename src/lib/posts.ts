import { getCollection, type CollectionEntry } from 'astro:content';

/** A blog post from either source: Markdown/MDX, or exported from the editor. */
export type Post = CollectionEntry<'blog'> | CollectionEntry<'editorPosts'>;

/**
 * The only way pages should read posts. Drafts are visible under `astro dev`
 * so you can preview them, and are excluded from every production build
 * (pages, RSS, sitemap), since those only see what this returns.
 */
export async function getPosts(): Promise<Post[]> {
  const visible = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;
  const posts: Post[] = [...(await getCollection('blog', visible)), ...(await getCollection('editorPosts', visible))];
  const ids = new Set<string>();
  for (const post of posts) {
    if (ids.has(post.id)) throw new Error(`Two posts share the slug "${post.id}".`);
    ids.add(post.id);
  }
  return posts.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

/** One row in a writing list: a post on this site, or something published elsewhere. */
export interface WritingItem {
  title: string;
  href: string;
  date: Date;
  description: string;
  tags: string[];
  draft: boolean;
  /** Set for external pieces: where it was published. */
  publisher?: string;
}

/** Posts plus external pieces, newest first. For listings; article pages and RSS use getPosts(). */
export async function getWriting(): Promise<WritingItem[]> {
  const visible = ({ data }: { data: { draft: boolean } }) => import.meta.env.DEV || !data.draft;
  const posts = (await getPosts()).map((post) => ({ ...post.data, href: url(`blog/${post.id}`) }));
  const external = (await getCollection('external', visible)).map(({ data }) => ({ ...data, href: data.url }));
  return [...posts, ...external].sort((a, b) => b.date.valueOf() - a.date.valueOf());
}

/** Prefix a site-relative path with the configured base (needed on GitHub project pages). */
export function url(path = ''): string {
  const base = import.meta.env.BASE_URL.replace(/\/$/, '');
  return `${base}/${path.replace(/^\//, '')}`;
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

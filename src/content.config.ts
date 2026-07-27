import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

/**
 * The Astro-side mirror of go-git-cms.yml.
 *
 * Two schemas describing one set of files is a duplication worth being honest
 * about: the CMS validates what an editor may save, Astro validates what the
 * build may render, and neither can see the other. Keep them in step — the
 * build failing is how you find out that they aren't.
 *
 * ── Dates are strings here, deliberately ────────────────────────────────────
 *
 * `z.date()` is the obvious choice and it is a trap. Astro's YAML frontmatter
 * parser turns an *unquoted* `2026-03-14` into a Date, and a *quoted*
 * `"2026-03-14"` into a string. The CMS re-serializes every document it writes
 * and quotes date-shaped scalars — so the first time an editor saves an
 * article, `z.date()` starts failing with:
 *
 *     publishDate: Expected type "date", received "string"
 *
 * …and the site stops building. `z.coerce.date()` accepts both forms and hands
 * templates a real Date either way. Any field the CMS can write and Astro reads
 * as a Date needs it.
 */
const isoDate = z.coerce.date();

/**
 * The object form of a media field, exactly as the CMS stores it: the id is
 * authoritative and survives a rename, the paths are denormalized copies the
 * build can read without calling the CMS.
 */
const mediaRef = z.object({
  id: z.string().optional(),
  public_path: z.string().optional(),
  cdn_path: z.string().optional(),
});

/** The aliased `*seo` block from go-git-cms.yml, on every model that has one. */
const seo = z
  .object({
    title: z.string().optional(),
    description: z.string().optional(),
    canonical: z.string().optional(),
    noindex: z.boolean().optional(),
    image: mediaRef.optional(),
    keywords: z.array(z.string()).optional(),
  })
  .optional();

/**
 * Mixed-list items carry `_variant`, the CMS's discriminator naming which
 * declared shape an item is. Modelling it as a Zod discriminated union means an
 * unknown block fails the build here rather than rendering as nothing.
 */
const ctaBlock = z.object({
  _variant: z.literal("cta"),
  heading: z.string(),
  body: z.string().optional(),
  buttonLabel: z.string().optional(),
  buttonHref: z.string().optional(),
});

const homeBlock = z.discriminatedUnion("_variant", [
  z.object({
    _variant: z.literal("hero"),
    eyebrow: z.string().optional(),
    heading: z.string(),
    subheading: z.string().optional(),
    portrait: mediaRef.optional(),
    primaryLabel: z.string().optional(),
    primaryHref: z.string().optional(),
    secondaryLabel: z.string().optional(),
    secondaryHref: z.string().optional(),
  }),
  z.object({
    _variant: z.literal("featuredArticles"),
    heading: z.string().optional(),
    intro: z.string().optional(),
    limit: z.number().optional(),
  }),
  z.object({
    _variant: z.literal("featuredProjects"),
    heading: z.string().optional(),
    intro: z.string().optional(),
    limit: z.number().optional(),
  }),
  ctaBlock,
  z.object({
    _variant: z.literal("footer"),
    tagline: z.string().optional(),
    links: z.array(z.object({ label: z.string(), href: z.string() })).optional(),
  }),
]);

const projectBlock = z.discriminatedUnion("_variant", [
  z.object({
    _variant: z.literal("richText"),
    heading: z.string().optional(),
    body: z.string().optional(),
  }),
  z.object({
    _variant: z.literal("figure"),
    image: mediaRef.optional(),
    caption: z.string().optional(),
  }),
  z.object({
    _variant: z.literal("metrics"),
    items: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  }),
  ctaBlock,
]);

const articles = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/articles" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    publishDate: isoDate,
    updateDate: isoDate.optional(),
    draft: z.boolean().optional(),
    featured: z.boolean().optional(),
    excerpt: z.string().optional(),
    tags: z.array(z.string()).optional(),
    cover: mediaRef.optional(),
    seo,
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: "*.md", base: "./src/content/projects" }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    summary: z.string().optional(),
    year: z.number().optional(),
    role: z.string().optional(),
    status: z.enum(["in-progress", "shipped", "archived"]).optional(),
    url: z.string().optional(),
    tags: z.array(z.string()).optional(),
    featured: z.boolean().optional(),
    thumbnail: mediaRef.optional(),
    blocks: z.array(projectBlock).optional(),
    seo,
  }),
});

// Singletons. Both are one file, which the CMS models as a model whose path
// carries no wildcard — get and update, never create or delete.
const home = defineCollection({
  loader: glob({ pattern: "home.yml", base: "./src/content/pages" }),
  schema: z.object({
    blocks: z.array(homeBlock),
    seo,
  }),
});

const about = defineCollection({
  loader: glob({ pattern: "about.md", base: "./src/content/pages" }),
  schema: z.object({
    title: z.string(),
    intro: z.string().optional(),
    portrait: mediaRef.optional(),
    seo,
  }),
});

export const collections = { articles, projects, home, about };

// Content loading, shared by every page.
//
// Two paths on purpose:
//
//   published — Astro content collections (src/content.config.ts), whose zod
//     schemas validated everything at sync time. This is what every ordinary
//     request renders from, exactly as the static build did.
//
//   preview — when the middleware put a draft on Astro.locals.preview, the
//     same files are read straight from disk per request and the draft's
//     partial fields are composed over them before anything renders. The
//     content-layer store can't see an unsaved draft, which is why this path
//     bypasses it — and it exists only inside the editor's iframe, so the
//     schema guarantees the store gives published requests are not weakened.
//     Same compose semantics as apps/website/src/lib/content.ts.
import fs from "node:fs/promises";
import path from "node:path";
import { getCollection, getEntry } from "astro:content";
import matter from "gray-matter";
import { parse as parseYaml } from "yaml";
import type { PreviewPayload, PreviewOverride } from "@go-git-cms/preview-core";
import type { MediaRef, SeoBlock } from "./seo";

// The project root (examples/sample-site) — paths below are project-relative.
// In dev and in a built container the process starts here; CONTENT_ROOT
// overrides for anything more exotic.
const CONTENT_ROOT = process.env.CONTENT_ROOT || process.cwd();

/** One item of a mixedList: the CMS records which variant shape it is. */
export type Block = { _variant: string } & Record<string, unknown>;

export type Article = {
  slug: string;
  title: string;
  publishDate: Date;
  updateDate?: Date;
  draft: boolean;
  featured: boolean;
  excerpt?: string;
  tags?: string[];
  cover?: MediaRef;
  seo?: SeoBlock;
  /** Raw markdown; pages render it with marked. */
  body: string;
};

export type Project = {
  slug: string;
  title: string;
  summary?: string;
  year?: number;
  role?: string;
  status?: "in-progress" | "shipped" | "archived";
  url?: string;
  tags?: string[];
  featured: boolean;
  thumbnail?: MediaRef;
  blocks?: Block[];
  seo?: SeoBlock;
  body: string;
};

export type Home = { blocks: Block[]; seo?: SeoBlock };

export type About = {
  title: string;
  intro?: string;
  portrait?: MediaRef;
  seo?: SeoBlock;
  body: string;
};

// ---- the preview path: files + draft compose --------------------------------

/**
 * The draft for one file, if the payload carries one.
 *
 * Overrides address documents by repo-relative path. This project may sit at
 * the repository root or under examples/sample-site depending on where the
 * repo was connected, so match on the project-relative suffix rather than
 * equality.
 */
function overrideFor(
  preview: PreviewPayload | null | undefined,
  relPath: string,
): PreviewOverride | undefined {
  return preview?.overrides.find((o) => o.path === relPath || o.path.endsWith(`/${relPath}`));
}

/**
 * Compose a draft over the file's data. `fields` is deliberately partial —
 * only what the user touched — so untouched fields keep their real values.
 */
function compose(data: Record<string, unknown>, o: PreviewOverride | undefined): Record<string, unknown> {
  if (!o) return data;
  const merged: Record<string, unknown> = { ...data, ...o.fields };
  if (o.body != null) merged[o.bodyField ?? "body"] = o.body;
  return merged;
}

async function readFile(relPath: string): Promise<string | null> {
  try {
    return await fs.readFile(path.join(CONTENT_ROOT, relPath), "utf8");
  } catch {
    return null;
  }
}

/** A markdown document: frontmatter spread flat, the body under `body`. */
async function loadMarkdown(
  relPath: string,
  preview: PreviewPayload | null | undefined,
): Promise<Record<string, unknown> | null> {
  const o = overrideFor(preview, relPath);
  if (o?.deleted) return null;
  const raw = await readFile(relPath);
  if (raw == null && !o?.created) return null;
  const { data, content } = raw != null ? matter(raw) : { data: {}, content: "" };
  return compose({ ...data, body: content }, o);
}

/**
 * Every markdown document in a directory, each with its draft composed in. A
 * draft may also create a document that has no file yet — it belongs in lists
 * too, which is what makes "add an article, see it appear on the index" work
 * in preview before anything is saved.
 */
async function listMarkdown(
  dir: string,
  preview: PreviewPayload | null | undefined,
): Promise<Record<string, unknown>[]> {
  let files: string[] = [];
  try {
    files = (await fs.readdir(path.join(CONTENT_ROOT, dir))).filter((f) => f.endsWith(".md"));
  } catch {
    // A missing directory is an empty collection, not an error.
  }
  const docs = await Promise.all(files.map((f) => loadMarkdown(`${dir}/${f}`, preview)));
  const onDisk = files.map((f) => `${dir}/${f}`);
  const created = (preview?.overrides ?? [])
    .filter(
      (o) =>
        o.created &&
        !o.deleted &&
        o.path.endsWith(".md") &&
        o.path.includes(`${dir}/`) &&
        !onDisk.some((p) => o.path === p || o.path.endsWith(`/${p}`)),
    )
    .map((o) => compose({ body: "" }, o));
  return [...docs.filter((d): d is Record<string, unknown> => d != null), ...created];
}

// The CMS re-serializes documents it writes and quotes date-shaped scalars, so
// on the preview path a date arrives as a Date (unquoted YAML) or a string
// (quoted) depending on who last saved the file. Coerce both — the published
// path gets this from `z.coerce.date()` in content.config.ts instead.
function toDate(v: unknown): Date | undefined {
  if (v == null || v === "") return undefined;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function toArticle(d: Record<string, unknown>): Article {
  return {
    slug: String(d.slug ?? ""),
    title: String(d.title ?? ""),
    publishDate: toDate(d.publishDate) ?? new Date(0),
    updateDate: toDate(d.updateDate),
    draft: Boolean(d.draft ?? false),
    featured: Boolean(d.featured ?? false),
    excerpt: d.excerpt ? String(d.excerpt) : undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : undefined,
    cover: d.cover as MediaRef | undefined,
    seo: d.seo as SeoBlock | undefined,
    body: String(d.body ?? ""),
  };
}

function toProject(d: Record<string, unknown>): Project {
  return {
    slug: String(d.slug ?? ""),
    title: String(d.title ?? ""),
    summary: d.summary ? String(d.summary) : undefined,
    year: typeof d.year === "number" ? d.year : undefined,
    role: d.role ? String(d.role) : undefined,
    status: d.status as Project["status"],
    url: d.url ? String(d.url) : undefined,
    tags: Array.isArray(d.tags) ? (d.tags as string[]) : undefined,
    featured: Boolean(d.featured ?? false),
    thumbnail: d.thumbnail as MediaRef | undefined,
    blocks: Array.isArray(d.blocks) ? (d.blocks as Block[]) : undefined,
    seo: d.seo as SeoBlock | undefined,
    body: String(d.body ?? ""),
  };
}

// ---- the public API: collections unless a preview draft is supplied ---------

export async function getArticles(preview?: PreviewPayload | null): Promise<Article[]> {
  if (preview) return (await listMarkdown("src/content/articles", preview)).map(toArticle);
  return (await getCollection("articles")).map((e) => toArticle({ ...e.data, body: e.body ?? "" }));
}

export async function getArticle(
  slug: string,
  preview?: PreviewPayload | null,
): Promise<Article | null> {
  // Routed on the `slug` field, not the filename — the slug is what an editor
  // controls and what the CMS's preview URL template interpolates.
  return (await getArticles(preview)).find((a) => a.slug === slug) ?? null;
}

export async function getProjects(preview?: PreviewPayload | null): Promise<Project[]> {
  if (preview) return (await listMarkdown("src/content/projects", preview)).map(toProject);
  return (await getCollection("projects")).map((e) => toProject({ ...e.data, body: e.body ?? "" }));
}

export async function getProject(
  slug: string,
  preview?: PreviewPayload | null,
): Promise<Project | null> {
  return (await getProjects(preview)).find((p) => p.slug === slug) ?? null;
}

// Singletons. Both are one file, which the CMS models as a model whose path
// carries no wildcard — get and update, never create or delete. They must
// exist, so a missing file is an error rather than an empty page.

export async function getHome(preview?: PreviewPayload | null): Promise<Home> {
  if (!preview) {
    const home = await getEntry("home", "home");
    if (!home) {
      throw new Error("src/content/pages/home.yml is missing — the homepage is a singleton and must exist.");
    }
    return { blocks: home.data.blocks as Block[], seo: home.data.seo as SeoBlock | undefined };
  }
  const relPath = "src/content/pages/home.yml";
  const o = overrideFor(preview, relPath);
  const raw = await readFile(relPath);
  if (raw == null && !o) {
    throw new Error("src/content/pages/home.yml is missing — the homepage is a singleton and must exist.");
  }
  const data = raw != null ? ((parseYaml(raw) ?? {}) as Record<string, unknown>) : {};
  const merged = compose(data, o);
  return {
    blocks: Array.isArray(merged.blocks) ? (merged.blocks as Block[]) : [],
    seo: merged.seo as SeoBlock | undefined,
  };
}

export async function getAbout(preview?: PreviewPayload | null): Promise<About> {
  if (!preview) {
    const about = await getEntry("about", "about");
    if (!about) {
      throw new Error("src/content/pages/about.md is missing — About is a singleton and must exist.");
    }
    return {
      title: about.data.title,
      intro: about.data.intro,
      portrait: about.data.portrait as MediaRef | undefined,
      seo: about.data.seo as SeoBlock | undefined,
      body: about.body ?? "",
    };
  }
  const doc = await loadMarkdown("src/content/pages/about.md", preview);
  if (!doc) {
    throw new Error("src/content/pages/about.md is missing — About is a singleton and must exist.");
  }
  return {
    title: String(doc.title ?? ""),
    intro: doc.intro ? String(doc.intro) : undefined,
    portrait: doc.portrait as MediaRef | undefined,
    seo: doc.seo as SeoBlock | undefined,
    body: String(doc.body ?? ""),
  };
}

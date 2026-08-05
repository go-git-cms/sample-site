# sample-site

A personal profile starter: Astro + Tailwind, block-composed pages, modelled end
to end in `go-git-cms.yml`.

Unlike the `preview-*` examples — which are eight variations on one narrow
question — this is a site you could plausibly deploy. It exists to show what a
real content model looks like when the CMS is the editing surface: singletons,
mixed lists, structured metadata, media references, and SEO on every model.

```bash
pnpm --filter @go-git-cms/example-sample-site dev   # the site, :4340
```

The site is Astro in **server** mode: pages read their content files per
request, which is what lets the CMS preview an unsaved draft (see Preview
below). `pnpm --filter @go-git-cms/example-sample-site build` produces the Node
server that `Dockerfile.sample-site` ships behind Caddy.

## What's in it

| Route | Content model | Shape |
|---|---|---|
| `/` | `home` | **Singleton.** A mixed list of blocks: hero, featured projects, featured articles, CTA, footer |
| `/articles/` `/articles/:slug/` | `articles` | Collection. Frontmatter + Markdown body |
| `/projects/` `/projects/:slug/` | `projects` | Collection. Structured metadata **and** a mixed list of blocks |
| `/about/` | `about` | **Singleton.** Prose, not blocks |
| `/rss.xml` `/robots.txt` `/sitemap-index.xml` | — | Generated |

## The part worth reading: YAML anchors

Four models carry SEO metadata and every one wants the same six fields. Written
out four times, they drift — the fifth model gets `ogImage` instead of `image`
and nothing renders for it.

So `go-git-cms.yml` declares the block once and aliases it:

```yaml
# first use — the anchor is defined here
- &seo
  name: seo
  type: object
  display: { component: group }
  fields: [ ... ]

# every later model
- *seo
```

The CMS never sees the anchor. YAML resolves aliases while parsing, so what
reaches the importer is four identical, fully-expanded field lists. The
repetition still exists in the data; it just no longer exists in the file you
maintain.

**Anchors have to be declared at first use.** The tidy approach — parking them
under a top-level `x-definitions:` key — does not work, because the config
schema is closed (`additionalProperties: false`) and rejects any top-level key
it does not declare.

Two forms are used here:

| Form | Meaning | Used for |
|---|---|---|
| `*name` | exact copy | `seo`, and the `cta` block shared by the homepage and project pages |
| `<<: *name` | copy, then override | media references, which repeat a fixed three-child shape under different names |

## Blocks

A `mixedList` field holds items of several declared shapes. Each item records
which shape it is under `_variant` — the CMS's discriminator, matching the
variant's `name` in the config:

```yaml
blocks:
  - _variant: hero
    heading: I build systems that stay understandable.
```

`src/components/BlockRenderer.astro` maps those names onto components. That map
is the only place the content model and this site's components are joined. An
unknown variant renders nothing rather than throwing, so adding a block to the
schema before its component exists keeps building.

The `cta` variant is aliased between `projects` and `home`, so both surfaces
share one shape and one component and cannot drift apart.

## Two schemas, and why dates are `z.coerce.date()`

`go-git-cms.yml` validates what an editor may save; `src/content.config.ts`
validates what the build may render. Neither can see the other, so they have to
be kept in step by hand.

One mismatch is worth calling out because it is silent until it isn't. Astro's
frontmatter parser turns an **unquoted** `2026-03-14` into a `Date` and a
**quoted** `"2026-03-14"` into a string. The CMS re-serializes every document it
writes and quotes date-shaped scalars — so with `z.date()`, the first time an
editor saves an article the build starts failing with:

```
publishDate: Expected type "date", received "string"
```

`z.coerce.date()` accepts both and hands templates a real `Date` either way.
Any field the CMS can write and Astro reads as a Date needs it.

The content in this repository is committed in **already-normalised form** —
keys sorted, dates quoted — which is what the CMS produces. That is deliberate:
it means the first real edit produces a one-line diff instead of reformatting
every file at once. It also means the YAML carries no comments, because a
re-serialized document loses them.

## Media

Media lives in **sets** declared once at the top of the config, not on the
fields that use them:

```yaml
media:
  - name: images
    path: "public/images/**/*.{png,jpg,jpeg,webp,avif,svg}"
    public_base: /images
```

A field points at a set by name (`display: { media: images }`). Astro serves
`public/` from the site root, so `public_base: /images` is what lets a field
store `/images/hero.png` while the CMS still knows the file is
`public/images/hero.png`.

The object form of a media field stores `{ id, public_path, cdn_path }` — the id
is authoritative and survives a rename; the paths are copies the build reads
without calling the CMS. `src/lib/seo.ts#mediaUrl` prefers the CDN copy and
falls back to the public path.

## Preview

This site is `output: "server"`, so preview is the **SSR middleware** case: the
editor's Preview pane iframes the running site with a signed draft payload,
`src/middleware.ts` (`@go-git-cms/preview-astro`) verifies it and puts the
draft on `Astro.locals.preview`, and `src/lib/content.ts` composes it over the
content files before anything renders. First paint is already the draft. No
preview code appears in any template — pages just pass `Astro.locals.preview`
into the content loaders.

Ordinary requests never touch that path: without a payload, the loaders read
from Astro content collections (`src/content.config.ts`), exactly as a static
build would. `/api/preview` enters preview mode when the payload is too large
to carry on the page URL; `/api/exit-preview` clears the parked cookie.

The editor side is one plugin entry in `cms.config.mjs` (`@go-git-cms/preview`):
where the site answers, and which URL each collection's documents live at.

In production set `CMS_PREVIEW_SECRET` — the middleware verifies payload
signatures with it, and without one it accepts unsigned payloads, which lets
anyone inject content into rendered pages.

## Making it yours

1. `src/lib/seo.ts` — `SITE` holds the name, default title, description and
   Twitter handle. One place.
2. `astro.config.mjs` — set `site` to your real origin. Canonicals, Open Graph
   and the sitemap all derive from it.
3. `src/styles/global.css` — the palette is one ink ramp plus semantic aliases.
   Repaint by editing the `@theme` block; nothing imports the CMS design system.
4. Replace the content in `src/content/`, and the models in `go-git-cms.yml`
   that describe it.

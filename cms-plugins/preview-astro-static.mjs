// The preview plugin for this site, as a local plugin file.
//
// ── Why local, and not a package ────────────────────────────────────────────
//
// Preview comes in two shapes (docs/preview-system.md §8). A generator that
// reads content per request can be handed a draft in the request — that is what
// @go-git-cms/preview-astro does, as Astro *SSR* middleware. A generator that
// reads content at build time cannot, because the content decision was made
// before the browser asked; its only honest preview is a real build, driven by
// the sidecar.
//
// This site is `output: "static"`, so it is the second case. The sidecar has a
// built-in `astro` engine, and the published engine plugins (preview-hugo,
// preview-jekyll, preview-11ty) are each one line over createSidecarPlugin.
// There is no equivalent package for Astro SSG — the obvious name,
// @go-git-cms/preview-astro, is already the SSR middleware — so this site
// declares it itself.
//
// cms.config.mjs may name a plugin by relative path as well as by package, and
// the CMS names a path-linked plugin after the nearest package.json, so its id
// is the same as it would be if this were published.
//
// If Astro SSG preview turns out to be common, this file is exactly the content
// of the package that should replace it.

import { createSidecarPlugin } from "@go-git-cms/preview-sidecar";

export default createSidecarPlugin("astro");

---
draft: true
excerpt: This post is marked draft, so it is excluded from the build, the article list and the RSS feed — while still being committed to the branch.
publishDate: "2026-07-01"
slug: a-draft-in-progress
tags:
  - meta
title: A draft in progress
---

This article exists to demonstrate one thing: `draft: true`.

It is committed to the repository like every other post — remember that in
Go·Git CMS a save is already a commit, so "unpublished" cannot mean "unsaved".
Publication has to be a property of the content, and that property is this flag.

Every place articles are listed filters on it:

- `src/pages/articles/index.astro` excludes drafts from the index
- `src/pages/articles/[slug].astro` excludes them from `getStaticPaths`, so this
  page is not built at all
- `src/pages/rss.xml.ts` excludes them from the feed

Toggle the switch in the editor and this page appears on the next build.

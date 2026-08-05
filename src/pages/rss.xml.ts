import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { getArticles } from "~/lib/content";
import { SITE } from "~/lib/seo";

export async function GET(context: APIContext) {
  // The published feed, always: no preview payload is passed, so a draft in an
  // editor's iframe can never leak into what feed readers poll.
  const articles = (await getArticles())
    .filter((a) => !a.draft)
    .sort((a, b) => b.publishDate.getTime() - a.publishDate.getTime());

  return rss({
    title: SITE.title,
    description: SITE.description,
    // `site` from astro.config.mjs. A feed needs absolute URLs, so this is one
    // of the places a missing `site` fails the request rather than degrading.
    site: context.site ?? "https://example.com",
    items: articles.map((a) => ({
      title: a.title,
      description: a.excerpt,
      pubDate: a.publishDate,
      link: `/articles/${a.slug}/`,
      categories: a.tags,
    })),
  });
}

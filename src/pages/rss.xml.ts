import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import type { APIContext } from "astro";
import { SITE } from "~/lib/seo";

export async function GET(context: APIContext) {
  const articles = (await getCollection("articles", ({ data }) => !data.draft)).sort(
    (a, b) => b.data.publishDate.getTime() - a.data.publishDate.getTime()
  );

  return rss({
    title: SITE.title,
    description: SITE.description,
    // `site` from astro.config.mjs. A feed needs absolute URLs, so this is one
    // of the places a missing `site` fails the build rather than degrading.
    site: context.site ?? "https://example.com",
    items: articles.map((a) => ({
      title: a.data.title,
      description: a.data.excerpt,
      pubDate: a.data.publishDate,
      link: `/articles/${a.data.slug}/`,
      categories: a.data.tags,
    })),
  });
}

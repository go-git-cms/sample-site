/**
 * Resolving the `seo` block into the tags that actually go in <head>.
 *
 * The SEO block is optional on every model and every field inside it is
 * optional too, which is correct — an editor should not have to fill in six
 * fields to publish a post. The consequence is that resolution needs a fallback
 * chain, and that chain belongs in one place rather than in four templates.
 */

export type MediaRef = {
  id?: string;
  public_path?: string;
  cdn_path?: string;
};

export type SeoBlock = {
  title?: string;
  description?: string;
  canonical?: string;
  noindex?: boolean;
  image?: MediaRef;
  keywords?: string[];
};

/** Site-wide defaults. One place to change the suffix and the fallback card. */
export const SITE = {
  name: "Ada Lovelace",
  title: "Ada Lovelace — engineer & writer",
  description:
    "Personal site of Ada Lovelace: essays on systems, and a record of things built.",
  locale: "en",
  twitter: "@example",
} as const;

/**
 * A media reference resolves to the CDN copy when there is one, otherwise the
 * public path. `id` alone is not renderable — it addresses the file in the CMS,
 * not on the web — so an entry with only an id yields nothing rather than a
 * broken image.
 */
export function mediaUrl(ref?: MediaRef | null): string | undefined {
  return ref?.cdn_path || ref?.public_path || undefined;
}

export type ResolvedSeo = {
  title: string;
  description?: string;
  canonical?: string;
  noindex: boolean;
  image?: string;
  keywords?: string[];
};

/**
 * @param seo        the document's own SEO block, if it filled one in
 * @param fallback   what to use per field when it didn't — usually the
 *                   document's own title and excerpt, which is nearly always
 *                   the right meta description anyway
 */
export function resolveSeo(
  seo: SeoBlock | undefined,
  fallback: { title?: string; description?: string; image?: MediaRef | null } = {}
): ResolvedSeo {
  const title = seo?.title || fallback.title;
  return {
    // The suffix is applied here, not by callers, so one page cannot forget it.
    title: title ? `${title} · ${SITE.name}` : SITE.title,
    description: seo?.description || fallback.description || SITE.description,
    canonical: seo?.canonical || undefined,
    noindex: seo?.noindex ?? false,
    image: mediaUrl(seo?.image) || mediaUrl(fallback.image),
    keywords: seo?.keywords?.length ? seo.keywords : undefined,
  };
}

/** ISO-8601 for <time datetime>, and a readable form for the reader. */
export function formatDate(d: Date | string | undefined): {
  iso: string;
  label: string;
} {
  if (!d) return { iso: "", label: "" };
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return { iso: "", label: String(d) };
  return {
    iso: date.toISOString(),
    label: date.toLocaleDateString(SITE.locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
}

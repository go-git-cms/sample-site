import type { APIContext } from "astro";

// Served rather than static, so the sitemap line carries the real origin from
// astro.config.mjs instead of a hardcoded one someone forgets to change.
export async function GET(context: APIContext) {
  const site = context.site ?? new URL("https://example.com");
  return new Response(
    ["User-agent: *", "Allow: /", "", `Sitemap: ${new URL("sitemap-index.xml", site).href}`, ""].join("\n"),
    { headers: { "Content-Type": "text/plain; charset=utf-8" } }
  );
}

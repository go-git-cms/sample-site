// @ts-check
import { defineConfig } from "astro/config";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Static. A personal site has no per-request content, and every page here is
  // knowable at build time — which is also what decides how preview works: an
  // SSG site has nothing to intercept per request, so its preview is a real
  // build driven by the sidecar rather than middleware. See the README.
  output: "static",

  // Set this before deploying. It is what makes canonical URLs, the sitemap and
  // the Open Graph tags absolute, and Astro warns if it is missing.
  site: "https://example.com",

  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
  },
});

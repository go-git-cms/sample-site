// @ts-check
import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // Server-rendered: pages read their content files per request, which is what
  // lets the preview middleware (src/middleware.ts) compose an unsaved CMS
  // draft over the real file and have the first paint already be the draft. A
  // static build would bake the files in and preview would need the sidecar
  // instead — the same trade apps/website makes.
  output: "server",
  adapter: node({ mode: "standalone" }),

  // Set this before deploying. It is what makes canonical URLs, the sitemap and
  // the Open Graph tags absolute, and Astro warns if it is missing.
  site: "https://example.com",

  integrations: [sitemap()],

  vite: {
    plugins: [tailwindcss()],
    ssr: {
      // The @go-git-cms preview packages ship ESM with extensionless relative
      // imports, which Node can't resolve when they're externalized — bundle
      // them so Vite resolves the imports instead.
      noExternal: [/^@go-git-cms\/preview-/],
    },
  },
});
